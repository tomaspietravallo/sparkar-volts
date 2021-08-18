import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive';
import Time from 'Time';

//#region types & interfaces
export type PublicOnly<T> = Pick<T, keyof T>;

type Snapshot = { [key: string]: ScalarSignal | Vec2Signal | VectorSignal | Vec4Signal | StringSignal | BoolSignal };

type getDimsOfSignal<S> = S extends Vec4Signal
  ? 'X4' | 'Y4' | 'Z4' | 'W4'
  : S extends VectorSignal
  ? 'X3' | 'Y3' | 'Z3'
  : S extends Vec2Signal
  ? 'X2' | 'Y2'
  : S extends ScalarSignal
  ? 'X1'
  : never;

type ObjectToSnapshot_able<Obj> = {
  [Property in keyof Obj as `${Obj[Property] extends ISignal
    ? `CONVERTED::${Property extends string ? Property : never}::${getDimsOfSignal<Obj[Property]>}::UUID`
    : never}`]: Obj[Property] extends Vec2Signal | VectorSignal | Vec4Signal ? ScalarSignal : Obj[Property];
};

type SnapshotToVanilla<Obj> = {
  [Property in keyof Obj]: Obj[Property] extends Vec2Signal | VectorSignal | Vec4Signal
    ? number[]
    : Obj[Property] extends ScalarSignal
    ? number
    : Obj[Property] extends StringSignal
    ? string
    : Obj[Property] extends BoolSignal
    ? boolean
    : Obj[Property];
};

interface onFramePerformanceData {
  fps: number;
  delta: number;
  frameCount: number;
}

/**
 * @param elapsedTime The time elapsed since the timeout/interval was created
 * @param count The amount of times the timeout/interval has been called.
 * Note this is incremented after the function is called, so it will always be 0 for any timeout
 * @param lastCall The last time the function was called. `let deltaBetweenCalls = elapsedTime-lastCall;`
 * @param created The time (in elapsed VOLTS.World time, not UNIX) when the function was created
 * @param onFramePerformanceData onFramePerformanceData corresponding to the frame when the function was called
 */
type TimedEventFunction = (
  this: InstanceType<typeof World>,
  timedEventFunctionArguments: { elapsedTime: number; count: number; lastCall: number; created: number },
  onFramePerformanceData: onFramePerformanceData,
) => void;

interface TimedEvent {
  recurring: boolean;
  delay: number;
  created: number;
  lastCall: number;
  cb: TimedEventFunction;
  count: number;
}

type VectorArgRest = [number] | [number[]] | number[] | [Vector];

//#endregion

//#region utils
/**
 * @see https://stackoverflow.com/a/2117523/14899497
 */
function getUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @param vec The 3D VectorSignal to be transformed
 * @param vecSpace The parent space in which `vec` is located
 * @param targetSpace The parent space into which `vec` should be transformed into
 * @returns A signal in the `targetSpace`, which in the absolute frame of reference, is equivalent to `vec` in it's `vecSpace`
 *
 * @example ```ts
 * let firstObj: SceneObjectBase, secondarySceneObj: SceneObjectBase;
 * secondarySceneObj.transform.position =
 *              transformAcrossSpaces(
 *                      firstObj.transform.position,
 *                      firstObj.parentWorldTransform,
 *                      secondarySceneObj.parentWorldTransform
 *              )
 * ```
 */
export function transformAcrossSpaces(
  vec: VectorSignal,
  vecParentSpace: TransformSignal,
  targetParentSpace: TransformSignal,
): VectorSignal {
  if (!(vec && vec.z && vec.pinLastValue))
    throw new Error(`@ transformAcrossSpaces: Argument vec is not defined, or is not a VectorSignal`);
  if (!(vecParentSpace && vecParentSpace.inverse && vecParentSpace.pinLastValue))
    throw new Error(`@ transformAcrossSpaces: Argument vecParentSpace is not defined, or is not a TransformSignal`);
  if (!(targetParentSpace && targetParentSpace.inverse && targetParentSpace.pinLastValue))
    throw new Error(`@ transformAcrossSpaces: Argument targetParentSpace is not defined, or is not a TransformSignal`);

  return targetParentSpace.inverse().applyToPoint(vecParentSpace.applyToPoint(vec));
}
//#endregion

