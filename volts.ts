//#region imports

import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive';
import Time from 'Time';
// Persistence may be dynamically imported using `require`
let Persistence: {
  userScope: {
    get: (s: string) => Promise<object>;
    set: (s: string, o: Object) => Promise<boolean>;
    remove: (s: string) => Promise<boolean>;
  };
};

//#endregion

//#region types
export type PublicOnly<T> = Pick<T, keyof T>;

// https://github.com/microsoft/TypeScript/issues/26223#issuecomment-410642988
interface FixedLengthArray<T extends any, L extends number> extends Array<T> {
  '0': T;
  length: L;
}

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
  [Property in keyof Obj]: Obj[Property] extends Vec2Signal
    ? Vector<2>
    : Obj[Property] extends VectorSignal
    ? Vector<3>
    : Obj[Property] extends Vec4Signal
    ? Vector<4>
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
 * @param created The time (in elapsed Volts.World time, not UNIX) when the function was created
 * @param onFramePerformanceData onFramePerformanceData corresponding to the frame when the function was called
 */
type TimedEventFunction = (
  this: any,
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

//#region World

export enum PRODUCTION_MODES {
  'PRODUCTION' = 'PRODUCTION',
  'DEV' = 'DEV',
  'NO_AUTO' = 'NO_AUTO',
}

interface InternalSignals {
  __volts__internal__time: number;
  __volts__internal__focalDistance: number;
  __volts__internal__screen: Vector;
}

interface InternalWorldData {
  initPromise: () => Promise<void>;
  loaded: boolean;
  running: boolean;
  events: { [key: string]: Function[] };
  timedEvents: TimedEvent[];
  elapsedTime: number;
  frameCount: number;
  FLAGS: { stopTimeout: boolean; lockInternalSnapshotOverride: boolean };
  formattedValuesToSnapshot: ObjectToSnapshot_able<Snapshot>;
  userFriendlySnapshot: SnapshotToVanilla<Snapshot> & InternalSignals;
  onLoad: (snapshot?: SnapshotToVanilla<Snapshot>, data?: onFramePerformanceData) => void;
  onFrame: (snapshot?: SnapshotToVanilla<Snapshot>, data?: onFramePerformanceData) => void;
  Camera: Camera;
}

interface WorldConfig {
  mode: keyof typeof PRODUCTION_MODES;
  assets?: { [key: string]: Promise<any | any[]> };
  snapshot?: Snapshot;
  loadStates?: State<any> | State<any>[];
}

class VoltsWorld<WorldConfigParams extends WorldConfig> {
  private static instance: VoltsWorld<any>;
  private static userConfig: WorldConfig;
  protected internalData: InternalWorldData;
  public assets: {
    [Prop in keyof WorldConfigParams['assets']]: WorldConfigParams['assets'][Prop] extends PromiseLike<infer C>
      ? C extends ArrayLike<any>
        ? C
        : Array<C>
      : never;
  };
  public mode: keyof typeof PRODUCTION_MODES;

  private constructor() {
    this.mode = VoltsWorld.userConfig.mode;
    // @ts-ignore
    this.assets = {};
    this.internalData = {
      initPromise: this.init.bind(this, VoltsWorld.userConfig.assets, VoltsWorld.userConfig.loadStates),
      running: false,
      loaded: false,
      events: {},
      elapsedTime: 0,
      frameCount: 0,
      timedEvents: [],
      // @ts-ignore missing props are assigned at runtime
      userFriendlySnapshot: {},
      formattedValuesToSnapshot: this.signalsToSnapshot_able(VoltsWorld.userConfig.snapshot),
      FLAGS: {
        stopTimeout: false,
        lockInternalSnapshotOverride: false,
      },
      onLoad: null,
      onFrame: null,
      Camera: null,
    };
    // Making the promise public makes it easier to test with Jest
    // Using Object.define so it doesn't show on the type def & doesn't raise ts errors
    Object.defineProperty(this, 'rawInitPromise', {
      value: this.internalData.initPromise(),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  // @todo add uglier but user-friendlier long-form type
  static getInstance<WorldConfigParams extends WorldConfig>(config?: WorldConfigParams): VoltsWorld<WorldConfigParams> {
    if (!VoltsWorld.instance) {
      if (!config)
        throw new Error(
          `@ VoltsWorld.getInstance: 'config' was not provided, but is required when creating the first instance`,
        );
      if (!config.mode)
        throw new Error(
          `@ VoltsWorld.getInstance: 'config.mode' was not provided, but is required when creating the first instance`,
        );
      // @ts-ignore
      if (!Object.values(PRODUCTION_MODES).includes(config.mode))
        throw new Error(
          `@ VoltsWorld.getInstance: 'config.mode' was provided, but was not valid.\n\nAvailable modes are: ${Object.values(
            PRODUCTION_MODES,
          )}`,
        );

      config.loadStates = config.loadStates || [];
      Array.isArray(config.loadStates) ? config.loadStates : [config.loadStates];
      config.assets = config.assets || {};
      config.snapshot = config.snapshot || {};
      VoltsWorld.userConfig = config;
      VoltsWorld.instance = new VoltsWorld();
    }
    return VoltsWorld.instance;
  }

  static devClear() {
    VoltsWorld.userConfig = undefined;
    VoltsWorld.instance = undefined;
  }

  private async init(assets: any[], states: State<any>[]): Promise<void> {
    this.internalData.Camera = (await Scene.root.findFirst('Camera')) as Camera;
    this.addToSnapshot({
      __volts__internal__focalDistance: this.internalData.Camera.focalPlane.distance,
      __volts__internal__time: Time.ms,
      __volts__internal__screen: Scene.unprojectToFocalPlane(Reactive.point2d(0, 0)),
    });
    this.internalData.FLAGS.lockInternalSnapshotOverride = true;

    // load states
    // States are automatically loaded when created
    // @ts-ignore loadState is purposely not part of the type
    const loadStateArr = await Promise.all(states.map((s: State<any>) => s.loadState()));

    const keys = Object.keys(assets);
    const getAssets: any[] = await Promise.all([...keys.map((n) => assets[n])]);
    for (let k = 0; k < keys.length; k++) {
      if (!getAssets[k]) throw new Error(`@ Volts.World.init: Object(s) not found. Key: "${keys[k]}"`);
      // @ts-ignore
      // To be properly typed out. Unfortunately, i think loading everything at once with an array ([...keys.map((n) =>...) would make it very challenging...
      // Might be best to ts-ignore or `as unknown` in this case
      this.assets[keys[k]] = (Array.isArray(getAssets[k]) ? getAssets[k] : [getAssets[k]]).sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      // .map(objBody=>{ return new Object3D(objBody) });
    }
    this.internalData.loaded = true;
    if (this.mode !== PRODUCTION_MODES.NO_AUTO) this.run();
  }
  public run(): boolean {
    if (this.internalData.running) return false;

    this.internalData.running = true;
    // Fun fact: Time.setTimeoutWithSnapshot will run even if the Studio is paused
    // Meaning this would keep executing, along with any onFrame function
    // For DEV purposes, the function will not execute if it detects the studio is on pause
    // This won't be the case when the mode is set to PROD, in case some device has undoc.b. within the margin of error (3 frames)
    const lastThreeFrames: number[] = [];
    let offset = 0;

    const loop = () => {
      Time.setTimeoutWithSnapshot(
        this.internalData.formattedValuesToSnapshot,
        (_: number, snapshot: any) => {
          //#region Snapshot
          snapshot = this.formattedSnapshotToUserFriendly(snapshot);
          this.internalData.userFriendlySnapshot = snapshot;
          //#endregion

          //#region Capture data & analytics
          if (!lastThreeFrames[0]) offset = this.internalData.userFriendlySnapshot.__volts__internal__time || 0;
          const delta =
            (this.internalData.userFriendlySnapshot.__volts__internal__time || 0) -
            offset -
            this.internalData.elapsedTime;
          const fps = Math.round((1000 / delta) * 10) / 10;
          this.internalData.elapsedTime += delta;

          if (lastThreeFrames.length > 2) {
            lastThreeFrames[0] = lastThreeFrames[1];
            lastThreeFrames[1] = lastThreeFrames[2];
            lastThreeFrames[2] = this.internalData.userFriendlySnapshot.__volts__internal__time;
          } else {
            lastThreeFrames.push(this.internalData.userFriendlySnapshot.__volts__internal__time);
          }
          //#endregion

          //#region Duct tape
          // For DEV purposes, the function will not execute if it detects the studio is on pause
          if (
            lastThreeFrames[0] === lastThreeFrames[1] &&
            lastThreeFrames[1] === lastThreeFrames[2] &&
            this.mode == PRODUCTION_MODES.DEV
          )
            return loop();
          //#endregion

          //#region onLoad function
          this.internalData.onLoad &&
            this.mode !== PRODUCTION_MODES.NO_AUTO &&
            this.internalData.frameCount === 0 &&
            this.internalData.onLoad.apply(this, this.internalData.userFriendlySnapshot);
          //#endregion

          //#region onRun/onFrame
          const onFramePerformanceData = { fps, delta, frameCount: this.internalData.frameCount };
          this.runTimedEvents(onFramePerformanceData);
          this.internalData.onFrame &&
            this.internalData.onFrame.apply(this, [this.internalData.userFriendlySnapshot, onFramePerformanceData]);
          this.internalData.frameCount += 1;
          //#endregion

          if (!this.internalData.FLAGS.stopTimeout) return loop();
        },
        0,
      );
    };

    loop();

    return true;
  }
  get loaded(): boolean {
    return this.internalData.loaded;
  }
  get running(): boolean {
    return this.internalData.running;
  }
  get frameCount(): number {
    return this.internalData.frameCount;
  }
  get snapshot(): SnapshotToVanilla<WorldConfigParams['snapshot']> & {[key: string]: any} {
    return this.internalData.userFriendlySnapshot;
  }
  public forceAssetReload(): Promise<void> {
    return this.internalData.initPromise();
  }
  public stop({ clearTimedEvents = false } = { clearTimedEvents: false }): boolean {
    if (!this.internalData.running) return false;

    this.internalData.running = false;
    if (clearTimedEvents) this.internalData.timedEvents = [];
    this.internalData.FLAGS.stopTimeout = true;

    return true;
  }
  /**
   * @author Andrey Sitnik
   * @param event The event name.
   * @param args The arguments for listeners.
   * @see https://github.com/ai/nanoevents
   */
  public emitEvent(event: string, ...args: any[]): void {
    (this.internalData.events[event] || []).forEach((i) => i(...args));
  }
  /**
   * @author Andrey Sitnik
   * @param event The event name.
   * @param cb The listener function.
   * @returns Unbind listener from event.
   * @see https://github.com/ai/nanoevents
   */
  public onEvent(event: string, cb: (...args: any[]) => void): () => void {
    (this.internalData.events[event] = this.internalData.events[event] || []).push(cb);
    return () => (this.internalData.events[event] = (this.internalData.events[event] || []).filter((i) => i !== cb));
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
    if (!this.internalData.running)
      Diagnostics.log(
        'Warning @ Volts.World.setDebounce: created a debounce while the current instance is not running',
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
      created: this.internalData.elapsedTime,
      lastCall: this.internalData.elapsedTime,
      count: 0,
      delay: ms,
      recurring,
      cb,
    };
    this.internalData.timedEvents.push(event);
    return {
      clear: () => (this.internalData.timedEvents = (this.internalData.timedEvents || []).filter((i) => i !== event)),
    };
  }
  private runTimedEvents(onFramePerformanceData: onFramePerformanceData) {
    this.internalData.timedEvents = this.internalData.timedEvents.sort(
      (e1, e2) => e1.lastCall + e1.delay - (e2.lastCall + e2.delay),
    );
    let i = this.internalData.timedEvents.length;
    while (i--) {
      const event = this.internalData.timedEvents[i];
      if (event.lastCall + event.delay < this.internalData.elapsedTime) {
        event.cb.apply(this, [
          this.internalData.elapsedTime - event.created,
          event.count,
          event.lastCall,
          event.created,
          onFramePerformanceData,
        ]);
        this.internalData.timedEvents[i].count++;
        if (event.recurring) {
          this.internalData.timedEvents[i].lastCall = this.internalData.elapsedTime;
        } else {
          this.internalData.timedEvents.splice(i, 1);
        }
      }
    }
  }
  // this: InstanceType<typeof World> / any
  // Technically, the onFrame function can have access to the private & protected properties,
  // as long as it's declared as an arrow function, but typing it out that way would mean
  // users would be presented to the raw/non abstracted code, which might be confusing.
  // I do not personally think completely isolating the onFrame/onLoad function calls is a good idea,
  // since this way, an arrow function would allow more advanced users access to the private/protected fields,
  // while the type makes it unlikely that anyone not familiar with the code base might accidentally change something.
  // To get the type of the context an arrow function would have, the line below can be changed to
  // this: typeof Volts.World.prototype
  /**
   * @description A function to be called every frame
   */
  public set onFrame(
    f: (this: any, snapshot?: SnapshotToVanilla<WorldConfigParams['snapshot']> & {[key: string]: any}, data?: onFramePerformanceData) => void,
  ) {
    if (typeof f == 'function') {
      this.internalData.onFrame = f;
    } else {
      throw new Error(`@ Volts.World.onFrame (set). The value provided is not a function`);
    }
  }

  /**
   * @description A function to be called after the class has fully loaded all it's data. `Volts.World.init` has executed successfully
   */
  public set onLoad(f: (this: any, snapshot?: SnapshotToVanilla<WorldConfigParams['snapshot']> & {[key: string]: any}) => void) {
    if (typeof f == 'function') {
      this.internalData.onLoad = f;
    } else {
      throw new Error(`@ Volts.World.onLoad (set). The value provided is not a function`);
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
        // bool // string // scalar, this very likely unintentionally catches any and all other signal types, even the ones that can't be snapshot'ed
        tmp[getKey(key, 'X1')] = signal;
      } else {
        throw new Error(
          `@ (static) signalsToSnapshot_able: The provided Signal is not defined or is not supported. Key: "${key}"\n\nPlease consider opening an issue/PR: https://github.com/tomaspietravallo/sparkar-volts/issues`,
        );
      }
    }

    return tmp;
  }

  protected formattedSnapshotToUserFriendly(snapshot: ObjectToSnapshot_able<Snapshot>): SnapshotToVanilla<Snapshot> {
    let keys = Object.keys(snapshot);
    const signals: { [key: string]: [number, string] } = {}; // name, dimension
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const parts: string[] = key.split('::');
      if (parts.length !== 4 || parts[0] !== 'CONVERTED')
        throw new Error(
          `@ Volts.World.formattedSnapshotToUserFriendly: Signal is missing the correct prefix, or is missing parts. Key: ${key}. Parts: ${parts}`,
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
        result[name] = new Vector(
          snapshot[`CONVERTED::${name}::X${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Y${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Z${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::W${dim}::${uuid}`],
        );
      } else if (dim == 3) {
        result[name] = new Vector(
          snapshot[`CONVERTED::${name}::X${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Y${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Z${dim}::${uuid}`],
        );
      } else if (dim == 2) {
        result[name] = new Vector(
          snapshot[`CONVERTED::${name}::X${dim}::${uuid}`],
          snapshot[`CONVERTED::${name}::Y${dim}::${uuid}`],
        );
      } else if (dim == 1) {
        result[name] = snapshot[`CONVERTED::${name}::X${dim}::${uuid}`];
      } else {
        throw new Error(
          `@ Volts.World.formattedSnapshotToUserFriendly: dimension of signals[name] not 1|2|3|4. Dim: ${dim}. Name: ${name}.\n\nPlease report this on Github as an issue\n\nExtra data:\nKeys: ${keys}`,
        );
      }
    }
    // @ts-ignore
    return result;
  }

  public addToSnapshot(obj: Snapshot): void {
    this.internalData.formattedValuesToSnapshot = Object.assign(
      this.internalData.formattedValuesToSnapshot,
      this.signalsToSnapshot_able(obj),
    );
  }

  public removeFromSnapshot(keys: string | string[]): void {
    const keysToRemove = Array.isArray(keys) ? keys : [keys];
    const snapKeys = Object.keys(this.internalData.formattedValuesToSnapshot);
    const matches = snapKeys.filter((k) => keysToRemove.indexOf(k.split('::')[1]) !== -1);

    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      delete this.internalData.formattedValuesToSnapshot[match];
    }
  }

  /**
   * @description Returns a 2D Vector representing the bottom right of the screen, in world space coordinates
   */
  public getWorldSpaceScreenBounds(): Vector<2> {
    // ask the spark team about this :D, at the time of writing (v119), this didn't output consistent results
    return this.internalData.userFriendlySnapshot.__volts__internal__screen.copy().abs().mul(1, -1);
  }
}

//#endregion

//#region Vector

type VectorArgRest<D extends number = any> = [number] | [number[]] | number[] | [Vector<D>];

interface NDVectorInstance<D extends number> {
  values: number[];
  readonly dimension: number;
  add(...args: VectorArgRest): Vector<D>;
  sub(...args: VectorArgRest): Vector<D>;
  mul(...args: VectorArgRest): Vector<D>;
  div(...args: VectorArgRest): Vector<D>;
  dot(...args: VectorArgRest): number;
  distance(...other: VectorArgRest): number;
  magSq(): number;
  mag(): number;
  abs(): Vector<D>;
  copy(): Vector<D>;
  normalize(): Vector<D>;
  equals(b: Vector<D>): boolean;
  toString(): string;
}

interface Vector2DInstance {
  get x(): number;
  set x(x: number);
  get y(): number;
  set y(y: number);
  heading(): number;
  rotate(a: number): Vector<2>;
}

interface Vector3DInstance {
  get z(): number;
  set z(z: number);
  cross(...args: VectorArgRest<3>): Vector<3>;
}

interface Vector4DInstance {
  get w(): number;
  set w(w: number);
}

interface NDVector {
  new <uD extends number, args extends VectorArgRest = FixedLengthArray<number, uD> | [number[]]>(
    ...args: args
  ): args extends undefined[]
    ? Vector<3>
    : args extends [number[]]
    ? Vector<uD>
    : args extends FixedLengthArray<number, infer D>
    ? // typeof args[0] extends Array<any> ? Vector<uD> :
      D extends uD
      ? Vector<D>
      : never
    : args extends [Vector<infer D>]
    ? D extends uD
      ? Vector<D>
      : never
    : never;
  convertToSameDimVector<D extends number>(dim: D, ...args: VectorArgRest): Vector<D>;
  screenToWorld(x: number, y: number, focalPlane: true): Vector<3>;
}

type getVecTypeForD<D extends number> = D extends 1
  ? {}
  : D extends 2
  ? Vector2DInstance
  : D extends 3
  ? Vector3DInstance
  : D extends 4
  ? Vector4DInstance
  : Vector2DInstance & Vector3DInstance & Vector4DInstance;

export type Vector<D extends number> = NDVectorInstance<D> & getVecTypeForD<D>;

/**
 * @classdesc A flexible, easy to use, N-D vector class
 *
 * Note: this is not optimized for incredible performance, but it provides a lot of flexibility to users of the framework/lib
 */

export const Vector = function <D extends number, args extends VectorArgRest = []>(
  this: Vector<number>,
  ...args: args
): Vector<D> {
  if (args[0] instanceof Vector) {
    return args[0].copy();
  } else if (Array.isArray(args[0])) {
    this.values = args[0];
  } else if (args.length === 1) {
    this.values = [args[0], args[0], args[0]];
  } else if (!args[0]) {
    this.values = [0, 0, 0];
  } else {
    this.values = args as number[];
  }
  if (!this.values.every((v) => typeof v == 'number') || this.values.length === 0)
    throw new Error(`@ Vector.constructor: Values provided are not valid`);
  // @ts-expect-error
  this.dimension = this.values.length;

  // prettier-ignore
  Object.defineProperties(this, {
    x: {
      get:    () =>{                                                                                    return this.values[0]},
      set:    (x)=>{                                                                                    this.values[0] = x}},
    y: {
      get:    () =>{if (this.dimension < 2) throw new Error(`Cannot get Vector.y, vector is a scalar`); return this.values[1]},
      set:    (y)=>{if (this.dimension < 2) throw new Error(`Cannot get Vector.y, vector is a scalar`); this.values[1] = y}},
    z: {
      get:    () =>{if (this.dimension < 3) throw new Error(`Cannot get Vector.z, vector is not 3D`);   return this.values[2]},
      set:    (z)=>{if (this.dimension < 3) throw new Error(`Cannot get Vector.z, vector is not 3D`);   this.values[2] = z}},
    w: {
      get:    () =>{if (this.dimension < 4) throw new Error(`Cannot get Vector.w, vector is not 4D`);   return this.values[3]},
      set:    (w)=>{if (this.dimension < 4) throw new Error(`Cannot get Vector.w, vector is not 4D`);   this.values[3] = w}},
  });

  return this;
} as unknown as NDVector;

//#region static
Vector.convertToSameDimVector = function <D extends number>(dim: D, ...args: VectorArgRest): Vector<D> {
  if (!args) throw new Error('@ Vector.convertToSameDimVector: No values provided');
  if (args.length == 1) {
    if (args[0] instanceof Vector) {
      if (args[0].dimension == dim) return args[0]; // returns the same vector that was provided
      if (args[0].dimension > dim) return new Vector(args[0].values.slice(0, dim)); // returns a vector that's swizzled to match
      throw new Error(
        `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. dim: ${dim}. args(s): ${args}`,
      );
    } else if (typeof args[0] == 'number') {
      return new Vector(new Array(dim).fill(args[0])); // returns a vector filled with the given number
    } else if (Array.isArray(args[0])) {
      if (args[0].length == dim) return new Vector(args[0]); // returns a vector with the given array as components
      if (args[0].length > dim) return new Vector(args[0].slice(0, dim)); // returns a vector with the given array as components (swizzled)
      throw new Error(
        `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. dim: ${dim}. args(s): ${args}`,
      );
    } else {
      throw new Error(
        `@ Vector.convertToVector: values provided are not valid. dim: ${dim}. args(s): ${args}`,
      );
    }
  } else {
    if (!(Array.isArray(args) && (args as any[]).every((a) => typeof a === 'number')))
      throw new Error(
        `@ Vector.convertToVector: values provided are not valid. dim: ${dim}. args(s): ${args}`,
      );
    return new Vector(args as unknown as number[]);
  }
};
Vector.screenToWorld = function (x: number, y: number, focalPlane = true): Vector<3> {
  const Instance = VoltsWorld.getInstance();
  if (!(Instance && Instance.running)) {
    throw new Error(`Vector.screenToWorld can only be called when there's a Volts.World instance running`);
  }
  if (!(typeof x == 'number' && typeof y == 'number')) {
    throw new Error(`@ Vector.screenToWorld: values provided are not valid. Values: x: ${x}, y: ${y}`);
  }
  x = (x - 0.5) * 2;
  y = (y - 0.5) * 2;
  const bounds = Instance.getWorldSpaceScreenBounds();
  return new Vector(
    bounds.values[0] * x,
    bounds.values[1] * y,
    focalPlane ? (Instance.snapshot.__volts__internal__focalDistance as unknown as number) : 0,
  );
};
//#endregion
//#region common
Vector.prototype.add = function <D extends number>(this: Vector<D>, ...args: VectorArgRest): Vector<D> {
  const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
  this.values = this.values.map((v, i) => v + b[i]);
  return this;
};
Vector.prototype.sub = function <D extends number>(this: Vector<D>, ...args: VectorArgRest): Vector<D> {
  const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
  this.values = this.values.map((v, i) => v - b[i]);
  return this;
};
Vector.prototype.mul = function <D extends number>(this: Vector<D>, ...args: VectorArgRest): Vector<D> {
  const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
  this.values = this.values.map((v, i) => v * b[i]);
  return this;
};
Vector.prototype.div = function <D extends number>(this: Vector<D>, ...args: VectorArgRest): Vector<D> {
  const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
  if (![...this.values, ...b].every((v) => typeof v === 'number' && Number.isFinite(v) && v !== 0)) {
    throw new Error(`@ Vector.div: values provided are not valid. this value(s): ${this.values}\n\nb value(s): ${b}`);
  }
  this.values = this.values.map((v, i) => v / b[i]);
  return this;
};
Vector.prototype.dot = function <D extends number>(this: Vector<D>, ...args: VectorArgRest): number {
  const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
  return this.values.map((x, i) => this.values[i] * b[i]).reduce((acc, val) => acc + val);
};
Vector.prototype.distance = function <D extends number>(this: Vector<D>, ...other: VectorArgRest): number {
  const b = Vector.convertToSameDimVector(this.dimension, ...other);
  return b.copy().sub(this).mag();
};
Vector.prototype.magSq = function <D extends number>(this: Vector<D>): number {
  return this.values.reduce((acc, val) => acc + val * val);
};
Vector.prototype.mag = function <D extends number>(this: Vector<D>): number {
  return this.values.map((v) => v * v).reduce((acc, val) => acc + val) ** 0.5;
};
Vector.prototype.abs = function <D extends number>(this: Vector<D>): Vector<D> {
  this.values = this.values.map((v) => (v < 0 ? -v : v));
  return this;
};
Vector.prototype.normalize = function <D extends number>(this: Vector<D>): Vector<D> {
  const len = this.mag();
  len !== 0 && this.mul(1 / len);
  return this;
};
Vector.prototype.copy = function <D extends number>(this: Vector<D>): Vector<D> {
  return new Vector(this.values);
};
/** @description Test whether two Vectors are equal to each other */
Vector.prototype.equals = function <D extends number>(this: Vector<D>, b: Vector<number>) {
  return b && this.dimension === b.dimension && this.values.every((v, i) => v === b.values[i]);
};
Vector.prototype.toString = function <D extends number>(): string {
  return `Vector<${this.dimension}> [${this.values.toString()}]`;
};
//#endregion
//#region Vector<3>
Vector.prototype.cross = function (this: Vector<3>, ...args: VectorArgRest): Vector<3> {
  if (this.dimension !== 3) throw `Attempting to use Vector<3>.cross on non 3D vector. Dim: ${this.dimension}`;
  const b = Vector.convertToSameDimVector(3, ...args);
  return new Vector(
    this.values[1] * b.values[2] - this.values[2] * b.values[1],
    this.values[2] * b.values[0] - this.values[0] * b.values[2],
    this.values[0] * b.values[1] - this.values[1] * b.values[0],
  );
};
//#endregion
//#region Vector<2>
Vector.prototype.heading = function <D extends number>(): number {
  return Math.atan2(this.values[1], this.values[0]);
};
Vector.prototype.rotate = function <D extends number>(a: number): Vector<D> {
  const newHeading = this.heading() + a;
  const mag = this.mag();
  this.values[0] = Math.cos(newHeading) * mag;
  this.values[1] = Math.sin(newHeading) * mag;
  return this;
};
//#endregion

//#endregion

//#region State

/**
 * @description Provides an easy interface to the Persistence module
 *
 * **This REQUIRES you to go to `Project > Capabilities > Persistence > ::Whitelist the persistenceKey::`**
 *
 * To whitelist a key, write it into the field (case sensitive), if there are multiple keys, separate them with spaces
 *
 * This feature is still on an early state
 * @see https://github.com/tomaspietravallo/sparkar-volts/issues/4
 */
export class State<Data extends { [key: string]: Vector<number> | number | string | boolean }> {
  protected _data: { [Property in keyof Data]+?: Data[Property] };
  protected key: string;
  protected loaded: boolean;
  constructor(persistenceKey: string) {
    if (!persistenceKey) {
      throw new Error(`@ Volts.State: argument 'persistenceKey' is not defined`);
    } else {
      this.key = persistenceKey;
    }
    try {
      if (!Persistence) Persistence = require('Persistence');
    } catch {
      throw new Error(
        `@ Volts.State: Persistence is not enabled as a capability, or is not available in the current target platforms.\n\nTo use Volts.State, please go to your project capabilities, inspect the target platforms, and remove the ones that don't support "Persistence"`,
      );
    }
    // @ts-ignore
    this._data = {};

    // don't show as part of the loadState type, while remaining public
    Object.defineProperty(this, 'loadState', {
      value: async (): Promise<void> => {
        // Brief explanation for the use of Promise.race
        // https://github.com/tomaspietravallo/sparkar-volts/issues/4
        const loadedDataFromPersistence: { data?: string } = await Promise.race([
          // persistence
          Persistence.userScope.get(this.key).catch(() => {
            return new Error(
              `@ Volts.State: The key provided: "${this.key}" is not whitelisted.\n\ngo to Project > Capabilities > Persistence > then write the key into the field (case sensitive). If there are multiple keys, separate them with spaces`,
            );
          }),
          // timeout
          new Promise((resolve) => {
            Time.setTimeout(resolve, 350);
          }),
        ]);

        // Avoid an unhandled promise rejection (👆 .catch)
        if (loadedDataFromPersistence instanceof Error) {
          throw loadedDataFromPersistence;
        }

        if (loadedDataFromPersistence && loadedDataFromPersistence.data) {
          this._data = JSON.parse(loadedDataFromPersistence.data);
          const keys = Object.keys(this._data);
          for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            // @ts-ignore
            if (this._data[key].dimension && Array.isArray(this._data[key].values)) {
              // @ts-ignore
              this._data[key] = new Vector(this._data[key].values);
            }
          }
        }
        this.loaded = true;
      },
      enumerable: false,
      writable: false,
      configurable: false,
    });

    Object.defineProperty(this, 'rawConstructorPromise', {
      // @ts-ignore
      value: this.loadState(),
      enumerable: false,
      writable: false,
      configurable: false,
    });

    Object.defineProperty(this, 'wipe', {
      value: () => {
        this._data = {};
      },
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  protected setPersistenceAPI(): void {
    Persistence.userScope.set(this.key, { data: JSON.stringify(this._data) });
  }

  /**
   * @todo Add support for Reactive values
   * @body Improve the use experience by allowing Reactive values to be used as values
   */
  setKey(key: keyof Data, value: Vector<number> | number | string | boolean): void {
    // @ts-ignore
    this.data[key] = value instanceof Vector ? value.copy() : value;
    // rate limit (?)
    this.setPersistenceAPI();
  }

  get data(): { [Property in keyof Data]+?: Data[Property] } {
    return this._data;
  }
}

//#endregion

//#region exports

export const World = {
  getInstance: VoltsWorld.getInstance,
  devClear: VoltsWorld.devClear,
};

export default {
  World: World,
  Vector: Vector,
  State: State,
  PRODUCTION_MODES: PRODUCTION_MODES,
};

//#endregion
