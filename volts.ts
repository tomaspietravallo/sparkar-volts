//#region imports
import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive';
import Time from 'Time';

// 👇 may be dynamically imported using `require`
let Persistence: {
    userScope: {
      get: (s: string) => Promise<object>;
      set: (s: string, o: Object) => Promise<boolean>;
      remove: (s: string) => Promise<boolean>;
    };
  },
  Multipeer: {},
  Blocks: {
    instantiate: (blockOrName: string, initialState: {[key: string]: any})=>Promise<BlockSceneRoot>
    assets: {
      findFirst: (name: string)=>Promise<any>
    }
  }
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

type ObjectToSnapshotable<Obj> = {
  [Property in keyof Obj as `${Obj[Property] extends ISignal
    ? `CONVERTED::${Property extends string ? Property : never}::${getDimsOfSignal<Obj[Property]>}::UUID` & string
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

//#region constants
const PI = 3.14159265359;
const TWO_PI = 6.28318530718;
//#endregion

//#region utils
//#region getUUIDv4
/**
 * @see https://stackoverflow.com/a/2117523/14899497
 */
function getUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
//#endregion

//#region promiseAllConcurrent
/** @author atolkachiov */
/** @see https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b#gistcomment-3591045 */
const pAll = async (queue: Promise<any>[], concurrency: number, areFn: boolean) => {
  let index = 0;
  const results = [];

  // Run a pseudo-thread
  const execThread = async () => {
    while (index < queue.length) {
      const curIndex = index++;
      // Use of `curIndex` is important because `index` may change after await is resolved
      // @ts-expect-error
      results[curIndex] = await (areFn ? queue[curIndex]() : queue[curIndex]);
    }
  };

  // Start threads
  const threads = [];
  for (let thread = 0; thread < concurrency; thread++) {
    threads.push(execThread());
  }
  await Promise.all(threads);
  return results;
};
const promiseAllConcurrent =
  (n: number, areFn: boolean) =>
  (list: Promise<any>[]): Promise<any[]> =>
    pAll(list, n, areFn);
//#endregion

//#region report
type LogLevels = 'log' | 'warn' | 'error' | 'throw';

interface Reporters {
  asIssue: (lvl?: LogLevels) => void;
  asBackwardsCompatibleDiagnosticsError: ()=>void;
}

type reportFn = ((...msg: string[] | [object]) => Reporters) & {
  getSceneInfo: ({
    getMaterials,
    getTextures,
    getIdentifiers,
    getPositions,
  }?: {
    getMaterials?: boolean;
    getTextures?: boolean;
    getIdentifiers?: boolean;
    getPositions?: boolean;
  }) => Promise<string>;
};

const prettifyJSON = (obj: Object, spacing = 2) => JSON.stringify(obj, null, spacing);

// (!) doesn't get hoisted up
export const report: reportFn = function report(...msg: string[] | [object]): Reporters {
  let message: any;
  // provides a bit of backwards compatibility, keeps support at (112, 121]
  const toLogLevel = (lvl: LogLevels, msg: string | object) => {
    if (lvl === 'throw') {
      throw msg;
    } else {
      Diagnostics[lvl] ? Diagnostics[lvl](msg) : Diagnostics.warn(msg + `\n\n[[logger not found: ${lvl}]]`);
    }
  };

  if (msg.length > 1) {
    message = msg.join('\n');
  } else {
    message = msg[0];
  }

  return {
    asIssue: (lvl: LogLevels = 'warn') => {
      message = new Error(`${message}`);
      const info = `This issue arose during execution.\nIf you believe it's related to VOLTS itself, please report it as a Github issue here: https://github.com/tomaspietravallo/sparkar-volts/issues\nPlease make your report detailed (include this message too!), and if possible, include a package of your current project`;
      message = `Message: ${message.message ? message.message : message}\n\n.Info: ${info}\n\nStack: ${
        message.stack ? message.stack : undefined
      }`;
      toLogLevel(lvl, message);
    },
    asBackwardsCompatibleDiagnosticsError: () => {
      Diagnostics.error ? Diagnostics.error(message) : Diagnostics.warn ? Diagnostics.warn(message) : Diagnostics.log(message)
    },
  };
} as any;