export let __globalVoltsWorldInstance: typeof World.prototype;

export enum PRODUCTION_MODES {
  'PRODUCTION' = 'PRODUCTION',
  'DEV' = 'DEV',
  'NO_AUTO' = 'NO_AUTO',
}

/**
 * @classdesc The main building block of VOLTS. This class (and the associated Time.ms subscription) functions as the internal clock that keeps things running
 *
 * @example ```typescript
 * const WORLD = new World({mode: 'DEV'});
 *
 * WORLD.setTimeout(()=>{
 *              Diagnostics.log('5s have passed!')
 * }, 5000);
 * ```
 */
export class World<
  LazyLoaded extends { [key: string]: any } = {},
  ObjectTypes extends { [key: string]: Promise<any | any[]> } = {},
  SnapshotObjType extends Snapshot = {},
> {
  public readonly MODE: keyof typeof PRODUCTION_MODES;
  public assets: { [Prop in keyof ObjectTypes]: ObjectTypes[Prop] extends PromiseLike<infer C> ? C : never };
  public lazyAssets: {
    [Prop in keyof LazyLoaded]+?: LazyLoaded[Prop] extends PromiseLike<infer C> ? C : LazyLoaded[Prop];
  };
  protected __sensitive: {
    initPromise: () => Promise<void>;
    loaded: boolean;
    running: boolean;
    events: {};
    timedEvents: TimedEvent[];
    elapsedTime: number;
    // timeMSSignalValue: number;
    timeoutStopFlag: boolean;
    frameCount: number;
    valuesToSnapshot: SnapshotObjType;
    formattedValuesToSnapshot: ObjectToSnapshot_able<SnapshotObjType>;
    userFriendlySnapshot: SnapshotToVanilla<SnapshotObjType>;
    onLoad: (snapshot?, data?: onFramePerformanceData) => void;
    onFrame: (snapshot?, data?: onFramePerformanceData) => void;
    Camera: Camera;
  };

  constructor({
    assets,
    lazyAssets,
    snapshot,
    mode,
  }: {
    assets?: ObjectTypes;
    lazyAssets?: LazyLoaded;
    snapshot: SnapshotObjType;
    mode: keyof typeof PRODUCTION_MODES;
  }) {
    if (__globalVoltsWorldInstance)
      throw new Error(
        `@ VOLTS.World.constructor: An instance of World already exists.\n\nSome features may break, as they rely on the __globalVoltsWorldInstance instance.\n\nYou can override this error by setting __globalVoltsWorldInstance to false before creating a new class`,
      );
    if (typeof arguments[0] !== 'object')
      throw new Error(
        `@ VOLTS.World.constructor: The argument provided to the World constructor is undefined, or is not of type 'object'`,
      );

    // mode argument
    switch (mode) {
      case PRODUCTION_MODES.PRODUCTION:
      case PRODUCTION_MODES.NO_AUTO:
      case PRODUCTION_MODES.DEV:
        this.MODE = mode;
        break;

      default:
        Diagnostics.log(
          `@ VOLTS.World.constructor: 'mode' parameter was not set, or was set incorrectly, defaulting to PRODUCTION_MODES.DEV`,
        );
        this.MODE = PRODUCTION_MODES.DEV;
        break;
    }

    __globalVoltsWorldInstance = this;
    this.lazyAssets = lazyAssets || {};
    // @ts-ignore
    this.assets = assets || {};
    // @ts-ignore
    // prettier-ignore
    // eslint-disable-line no-alert
    this.__sensitive = Object.defineProperties({},
      {
        initPromise: { value: this.init.bind(this, [this.assets]), writable: false, configurable: false },
        running: { value: false, writable: true, configurable: false },
        loaded: { value: false, writable: true, configurable: false },
        events: { value: {}, writable: true, configurable: false },
        timedEvents: { value: [], writable: true, configurable: false },
        elapsedTime: { value: 0, writable: true, configurable: false },
        // timeMSSignalValue: { value: 0, writable: true, configurable: false },
        timeMSSubscription: { value: null, writable: true, configurable: false },
        frameCount: { value: 0, writable: true, configurable: false },
        valuesToSnapshot: { value: snapshot, writable: true, configurable: false },

        // Some extra signals for internal use. Eg. Unprojected screen size
        // Prepend the signal name with '__volts__internal__' to prevent collisions with user generated ones

        formattedValuesToSnapshot: {
          value: this.signalsToSnapshot_able(
            Object.assign({
              __volts__internal__time: Time.ms,
              __volts__internal__screen: Scene.unprojectToFocalPlane(Reactive.point2d(0,0)),
            }, snapshot)
          ),
          writable: true,
          configurable: false,
        },

        userFriendlySnapshot: { value: {}, writable: true, configurable: false },
        onLoad: { value: null, writable: true, configurable: false },
        onFrame: { value: null, writable: true, configurable: false },
        Camera: { value: null, writable: true, configurable: false }
      },
    );

    this.__sensitive.initPromise();
  }

  /**
   * @description Initializes the class with any data required. Called as part of the constructor, to load/fetch async data
   */
  private async init(assets): Promise<void> {
    // Camera & focal distance 👇
    this.__sensitive.Camera = (await Scene.root.findFirst('Camera')) as Camera;
    this.__sensitive.formattedValuesToSnapshot = Object.assign(
      this.signalsToSnapshot_able({ __volts__internal__focalDistance: this.__sensitive.Camera.focalPlane.distance }),
      this.__sensitive.formattedValuesToSnapshot,
    );

    const keys = Object.keys(assets);
    /**
     * @todo Add support for loading a SceneObject with it's material(s)
     * @body Use cases might be limited, but it would be nice to have
     */
    const getAssets: ObjectTypes[keyof ObjectTypes][] = await Promise.all([
      ...keys.map((n) => assets[n][0] || assets[n]),
    ]);
    for (let k = 0; k < keys.length; k++) {
      if (!getAssets[k]) throw new Error(`@ VOLTS.World.init: Object(s) not found. Key: "${keys[k]}"`);
      // @ts-ignore
      // To be properly typed out. Unfortunately, i think loading everything at once with an array ([...keys.map((n) =>...) would make it very challenging...
      // Might be best to ts-ignore or `as unknown` in this case
      this.assets[keys[k]] = (Array.isArray(getAssets[k]) ? getAssets[k] : [getAssets[k]]).sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      // .map(objBody=>{ return new Object3D(objBody) });
    }

    this.__sensitive.loaded = true;
    if (this.MODE !== PRODUCTION_MODES.NO_AUTO) this.run();
  }

  /**
   * @description Gets the internal clock ticking ⏱. This will run any onFrame function, calculate the current FPS, check for any timeout/interval(s) that need to be called, and much more
   */
  public run(): void {
    this.__sensitive.running = true;
    this.__sensitive.timeoutStopFlag = false;
    // Fun fact: Time.setTimeoutWithSnapshot will run even if the Studio is paused
    // Meaning this would keep executing, along with any onFrame function
    // For DEV purposes, the function will not execute if it detects the studio is on pause
    // This won't be the case when the mode is set to PROD, in case some device has undoc.b. within the margin of error (3 frames)
    const lastThreeFrames: number[] = [];

    function Rec() {
      Time.setTimeoutWithSnapshot(
        this.__sensitive.formattedValuesToSnapshot,
        (_, snapshot) => {
          // Snapshot
          this.__sensitive.userFriendlySnapshot = this.formattedSnapshotToUserFriendly(snapshot);
          snapshot = this.__sensitive.userFriendlySnapshot;

          // Capture data & analytics
          const delta =
            (this.__sensitive.userFriendlySnapshot.__volts__internal__time || 0) - this.__sensitive.elapsedTime;
          const fps = Math.round((1000 / delta) * 10) / 10;
          this.__sensitive.elapsedTime += delta;

          if (lastThreeFrames.length > 2) {
            lastThreeFrames[0] = lastThreeFrames[1];
            lastThreeFrames[1] = lastThreeFrames[2];
            lastThreeFrames[2] = this.__sensitive.userFriendlySnapshot.__volts__internal__time;
          } else {
            lastThreeFrames.push(this.__sensitive.userFriendlySnapshot.__volts__internal__time);
          }

          // For DEV purposes, the function will not execute if it detects the studio is on pause
          if (
            lastThreeFrames[0] === lastThreeFrames[1] &&
            lastThreeFrames[1] === lastThreeFrames[2] &&
            !this.__sensitive.timeoutStopFlag &&
            this.MODE == PRODUCTION_MODES.DEV
          )
            return Rec.apply(this);

          // onLoad function
          this.__sensitive.onLoad &&
            this.MODE !== PRODUCTION_MODES.NO_AUTO &&
            this.__sensitive.frameCount === 0 &&
            this.__sensitive.onLoad.apply(this, this.__sensitive.userFriendlySnapshot);

          // onRun
          const onFramePerformanceData = { fps, delta, frameCount: this.__sensitive.frameCount };
          this.runTimedEvents(onFramePerformanceData);
          this.__sensitive.onFrame &&
            this.__sensitive.onFrame.apply(this, [this.__sensitive.userFriendlySnapshot, onFramePerformanceData]);
          this.__sensitive.frameCount++;

          // till the end of time
          if (!this.__sensitive.timeoutStopFlag) Rec.apply(this);
        },
        0,
      );
    }
    Rec.apply(this);
  }

  /**
   * @description This method forces the instance to reload all data loaded during the `VOLTS.World.init` function. This will override and replace any existing assets. lazyAssets are not reloaded nor deleted
   *
   * Note, this might break if not used properly. It is not a function meant to be called multiple times -- or even at all -- it is just a utility that allows reloading data in case it got lost.
   *
   * This function is bound in the constructor `value: this.init.bind(this, [this.assets])`, meaning it cannot be used to load **new** assets. lazyAssets are preferred for that
   */
  public forceAssetReload(): Promise<void> {
    return this.__sensitive.initPromise();
  }

  /**
   * @description Stops the internal clock. This will stop the execution of the onFrame function, stop FPS monitoring, prevent timeouts/intervals from getting called, etc.
   *
   * All timeouts and intervals will resume normally (using the internal instance clock), unless clearTimedEvents is true, `stop({clearTimedEvents: true})`, which will permanently erase them
   */
  public stop({ clearTimedEvents = false } = { clearTimedEvents: false }): void {
    this.__sensitive.running = false;
    if (clearTimedEvents) this.__sensitive.timedEvents = [];
    this.__sensitive.timeoutStopFlag = true;
  }

  /**
   * @author Andrey Sitnik
   * @param event The event name.
   * @param args The arguments for listeners.
   * @see https://github.com/ai/nanoevents
   */
  public emitEvent(event: string, ...args: any[]): void {
    (this.__sensitive.events[event] || []).forEach((i) => i(...args));
  }

  /**
   * @author Andrey Sitnik
   * @param event The event name.
   * @param cb The listener function.
   * @returns Unbind listener from event.
   * @see https://github.com/ai/nanoevents
   */
  public onEvent(event: string, cb: (...args: any[]) => void): () => void {
    (this.__sensitive.events[event] = this.__sensitive.events[event] || []).push(cb);
    return () => (this.__sensitive.events[event] = (this.__sensitive.events[event] || []).filter((i) => i !== cb));
  }

  /**
   * @description Creates a timeout that executes the function after a given number of milliseconds
   * @param cb The function to be executed
   * @param ms The amount of milliseconds to wait before calling the function
   * @returns The `clear` function, with which you can clear the timeout, preventing any future executions
   */
  public setTimeout(cb: TimedEventFunction, ms: number): { clear: () => void } {
    return this.setTimedEvent(cb, ms, false);
  }

  /**
   * @description Creates an interval that executes the function every [X] milliseconds
   * @param cb The function to be executed
   * @param ms The amount of milliseconds to wait before calling the function
   * @returns The `clear` function, with which you can clear the interval, preventing any future executions
   */
  public setInterval(cb: TimedEventFunction, ms: number): { clear: () => void } {
    return this.setTimedEvent(cb, ms, true);
  }

  /**
   * @param cb The function to be called
   * @param ms The amount of ms
   * @param trailing Whether the debounce should trail or lead. False means the debounce will lead
   * @see http://demo.nimius.net/debounce_throttle/
   */
  public setDebounce<argTypes extends Array<any>>(
    cb: (...args: argTypes) => void,
    ms: number,
    trailing = false,
  ): (...args: argTypes) => void {
    if (!this.__sensitive.running)
      Diagnostics.log(
        'Warning @ VOLTS.World.setDebounce: created a debounce while the current instance is not running',
      );
    let timer: { clear: () => void };
    if (trailing)
      // trailing
      return (...args: argTypes): void => {
        timer && timer.clear();
        timer = this.setTimeout(() => {
          cb.apply(this, args);
        }, ms);
      };
    // leading
    return (...args: argTypes): void => {
      if (!timer) {
        cb.apply(this, args);
      }
      timer && timer.clear();
      timer = this.setTimeout(() => {
        timer = undefined;
      }, ms);
    };
  }

  protected setTimedEvent(cb: TimedEventFunction, ms: number, recurring: boolean): { clear: () => void } {
    const event: TimedEvent = {
      created: this.__sensitive.elapsedTime,
      lastCall: this.__sensitive.elapsedTime,
      count: 0,
      delay: ms,
      recurring,
      cb,
    };
    this.__sensitive.timedEvents.push(event);
    return {
      clear: () => (this.__sensitive.timedEvents = (this.__sensitive.timedEvents || []).filter((i) => i !== event)),
    };
  }

  private runTimedEvents(onFramePerformanceData: onFramePerformanceData) {
    this.__sensitive.timedEvents = this.__sensitive.timedEvents.sort(
      (e1, e2) => e1.lastCall + e1.delay - (e2.lastCall + e2.delay),
    );
    let i = this.__sensitive.timedEvents.length;
    while (i--) {
      const event = this.__sensitive.timedEvents[i];
      if (event.lastCall + event.delay < this.__sensitive.elapsedTime) {
        event.cb.apply(this, [
          this.__sensitive.elapsedTime - event.created,
          event.count,
          event.lastCall,
          event.created,
          onFramePerformanceData,
        ]);
        this.__sensitive.timedEvents[i].count++;
        if (event.recurring) {
          this.__sensitive.timedEvents[i].lastCall = this.__sensitive.elapsedTime;
        } else {
          this.__sensitive.timedEvents.splice(i, 1);
        }
      }
    }
  }

  // this: InstanceType<typeof World>
  // Technically, the onFrame function can have access to the private & protected properties,
  // as long as it's declared as an arrow function, but typing it out that way would mean
  // users would be presented to the raw/non abstracted code, which might be confusing.
  // I do not personally think completely isolating the onFrame/onLoad function calls is a good idea,
  // since this way, an arrow function would allow more advanced users access to the private/protected fields,
  // while the type makes it unlikely that anyone not familiar with the code base might accidentally change something.
  // To get the type of the context an arrow function would have, the line below can be changed to
  // this: typeof VOLTS.World.prototype
  /**
   * @description A function to be called every frame
   */
  public set onFrame(
    f: (
      this: InstanceType<typeof World>,
      snapshot?: SnapshotToVanilla<SnapshotObjType>,
      data?: onFramePerformanceData,
    ) => void,
  ) {
    if (typeof f == 'function') {
      this.__sensitive.onFrame = f;
    } else {
      throw new Error(`@ VOLTS.World.onFrame (set). The value provided is not a function`);
    }
  }

  /**
   * @description A function to be called after the class has fully loaded all it's data. `VOLTS.World.init` has executed successfully
   */
  public set onLoad(f: (this: InstanceType<typeof World>, snapshot?: SnapshotToVanilla<SnapshotObjType>) => void) {
    if (typeof f == 'function') {
      this.__sensitive.onLoad = f;
    } else {
      throw new Error(`@ VOLTS.World.onLoad (set). The value provided is not a function`);
    }
  }

  protected signalsToSnapshot_able<values extends Snapshot>(values: values): ObjectToSnapshot_able<values> {
    // The purpose of the prefix & suffix is to ensure any signal values added to the snapshot don't collide.
    // Eg. were vec3 'V1' to be broken up into 'V1x' 'V1y' 'V1z', it'd collide with any signals named 'V1x' 'V1y' 'V1z'
    // Here the names would get converted to 'CONVERTED::V1::x|y|z|w:[UUID]', later pieced back together into a number[]
    // Hopefully reducing any possible error that might arise from the accordion needed to work together with subscribeWithSnapshot
    const prefix = 'CONVERTED';
    const suffix = getUUIDv4();
    const getKey = (k: string, e: string) => `${prefix}::${k}::${e}::${suffix}`;
    // @ts-ignore
    const tmp: ObjectToSnapshot_able<values> = {};
    const keys = Object.keys(values);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const signal: any = values[key]; // any used instead of 14 separate @ts-ignore s
      if (!signal) throw new Error(`@ (static) signalsToSnapshot_able: value[key] is not defined. Key: "${key}"`);
      if (signal.w) {
        // vec4
        tmp[getKey(key, 'W4')] = signal.w;
        tmp[getKey(key, 'Z4')] = signal.z;
        tmp[getKey(key, 'Y4')] = signal.y;
        tmp[getKey(key, 'X4')] = signal.x;
      } else if (signal.z) {
        // vec3
        tmp[getKey(key, 'Z3')] = signal.z;
        tmp[getKey(key, 'Y3')] = signal.y;
        tmp[getKey(key, 'X3')] = signal.x;
      } else if (signal.y) {
        // vec2
        tmp[getKey(key, 'Y2')] = signal.y;
        tmp[getKey(key, 'X2')] = signal.x;
      } else if (signal.xor || signal.concat || signal.pinLastValue) {
        // bool // string // scalar, this very likely unintentionally catches any and all other signal types, even non-scalar(s)
        tmp[getKey(key, 'X1')] = signal;
      } else {
        /**
         * @todo Add link Issue URL
         * @body Add a link to the github repo so the issue can be properly reported
         */
        throw new Error(
          `@ (static) signalsToSnapshot_able: The provided Signal is not defined or is not supported. Key: "${key}"\n\nPlease consider opening an issue/PR`,
        );
      }
    }

    return tmp;
  }

  protected formattedSnapshotToUserFriendly(
    snapshot: ObjectToSnapshot_able<SnapshotObjType>,
  ): SnapshotToVanilla<SnapshotObjType> {
    let keys = Object.keys(snapshot);
    const signals: { [key: string]: [number, string] } = {}; // name, dimension
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const parts: string[] = key.split('::');
      if (parts.length !== 4 || parts[0] !== 'CONVERTED')
        throw new Error(
          `@ VOLTS.World.formattedSnapshotToUserFriendly: Signal is missing the correct prefix, or is missing parts. Key: ${key}. Parts: ${parts}`,
        );
      const name = parts[1];
      // eslint-disable-line no-alert
      const [component, dimension] = parts[2].split('');
      const uuid = parts[3];
      signals[name] = [Number(dimension), uuid];
    }
    keys = Object.keys(signals);
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      const name = keys[i];
      const [dim, uuid] = signals[name];
      if (dim == 4) {
        result[name] = [
          snapshot[`CONVERTED::${name}::X${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Y${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Z${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::W${dim}::${uuid}`],
        ];
      } else if (dim == 3) {
        result[name] = [
          snapshot[`CONVERTED::${name}::X${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Y${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Z${dim}::${uuid}`],
        ];
      } else if (dim == 2) {
        result[name] = [
          snapshot[`CONVERTED::${name}::X${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Y${dim}::${uuid}`],
        ];
      } else if (dim == 1) {
        result[name] = snapshot[`CONVERTED::${name}::X${dim}::${uuid}`];
      } else {
        throw new Error(
          `@ VOLTS.World.formattedSnapshotToUserFriendly: dimension of signals[name] not 1|2|3|4. Dim: ${dim}. Name: ${name}.\n\nPlease report this on Github as an issue\n\nExtra data:\nKeys: ${keys}`,
        );
      }
    }
    // @ts-ignore
    return result;
  }

  public addToSnapshot(obj: Snapshot): void {
    this.__sensitive.formattedValuesToSnapshot = Object.assign(
      this.__sensitive.formattedValuesToSnapshot,
      this.signalsToSnapshot_able(obj),
    );
  }

  public removeFromSnapshot(keys: string | string[]): void {
    const keysToRemove = Array.isArray(keys) ? keys : [keys];
    const snapKeys = Object.keys(this.__sensitive.formattedValuesToSnapshot);
    const matches = snapKeys.filter((k) => keysToRemove.indexOf(k.split('::')[1]) !== -1);

    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      delete this.__sensitive.formattedValuesToSnapshot[match];
    }
  }

  /**
   * @description Returns a 2D Vector representing the bottom right of the screen, in world space coordinates
   */
  public getWorldSpaceScreenBounds(): Vector {
    const sv = (this.__sensitive.userFriendlySnapshot.__volts__internal__screen as number[]).slice(0, 2);
    // ask the spark team about this :D, at the time of writing (v119), this didn't output consistent results
    sv[0] = Math.abs(sv[0]);
    sv[1] = -Math.abs(sv[1]);
    return new Vector(sv);
  }

  /**
   * @description Returns the focal distance of the camera
   */
  public get focalDistance(): number {
    const d = this.snapshot.__volts__internal__focalDistance as number;
    if (d < 0.001) Diagnostics.log('Warning! Using the focal distance during onLoad ');
    return d;
  }

  /**
   * @description Get the total amount of ms elapsed since the instance started running. Note, stopping and resuming the instance means the value won't be in sync with the TimeModule.ms signal value
   */
  public get elapsedTime(): number {
    return this.__sensitive.elapsedTime;
  }

  /**
   * @description A boolean representing whether the instance has successfully loaded
   */
  public get loaded(): boolean {
    return this.__sensitive.loaded;
  }
  /**
   * @description A boolean representing whether the instance is actively running
   */
  public get running(): boolean {
    return this.__sensitive.running;
  }

  public get frameCount(): number {
    return this.__sensitive.frameCount;
  }

  public get snapshot(): SnapshotToVanilla<SnapshotObjType> {
    return this.__sensitive.userFriendlySnapshot;
  }

  protected set snapshot(newSnapshot: SnapshotToVanilla<SnapshotObjType>) {
    this.__sensitive.userFriendlySnapshot = newSnapshot;
  }
}

/**
 * @description The purpose of this function is to be an accessible interface between VOLTS.World & a creator, using the Spark AR Studio command line
 */
export function RUN(): void {
  if (__globalVoltsWorldInstance) {
    __globalVoltsWorldInstance.run();
  } else {
    Diagnostics.log(
      '@ RUN (volts.ts export). __globalVoltsWorldInstance is not defined, meaning no VOLTS.World instance was found',
    );
  }
}

/**
 * @description The purpose of this function is to be an accessible interface between VOLTS.World & a creator, using the Spark AR Studio command line
 */
export function STOP(): void {
  if (__globalVoltsWorldInstance) {
    __globalVoltsWorldInstance.stop();
  } else {
    Diagnostics.log(
      '@ STOP (volts.ts export). __globalVoltsWorldInstance is not defined, meaning no VOLTS.World instance was found',
    );
  }
}

/**
 * @classdesc A flexible, easy to use, N-D vector class
 *
 * Note: this is not optimized for incredible performance, but this gives greater flexibility to users of the framework/lib
 */
export class Vector {
  values: number[];
  readonly dimension: number;
  constructor(...args: [number[]] | [Vector] | number[]) {
    if (args[0] instanceof Vector) {
      return args[0].copy();
    } else if (Array.isArray(args[0])) {
      this.values = args[0];
    } else if (!args[0]) {
      this.values = [0, 0, 0];
    } else {
      this.values = args as number[];
    }
    if (!this.values.every((v) => typeof v == 'number') || this.values.length === 0)
      throw new Error(`@ Vector.constructor: Values provided are not valid`);
    this.dimension = this.values.length;
  }