report.getSceneInfo = async function (
  { getMaterials, getTextures, getIdentifiers, getPositions } = {
    getMaterials: true,
    getTextures: true,
    getIdentifiers: true,
    getPositions: true,
  },
): Promise<string> {
  const Instance = World.getInstance(false);
  const info: { [key: string]: any } = {};
  if (Instance && Instance.loaded) {
    const sceneData: { [key: string]: any } = {};
    const keys = Object.keys(Instance.assets);
    // loop over all assets, may include scene objects/textures/materials/others
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const element = Instance.assets[key];
      const getElementData = async (e: any) => {
        if (!e) return { warning: 'no-element-was-found' };

        const data: { [key: string]: any } = {};
        let mat, tex;

        data['name'] = e.name;
        data['hidden'] = e.hidden.pinLastValue();

        if (getIdentifiers) data['identifier'] = e.identifier;

        if (getPositions) {
          data['position'] = Vector.fromSignal(e.transform.position).toString(5);
        }

        if (getMaterials || getTextures) {
          mat = e.getMaterial ? (await e.getMaterial()) || {} : {};
          if (getMaterials) data['material'] = mat.name || 'undefined';
          if (getMaterials && getIdentifiers) data['material-id'] = mat.identifier || 'undefined';
        }

        if (getTextures) {
          tex = mat && mat.getDiffuse ? (await mat.getDiffuse()) || {} : {};
          data['texture'] = tex.name || 'undefined';
          if (getIdentifiers) data['texture-id'] = tex.identifier || 'undefined';
        }
        return data;
      };
      if (Array.isArray(element) && element.length > 1) {
        sceneData[key] = await promiseAllConcurrent(10, true)(element.map((e) => getElementData.bind(this, e)));
      } else if (element) {
        sceneData[key] = await getElementData(element[0]);
      } else {
        sceneData[key] = `obj[key] is possibly undefined. key: ${key}`;
      }
    }
    info['scene'] = sceneData;
  } else {
    info['scene'] = 'no instance was found, or the current instance has not loaded yet';
  }
  info['modules'] = {
    Persistence: !!Persistence,
    Multipeer: !!Multipeer,
    dynamicInstancing: !!Scene.create,
  };
  return prettifyJSON(info);
};

//#endregion

//#region transformAcrossSpaces
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
  __volts__internal__screen: Vector<3>;
}

interface Events<S extends Snapshot> {
  load: (snapshot?: SnapshotToVanilla<S>) => void;
  frameUpdate: (snapshot?: SnapshotToVanilla<S>, data?: onFramePerformanceData) => void;
  [event: string]: (...args: any) => void;
}

interface InternalWorldData {
  initPromise: () => Promise<void>;
  loaded: boolean;
  running: boolean;
  events: Partial<{ [E in keyof Events<Snapshot>]: Events<Snapshot>[E][] }>;
  timedEvents: TimedEvent[];
  elapsedTime: number;
  frameCount: number;
  FLAGS: { stopTimeout: boolean; lockInternalSnapshotOverride: boolean };
  formattedValuesToSnapshot: ObjectToSnapshotable<Snapshot>;
  userFriendlySnapshot: SnapshotToVanilla<Snapshot> & InternalSignals;
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
  static subscriptions: Function[];
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
    // @ts-expect-error
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