  public static convertToSameDimVector(v: Vector, ...args: VectorArgRest): Vector {
    if (!args) throw new Error('@ Vector.convertToSameDimVector: No values provided');
    if (args.length == 1) {
      if (args[0] instanceof Vector) {
        if (args[0].dimension == v.dimension) return args[0]; // returns the same vector that was provided
        if (args[0].dimension > v.dimension) return new Vector(args[0].values.slice(0, v.dimension)); // returns a vector that's swizzled to match
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. v.values: ${v.values}.Value(s): ${args}`,
        );
      } else if (typeof args[0] == 'number') {
        return new Vector(new Array(v.dimension).fill(args[0])); // returns a vector filled with the given number
      } else if (Array.isArray(args[0])) {
        if (args[0].length == v.dimension) return new Vector(args[0]); // returns a vector with the given array as components
        if (args[0].length > v.dimension) return new Vector(args[0].slice(0, v.dimension)); // returns a vector with the given array as components (swizzled)
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. v.values: ${v.values}.Value(s): ${args}`,
        );
      } else {
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. v.values: ${v.values}.Value(s): ${args}`,
        );
      }
    } else {
      if (!(Array.isArray(args) && (args as any[]).every((a) => typeof a === 'number')))
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. v.values: ${v.values}.Value(s): ${args}`,
        );
      return new Vector(args as unknown as number[]);
    }
  }

  public static screenToWorld2D(x: number, y: number, focalPlane = true): Vector {
    if (!(__globalVoltsWorldInstance && __globalVoltsWorldInstance.running)) {
      throw new Error(`Vector.screenToWorld can only be called when there's a VOLTS.World instance running`);
    }
    if (!(typeof x == 'number' && typeof y == 'number')) {
      throw new Error(`@ Vector.screenToWorld: values provided are not valid. Values: x: ${x}, y: ${y}`);
    }
    x = (x - 0.5) * 2;
    y = (y - 0.5) * 2;
    const bounds = __globalVoltsWorldInstance.getWorldSpaceScreenBounds();
    return new Vector(
      bounds.values[0] * x,
      bounds.values[1] * y,
      focalPlane ? (__globalVoltsWorldInstance.snapshot.__volts__internal__focalDistance as number) : 0,
    );
  }

  add(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    this.values = this.values.map((v, i) => v + b[i]);
    return this;
  }
  sub(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    this.values = this.values.map((v, i) => v - b[i]);
    return this;
  }
  mul(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    this.values = this.values.map((v, i) => v * b[i]);
    return this;
  }
  div(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    if ([...this.values, ...b].every((v) => typeof v === 'number' && Number.isFinite(v) && v !== 0)) {
      throw new Error(
        `@ Vector.div: values provided are not valid. this value(s): ${this.values}\n\nb value(s): ${b.values}`,
      );
    }
    this.values = this.values.map((v, i) => v / b[i]);
    return this;
  }
  dot(...args: VectorArgRest): number {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    return this.values.map((x, i) => this.values[i] * b[i]).reduce((acc, val) => acc + val);
  }
  distance(...other: VectorArgRest): number {
    const b = Vector.convertToSameDimVector(this, ...other);
    return b.copy().sub(this).mag();
  }
  magSq(): number {
    return this.values.reduce((acc, val) => acc + val * val);
  }
  mag(): number {
    return this.values.reduce((acc, val) => acc + val * val) ** 0.5;
  }
  copy(): Vector {
    return new Vector(this.values);
  }
  normalize(): Vector {
    const len = this.mag();
    len !== 0 && this.mul(1 / len);
    return this;
  }
  // https://stackoverflow.com/a/243984/14899497
  // cross2D(){}
  cross3D(...args: VectorArgRest): Vector {
    if (this.dimension !== 3) throw `Attempting to use Vector.cross3D on non 3D vector. Dim: ${this.dimension}`;
    const b = Vector.convertToSameDimVector(this, ...args);
    return new Vector(
      this.values[1] * b.values[2] - this.values[2] * b.values[1],
      this.values[2] * b.values[0] - this.values[0] * b.values[2],
      this.values[0] * b.values[1] - this.values[1] * b.values[0],
    );
  }
  /** @description 2D Vectors only. Angles in RADIANS*/
  heading(): number {
    return Math.atan2(this.values[1], this.values[0]);
  }
  /** @description 2D Vectors only. Angles in RADIANS @param a Angle in RADIANS to rotate the vector by*/
  rotate(a: number): Vector {
    const newHeading = this.heading() + a;
    const mag = this.mag();
    this.values[0] = Math.cos(newHeading) * mag;
    this.values[1] = Math.sin(newHeading) * mag;
    return this;
  }
  /** @description Test whether two Vectors are equal to each other */
  equals(b: Vector): boolean {
    return b && this.values + '' === b.values + '';
  }
  toString(): string {
    return 'vec' + this.dimension + ':[' + this.values.toString() + ']';
  }
}