    for (let index = 0; index < VoltsWorld.subscriptions.length; index++) {
      VoltsWorld.subscriptions[index]();
    }
  }
  // @todo add uglier but user-friendlier long-form type
  static getInstance<WorldConfigParams extends WorldConfig>(
    config?: WorldConfigParams | boolean,
  ): VoltsWorld<WorldConfigParams> {
    if (config === false) return VoltsWorld.instance;
    if (!VoltsWorld.instance) {
      if (typeof config !== 'object' || config === null)
        throw new Error(
          `@ VoltsWorld.getInstance: 'config' was not provided, but is required when creating the first instance`,
        );
      if (!config.mode)
        throw new Error(
          `@ VoltsWorld.getInstance: 'config.mode' was not provided, but is required when creating the first instance`,
        );
      // @ts-expect-error
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
    } else if (config) {
      Diagnostics.warn(
        `@ VoltsWorld.getInstance: 'config' was provided (attempted to create new instance) but there's already an instance running`,
      );
    }
    return VoltsWorld.instance;
  }
  /** @description Use this function to run a fn when a new Instance gets created */
  static subscribeToInstance(cb: () => void): boolean {
    if (typeof cb === 'function') return !!VoltsWorld.subscriptions.push(cb);
    return false;
  }
  static devClear() {
    // const Instance = VoltsWorld.getInstance(false);
    VoltsWorld.userConfig = undefined;
    VoltsWorld.instance = undefined;
    VoltsWorld.subscriptions = [];
  }
  private async init(assets: WorldConfig['assets'], states: State<any>[]): Promise<void> {
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
    const loadStateArr = await promiseAllConcurrent(10, true)(states.map((s: State<any>) => s.loadState));

    const keys = Object.keys(assets);
    const getAssets: any[] = await promiseAllConcurrent(10, false)(keys.map((n) => assets[n]));
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
    // This won't be the case when the mode is set to PROD, in case some device has undocumented behaviour within the margin of error (3 frames)
    const lastThreeFrames: number[] = [];
    let offset = 0;

    const loop = () => {
      Time.setTimeoutWithSnapshot(
        this.internalData.formattedValuesToSnapshot as { [key: string]: any },
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
            VoltsWorld.userConfig.mode !== PRODUCTION_MODES.PRODUCTION
          )
            return loop();
          //#endregion

          //#region onLoad function
          VoltsWorld.userConfig.mode !== PRODUCTION_MODES.NO_AUTO &&
            this.internalData.frameCount === 0 &&
            this.emitEvent('load', this.internalData.userFriendlySnapshot);
          //#endregion

          //#region onRun/onFrame
          const onFramePerformanceData = { fps, delta, frameCount: this.internalData.frameCount };
          this.runTimedEvents(onFramePerformanceData);
          this.emitEvent('frameUpdate', this.internalData.userFriendlySnapshot, onFramePerformanceData);
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
  get snapshot(): SnapshotToVanilla<WorldConfigParams['snapshot']> & { [key: string]: any } {
    return this.internalData.userFriendlySnapshot;
  }
  public forceAssetReload(): Promise<void> {
    return this.internalData.initPromise();
  }
  public stop({ clearTimedEvents } = { clearTimedEvents: false }): boolean {
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
    const shouldBind = ['load', 'frameUpdate', 'internal'].some((e) => e === event);
    const evts = (this.internalData.events[event] || []);
    for (let index = 0; index < evts.length; index++) {
      const event = evts[index];
      if (shouldBind) {
        event.bind(this)(...args)
      } else {
        event(...args)
      };
    };
  }
  /**
   * @author Andrey Sitnik
   * @param event The event name.
   * @param cb The listener function.
   * @returns Unbind listener from event.
   * @see https://github.com/ai/nanoevents
   */
  public onEvent<K extends keyof Events<SnapshotToVanilla<WorldConfigParams['snapshot']> & { [key: string]: any }>>(
    event: K,
    cb: Events<SnapshotToVanilla<WorldConfigParams['snapshot']> & { [key: string]: any }>[K],
  ): () => void {
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
    // if (!this.internalData.running)
    //   Diagnostics.warn('Warning @ Volts.World.setTimeout: created a timeout while the current instance is not running');
    return this.setTimedEvent(cb, ms, false);
  }
  /**
   * @description Creates an interval that executes the function every [X] milliseconds
   * @param cb The function to be executed
   * @param ms The amount of milliseconds to wait before calling the function
   * @returns The `clear` function, with which you can clear the interval, preventing any future executions
   */
  public setInterval(cb: TimedEventFunction, ms: number): { clear: () => void } {
    // if (!this.internalData.running)
    //   Diagnostics.warn( 'Warning @ Volts.World.setInterval: created an interval while the current instance is not running', );
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
    // if (!this.internalData.running)
    //   Diagnostics.warn('Warning @ Volts.World.setDebounce: created a debounce while the current instance is not running', );
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

  protected signalsToSnapshot_able<values extends Snapshot>(values: values): ObjectToSnapshotable<values> {
    // The purpose of the prefix & suffix is to ensure any signal values added to the snapshot don't collide.
    // Eg. were vec3 'V1' to be broken up into 'V1x' 'V1y' 'V1z', it'd collide with any signals named 'V1x' 'V1y' 'V1z'
    // Here the names would get converted to 'CONVERTED::V1::x|y|z|w:[UUID]', later pieced back together into a number[]
    // Hopefully reducing any possible error that might arise from the accordion needed to work together with subscribeWithSnapshot
    const prefix = 'CONVERTED';
    const suffix = getUUIDv4();
    const getKey = (k: string, e: string) => `${prefix}::${k}::${e}::${suffix}`;
    // @ts-ignore
    const tmp: { [key: string]: any } = {};
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

    // @ts-ignore
    return tmp;
  }

  protected formattedSnapshotToUserFriendly(snapshot: ObjectToSnapshotable<Snapshot>): SnapshotToVanilla<Snapshot> {
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
    const result: { [key: string]: any } = {};
    for (let i = 0; i < keys.length; i++) {
      const name = keys[i];
      const [dim, uuid] = signals[name];

      if (!Number.isFinite(dim) || dim == 0 || dim > 4)
        report(`@ Volts.World.formattedSnapshotToUserFriendly: dimension of signals[name] not 1|2|3|4. Dim: ${dim}. Name: ${name}.\n\nKeys: ${keys}`,).asIssue('throw');

      const arr: any[] = [];
      const letters = ['X', 'Y', 'Z', 'W'];
      for (let index = 0; index < dim; index++) {
        arr.push(snapshot[`CONVERTED::${name}::${letters[index]}${dim}::${uuid}`]);
      }

      result[name] = dim >= 2 ? new Vector(arr) : arr[0];
    };

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
  public getWorldSpaceScreenBounds(): Vector<3> {
    if (!this.internalData.running) {
      throw new Error(
        `Vector.getWorldSpaceScreenBounds can only be called when there's a Volts.World instance running`,
      );
    }
    // ask the spark team about this :D, at the time of writing (v119), this didn't output consistent results
    return this.internalData.userFriendlySnapshot.__volts__internal__screen.copy().abs().mul(1, -1, 0);
  }
}

VoltsWorld.subscriptions = [];

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
  setMag(newMag: number): Vector<D>;
  abs(): Vector<D>;
  copy(): Vector<D>;
  normalize(): Vector<D>;
  equals(b: Vector<any>): boolean;
  toString(toFixed?: number): string;
  get x(): number;
  set x(x: number);
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
  get x(): number;
  set x(x: number);
  get y(): number;
  set y(y: number);
  get z(): number;
  set z(z: number);
  cross(...args: VectorArgRest<3>): Vector<3>;
}

interface Vector4DInstance {
  get x(): number;
  set x(x: number);
  get y(): number;
  set y(y: number);
  get z(): number;
  set z(z: number);
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
  screenToWorld(x: number, y: number, focalPlane: boolean): Vector<3>;
  fromSignal<sT extends ScalarSignal | Vec2Signal | VectorSignal | Vec4Signal>(
    s: sT,
  ): Vector<
    sT extends ScalarSignal
      ? 1
      : sT extends Vec2Signal
      ? 2
      : sT extends VectorSignal
      ? 3
      : sT extends Vec4Signal
      ? 4
      : number>;
    random2D(): Vector<2>;
    random3D(): Vector<3>;
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
    // @ts-ignore
    return args[0].copy();
  } else if (Array.isArray(args[0])) {
    this.values = args[0];
  } else if (args.length === 1) {
    this.values = [args[0], args[0], args[0]];
  } else if (args[0] == undefined) {
    this.values = [0, 0, 0];
  } else {
    this.values = args as number[];
  }
  if (!this.values.every((v) => typeof v === 'number') || this.values.length === 0)
    throw new Error(`@ Vector.constructor: Values provided are not valid. args: ${args}. this.values: ${this.values}`);
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
      // @ts-ignore
      if (args[0].dimension == dim) return args[0]; // returns the same vector that was provided
      if (args[0].dimension > dim) return new Vector(args[0].values.slice(0, dim)); // returns a vector that's swizzled to match
      throw new Error(
        `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. dim: ${dim}. args(s): ${args}`,
      );
    } else if (Array.isArray(args[0])) {
      if (args[0].length == dim) return new Vector(args[0]); // returns a vector with the given array as components
      if (args[0].length > dim) return new Vector(args[0].slice(0, dim)); // returns a vector with the given array as components (swizzled)
      throw new Error(
        `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. dim: ${dim}. args(s): ${args}`,
      );
    } else if (typeof args[0] == 'number') {
      return new Vector(new Array(dim).fill(args[0])); // returns a vector filled with the given number
    } else {
      throw new Error(`@ Vector.convertToVector: values provided are not valid. dim: ${dim}. args(s): ${args}`);
    }
  } else {
    if (!(Array.isArray(args) && (args as any[]).every((a) => typeof a === 'number')) || args.length < dim)
      throw new Error(`@ Vector.convertToVector: values provided are not valid. dim: ${dim}. args(s): ${args}`);
    return new Vector(args.splice(0, dim) as unknown as number[]);
  }
};
Vector.screenToWorld = function (x: number, y: number, focalPlane = true): Vector<3> {
  const Instance = VoltsWorld.getInstance(false);
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
Vector.fromSignal = function (s: any) {
  if (!s) throw new Error(`@ Volts.Vector.fromSignal: s is not defined`);
  const tmp = [];
  const _ = ['x', 'y', 'z', 'w'];
  // returns a scalar
  if (!s.x) return new Vector([s.pinLastValue()]);
  for (let index = 0; index < _.length; index++) {
    const e = s[_[index]];
    if (!e) continue;
    tmp.push(e.pinLastValue());
  }
  return new Vector(tmp);
};
Vector.random2D = function random2D(): Vector<2> {
  const angle = Math.random();
  return new Vector(Math.cos(angle), Math.sin(angle));
};
Vector.random3D = function random3D(): Vector<3> {
  const angle = Math.random() * TWO_PI;
  const vz = Math.random() * 2 - 1;
  const vzBase = Math.sqrt(1 - vz * vz);
  const vx = vzBase * Math.cos(angle);
  const vy = vzBase * Math.sin(angle);
  return new Vector(vx, vy, vz);
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
Vector.prototype.setMag = function <D extends number>(this: Vector<D>, newMag: number) {
  return this.normalize().mul(newMag);
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
Vector.prototype.equals = function <D extends number>(this: Vector<D>, b: Vector<number>): boolean {
  return !!b && this.dimension === b.dimension && this.values.every((v, i) => v === b.values[i]);
};
Vector.prototype.toString = function <D extends number>(this: Vector<D>, toFixed?: number): string {
  return `Vector<${this.dimension}> [${(toFixed
    ? this.values.map((v) => v.toFixed(toFixed))
    : this.values
  ).toString()}]`;
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
  const newHeading = Math.atan2(this.values[1], this.values[0]) + a;
  const mag = this.mag();
  this.values[0] = Math.cos(newHeading) * mag;
  this.values[1] = Math.sin(newHeading) * mag;
  return this;
};
//#endregion

//#endregion

//#region Quaternion

type QuaternionArgRest = [number, number, number, number] | [number[]] | [Quaternion] | [];

export class Quaternion {
  values: number[];
  constructor(...args: QuaternionArgRest) {
    if (!args || !args[0]) {
      // Quaternion.identity()
      this.values = [0, 0, 0, 1];
    } else if (args[0] instanceof Quaternion) {
      this.values = args[0].values;
    } else if (Array.isArray(args[0])) {
      this.values = args[0];
    } else {
      this.values = <number[]>args;
    }
    if (!this.values.every((v) => typeof v === 'number' && Number.isFinite(v)) || this.values.length !== 4)
      throw new Error(
        `@ Vector.constructor: Values provided are not valid. args: ${args}. this.values: ${this.values}`,
      );
  }
  /**
   * @description Converts any given QuaternionArgRest into a Quaternion
   */
  static convertToQuaternion(...args: QuaternionArgRest): Quaternion {
    let tmp = [];
    if (args[0] instanceof Quaternion) {
      tmp = args[0].values;
    } else if (Array.isArray(args[0])) {
      tmp = args[0];
    } else {
      tmp = args;
    }
    if (!tmp.every((v) => typeof v === 'number' && Number.isFinite(v)) || tmp.length !== 4)
      throw new Error(`@ Vector.constructor: Values provided are not valid. args: ${args}. tmp: ${tmp}`);

    return new Quaternion(tmp);
  }
  /**
   * @returns the identity ( `Quaternion(0, 0, 0, 1)` )
   */
  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }
  /**
   * @description Create a Quaternion from an Euler angle, provided as any valid 3D VectorArgRest
   * @param args Any valid VectorArgRest, you can simply use an array of length 3
   */
  static fromEuler(...args: VectorArgRest): Quaternion {
    const euler = Vector.convertToSameDimVector(3, ...args);
    const yaw = euler.values[2];
    const pitch = euler.values[1];
    const roll = euler.values[0];
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);
    return new Quaternion(
      cr * cp * cy + sr * sp * sy,
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy
    );
  };
  toQuaternionSignal(): QuaternionSignal {
    return Reactive.quaternion(this.values[0], this.values[1], this.values[2], this.values[3]);
  }
  protected calcNorm(): number {
    return (this.values[0] ** 2 + this.values[1] ** 2 + this.values[2] ** 2 + this.values[3] ** 2) ** 0.5;
  }
  normalize(): Quaternion {
    const norm = this.calcNorm();
    this.values[0] /= norm;
    this.values[1] /= norm;
    this.values[2] /= norm;
    this.values[3] /= norm;
    return this;
  }
  add(...other: QuaternionArgRest): Quaternion {
    const b = Quaternion.convertToQuaternion(...other).values;
    this.values = [
      this.values[0] + b[0],
      this.values[1] + b[1],
      this.values[2] + b[2],
      this.values[3] + b[3],
    ];
    return this;
  }
  copy(): Quaternion {
    return new Quaternion(this.values);
  }
  get normalized(): Quaternion {
    return new Quaternion(this.values).normalize();
  }
  get w(): number {
    return this.values[0];
  }
  set w(w: number) {
    this.values[0] = w;
  }
  get x(): number {
    return this.values[1];
  }
  set x(x: number) {
    this.values[1] = x;
  }
  get y(): number {
    return this.values[2];
  }
  set y(y: number) {
    this.values[2] = y;
  }
  get z(): number {
    return this.values[3];
  }
  set z(z: number) {
    this.values[3] = z;
  }
}

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
export class State<Data extends { [key: string]: Vector<any> | number | string | boolean }> {
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
  setKey(key: keyof Data, value: Vector<any> | number | string | boolean): void {
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

//#region Object3D

/**
 * @description A base type to be implemented by other classes that want to implement Object3D-like behaviour.
 *
 * Named `Skeleton` instead of `Base` to avoid confusion with Spark's class names
 */
export interface Object3DSkeleton {
  pos: Vector<3>;
  rot: Quaternion;
  update(): void;
}

export class Object3D<T extends SceneObjectBase> implements Object3DSkeleton {
  pos: Vector<3>;
  rot: Quaternion;
  body: T;
  constructor(body: T, stayInPlace = true) {
    this.pos = new Vector();
    this.rot = new Quaternion();
    this.body = body;
    if (stayInPlace) {
      this.fetchLastPosition();
      this.fetchLastRotation();
    }
  }
  fetchLastPosition(): Vector<3> {
    return (this.pos = new Vector(
      this.body.transform.position.x.pinLastValue(),
      this.body.transform.position.y.pinLastValue(),
      this.body.transform.position.z.pinLastValue(),
    ));
  }
  fetchLastRotation(): Quaternion {
    return (this.rot = new Quaternion(
      this.body.transform.rotation.w.pinLastValue(),
      this.body.transform.rotation.x.pinLastValue(),
      this.body.transform.rotation.y.pinLastValue(),
      this.body.transform.rotation.z.pinLastValue(),
    ));
  }
  update(update: { position?: boolean; rotation?: boolean } = { position: true, rotation: true }): void {
    if (update.position) {
      // Faster than doing R.vector/pack3
      this.body.transform.x = this.pos.x;
      this.body.transform.y = this.pos.y;
      this.body.transform.z = this.pos.z;
    }
    if (update.rotation) {
      // QuaternionSignal components are read only
      this.body.transform.rotation = this.rot.toQuaternionSignal();
    }
  }
}

//#endregion

//#region Pool

type PooledObject<obj> = obj & { returnToPool: () => void };

/**
 * @description Still in EARLY development
 */
export class Pool {
  protected objects: BlockAsset[];
  protected seed: string[] | BlockAsset[];
  constructor(objectsOrPath: string | string[] | BlockAsset | BlockAsset[]) {
    if (!Blocks) Blocks = require('Blocks');
    if (!objectsOrPath) throw new Error(`@ VOLTS.Pool.constructor: objectsOrPath is undefined`);
    this.seed = Array.isArray(objectsOrPath) ? objectsOrPath : [objectsOrPath];
    this.objects = [];
  };
  private async instantiate(): Promise<any> {
    // **this is missing important steps**
    const blockInstance = await Blocks.instantiate(this.seed[Math.floor(Math.random() * this.seed.length)], {});
    this.objects.push(blockInstance);
  }
  public async getObject(): Promise<PooledObject<BlockAsset>> {
    // @ts-expect-error
    let obj: PooledObject<T> = this.objects.pop();
    if (!obj) {
      await this.instantiate();
      obj = this.objects.pop();
    }
    obj.returnToPool = () => this.objects.push(obj);
    return obj;
  }
  public async populate(amount: number, limitConcurrentPromises: number): Promise<void> {
    await promiseAllConcurrent(limitConcurrentPromises, true)(new Array(amount).fill(this.instantiate.bind(this)));
  };
  get hasPreInstancedObjectsAvailable(): boolean {
    return this.objects.length > 0;
  }
}

//#endregion

//#region exports

interface Privates {
  clearVoltsWorld: () => void;
  report: reportFn;
  promiseAllConcurrent: (n: number, areFn: boolean) => (list: Promise<any>[]) => Promise<any[]>;
}

/* istanbul ignore next */
const makeDevEnvOnly = (d: any) => {
  try {
    jest;
    return d;
  } catch {
    throw `Cannot read 'private.clearVoltsWorld' in the current environment. To be read by jest/testing env only`;
  }
};

function privateRead<T extends { [key: string]: any }>(obj: T): T {
  const tmp = {};
  const keys = Object.keys(obj);
  for (let index = 0; index < keys.length; index++) {
    const k = keys[index];
    Object.defineProperty(tmp, k, {
      /* istanbul ignore next */
      get: () => makeDevEnvOnly(obj[k]),
    });
  }
  return obj;
}

export const privates: Privates = privateRead({
  clearVoltsWorld: VoltsWorld.devClear,
  report: report,
  promiseAllConcurrent: promiseAllConcurrent,
});

export const World = {
  /**
   * @description Use this function to create a new instance, or get the current instance
   * @param config set to `false` to return `undefined` and avoid creating an instance if one is not available
   */
  getInstance: VoltsWorld.getInstance,
  /** @description Run a function when a new Instance gets created */
  subscribeToInstance: VoltsWorld.subscribeToInstance,
};

export default {
  World: World,
  Vector: Vector,
  Quaternion: Quaternion,
  State: State,
  Object3D: Object3D,
  Pool: Pool,
  PRODUCTION_MODES: PRODUCTION_MODES,
};

//#endregion
