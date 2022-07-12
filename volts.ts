//#region imports
import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive';
import Time from 'Time';
import Blocks from 'Blocks';
import CameraInfo from 'CameraInfo';
import Materials from 'Materials';

// 👇 may be dynamically imported using `require`
let Persistence: {
    userScope: {
      get: (s: string) => Promise<object>;
      set: (s: string, o: Object) => Promise<boolean>;
      remove: (s: string) => Promise<boolean>;
    };
  },
  Multipeer: {};

/**
 * Plugins are stored on `_plugins`
 * `plugins` is a creator-facing interface
 */
const _plugins: { [key: string]: VoltsPlugin } = {};

export const plugins: {
  oimo: typeof import('./oimo.plugin');
  [key: string]: VoltsPlugin;
} = Object.defineProperties({} as any, {
  oimo: { get: () => safeImportPlugins('oimo') },
});

/**
 * @description Allows the dynamic import of Volts' plugins
 * @see https://github.com/facebook/react-native/issues/6391#issuecomment-194581270
 */
function safeImportPlugins(name: string, version?: number | string): VoltsPlugin {
  if (!_plugins[name]) {
    const fileName = `${name}.plugin.js`;
    try {
      switch (name) {
        case 'oimo':
          _plugins['oimo'] = require('./oimo.plugin');
          break;
        default:
          throw new Error(`Plugin name is undefined`);
      }
      if (version && version !== _plugins[name].VERSION)
        report(
          `Plugin versions for "${name}" do not match. Expected version: ${version}, but received "${_plugins[name].VERSION}". Please make sure you include a compatible version of "${name}" in your project.`,
        ).asIssue('error');
      if (_plugins[name].onImport && !_plugins[name].onImport())
        report(`Plugin "${name} onImport function failed. Please check with the Plugin's creator"`);
    } catch (error) {
      report(
        `Could not find module "${name}". Please make sure you include the "${fileName}" file in your project.\n${error}`,
      ).asIssue('error');
    }
  }
  return _plugins[name];
}

//#endregion

//#region types
export type PublicOnly<T> = Pick<T, keyof T>;

// https://github.com/microsoft/TypeScript/issues/26223#issuecomment-410642988
interface FixedLengthArray<T, L extends number> extends Array<T> {
  '0': T;
  length: L;
}

// https://stackoverflow.com/a/53808212
type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;

interface VoltsPlugin {
  VERSION: number | string;
  onImport?: () => boolean;
  [key: string]: any;
}

type Snapshot = {
  [key: string]:
    | ScalarSignal
    | Vec2Signal
    | VectorSignal
    | PointSignal
    | Vec4Signal
    | StringSignal
    | BoolSignal
    | QuaternionSignal;
};

type getDimsOfSignal<S> = S extends Vec4Signal
  ? 'x4' | 'y4' | 'z4' | 'w4'
  : S extends VectorSignal
  ? 'x3' | 'y3' | 'z3'
  : S extends PointSignal
  ? 'x3' | 'y3' | 'z3'
  : S extends Vec2Signal
  ? 'x2' | 'y2'
  : S extends ScalarSignal
  ? 'x1'
  : never;

type ObjectToSnapshotable<Obj> = {
  [Property in keyof Obj as `${Obj[Property] extends ISignal
    ? `CONVERTED::${Property extends string ? Property : never}::${getDimsOfSignal<Obj[Property]>}::UUID` & string
    : never}`]: Obj[Property] extends Vec2Signal | VectorSignal | PointSignal | Vec4Signal | QuaternionSignal
    ? ScalarSignal
    : Obj[Property];
};

type SnapshotToVanilla<Obj> = {
  [Property in keyof Obj]: Obj[Property] extends Vec2Signal
    ? Vector<2>
    : Obj[Property] extends VectorSignal
    ? Vector<3>
    : Obj[Property] extends PointSignal
    ? Vector<3>
    : Obj[Property] extends Vec4Signal
    ? Vector<4>
    : Obj[Property] extends ScalarSignal
    ? number
    : Obj[Property] extends StringSignal
    ? string
    : Obj[Property] extends BoolSignal
    ? boolean
    : Obj[Property] extends QuaternionSignal
    ? Quaternion
    : Obj[Property];
};

type ReactiveToVanilla<T> = T extends ScalarSignal
  ? number
  : T extends StringSignal
  ? string
  : T extends BoolSignal
  ? boolean
  : any;

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
  onNext?: number;
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
  const results: any[] = [];

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
  asBackwardsCompatibleDiagnosticsError: () => void;
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
      message = `Message: ${message.message ? message.message : message}\n\nInfo: ${info}\n\nStack: ${
        message.stack ? message.stack : undefined
      }`;
      toLogLevel(lvl, message);
    },
    asBackwardsCompatibleDiagnosticsError: () => {
      Diagnostics.error
        ? Diagnostics.error(message)
        : Diagnostics.warn
        ? Diagnostics.warn(message)
        : Diagnostics.log(message);
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
    writableSignals: !!Reactive.scalarSignalSource,
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
  vec: VectorSignal | PointSignal,
  vecParentSpace: TransformSignal,
  targetParentSpace: TransformSignal,
): PointSignal {
  if (!(vec && vec.z && vec.pinLastValue))
    throw new Error(`@ transformAcrossSpaces: Argument vec is not defined, or is not a VectorSignal`);
  if (!(vecParentSpace && vecParentSpace.inverse && vecParentSpace.pinLastValue))
    throw new Error(`@ transformAcrossSpaces: Argument vecParentSpace is not defined, or is not a TransformSignal`);
  if (!(targetParentSpace && targetParentSpace.inverse && targetParentSpace.pinLastValue))
    throw new Error(`@ transformAcrossSpaces: Argument targetParentSpace is not defined, or is not a TransformSignal`);

  return targetParentSpace.inverse().applyToPoint(vecParentSpace.applyToPoint(vec));
}
//#endregion

//#region randomBetween
export const randomBetween = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};
//#endregion

//#region HSVtoRGB
/**
 * @see https://stackoverflow.com/a/54024653
 */
export function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  h *= 360;
  /* istanbul ignore next */
  const f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [f(5), f(3), f(1)];
}
//#endregion

//#region allBinaryOptions

export function allBinaryOptions(len: number, a: number, b: number): (typeof a | typeof b)[][] {
  const binary: (typeof a | typeof b)[][] = [];
  for (let index = 0; index < 2 ** len; index++) {
    const binaryString = index.toString(2);
    binary.push(
      (
        Array(len - binaryString.length)
          .fill('0')
          .join('') + binaryString
      )
        .split('')
        .map((n) => (Number(n) ? a : b)),
    );
  }
  return binary;
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
  __volts__internal__screenSizePixels: Vector<2>;
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
  quaternions: Map<string, boolean>;
  Camera: Camera;
}

interface WorldConfig {
  mode: keyof typeof PRODUCTION_MODES | `${number}x${number}`;
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
      ? C
      : never;
  };

  public mode: keyof typeof PRODUCTION_MODES | `${number}x${number}`;

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
      formattedValuesToSnapshot: {},
      FLAGS: {
        stopTimeout: false,
        lockInternalSnapshotOverride: false,
      },
      quaternions: new Map<string, boolean>(),
      Camera: null,
    };

    // Quaternion support needs the internalData.quaternion map
    this.internalData.formattedValuesToSnapshot = this.signalsToSnapshot_able(VoltsWorld.userConfig.snapshot);

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
      if (!Object.values(PRODUCTION_MODES).includes(config.mode) && config.mode.indexOf('x') === -1)
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
    if (!this.internalData.FLAGS.lockInternalSnapshotOverride)
      this.addToSnapshot({
        __volts__internal__focalDistance: this.internalData.Camera.focalPlane.distance,
        __volts__internal__time: Time.ms,
        __volts__internal__screen: Scene.unprojectToFocalPlane(Reactive.point2d(0, 0)),
        __volts__internal__screenSizePixels: CameraInfo.previewSize,
      });
    // (three internal keys are manually deleted on load)
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
      this.assets[keys[k]] = Array.isArray(getAssets[k])
        ? getAssets[k].sort((a, b) => {
            return a.name.localeCompare(b.name);
          })
        : getAssets[k];
      // .map(objBody=>{ return new Object3D(objBody) });
    }
    this.internalData.loaded = true;
    if (this.mode !== PRODUCTION_MODES.NO_AUTO) this.run();
  }
  public run(): boolean {
    if (this.internalData.running) return false;

    this.internalData.FLAGS.stopTimeout = false;
    this.internalData.running = true;
    // Fun fact: Time.setTimeoutWithSnapshot will run even if the Studio is paused
    // Meaning this would keep executing, along with any onFrame function
    // For DEV purposes, the function will not execute if it detects the studio is on pause
    // This won't be the case when the mode is set to PROD, in case some device has undocumented behavior within the margin of error (3 frames)
    const lastThreeFrames: number[] = [];
    let offset = 0;

    const loop = () => {
      Time.setTimeoutWithSnapshot(
        this.internalData.formattedValuesToSnapshot as { [key: string]: any },
        (_: number, snapshot: any) => {
          //#region Snapshot
          snapshot = this.formattedSnapshotToUserFriendly(snapshot);
          this.internalData.userFriendlySnapshot = { ...this.internalData.userFriendlySnapshot, ...snapshot };
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

          // For DEV purposes, the function will not execute if it detects the studio is on pause
          if (
            lastThreeFrames[0] === lastThreeFrames[1] &&
            lastThreeFrames[1] === lastThreeFrames[2] &&
            VoltsWorld.userConfig.mode !== PRODUCTION_MODES.PRODUCTION
          )
            return loop();

          const run = () => {
            const onFramePerformanceData = { fps, delta, frameCount: this.internalData.frameCount };
            this.runTimedEvents(onFramePerformanceData);
            this.emitEvent('frameUpdate', this.internalData.userFriendlySnapshot, onFramePerformanceData);
            this.internalData.frameCount += 1;
            if (!this.internalData.FLAGS.stopTimeout) return loop();
          };

          if (this.frameCount === 0) {
            let loadReturn;
            if (VoltsWorld.userConfig.mode !== PRODUCTION_MODES.NO_AUTO) {
              // @ts-expect-error
              delete this.internalData.formattedValuesToSnapshot['__volts__internal__screen']; // @ts-expect-error
              delete this.internalData.formattedValuesToSnapshot['__volts__internal__screenSizePixels']; // @ts-expect-error
              delete this.internalData.formattedValuesToSnapshot['__volts__internal__focalDistance'];
              if (this.mode.indexOf('x') !== -1) {
                this.mode = this.internalData.userFriendlySnapshot.__volts__internal__screenSizePixels.equals(
                  new Vector(this.mode.split('x').map((n) => Number(n))),
                )
                  ? 'DEV'
                  : 'PRODUCTION';
              }
              this.emitEvent('load', this.internalData.userFriendlySnapshot);
            }
            if (loadReturn && loadReturn.then) {
              loadReturn.then(run);
            } else {
              run();
            }
          } else {
            run();
          }
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
  /**
   * @description Runs World.init. **This is NOT RECOMMENDED**. This function will not load new assets or states.
   */
  public forceAssetReload(): Promise<void> {
    return this.internalData.initPromise();
  }
  /**
   * @description Freezes the World instance in time.
   * @returns
   */
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
    const evts = this.internalData.events[event] || [];
    for (let index = 0; index < evts.length; index++) {
      const event = evts[index];
      if (shouldBind) {
        event.bind(this)(...args);
      } else {
        event(...args);
      }
    }
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
  public onNextTick(cb: () => void): { clear: () => void } {
    return this.setTimedEvent(cb, { ms: 0, recurring: false, onNext: this.frameCount });
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
    return this.setTimedEvent(cb, { ms, recurring: false });
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
    return this.setTimedEvent(cb, { ms, recurring: true });
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
  protected setTimedEvent(
    cb: TimedEventFunction,
    { ms, recurring, onNext }: { ms?: number; recurring?: boolean; onNext?: number },
  ): { clear: () => void } {
    const event: TimedEvent = {
      created: this.internalData.elapsedTime,
      lastCall: this.internalData.elapsedTime,
      count: 0,
      delay: ms,
      recurring,
      cb,
      onNext,
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
      if (
        (event.onNext !== undefined && event.onNext !== this.frameCount) ||
        (event.onNext === undefined && event.lastCall + event.delay < this.internalData.elapsedTime)
      ) {
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
        tmp[getKey(key, 'w4')] = signal.w;
        tmp[getKey(key, 'z4')] = signal.z;
        tmp[getKey(key, 'y4')] = signal.y;
        tmp[getKey(key, 'x4')] = signal.x;
        if (signal.eulerAngles) this.internalData.quaternions.set(key, true);
      } else if (signal.z) {
        // vec3
        tmp[getKey(key, 'z3')] = signal.z;
        tmp[getKey(key, 'y3')] = signal.y;
        tmp[getKey(key, 'x3')] = signal.x;
      } else if (signal.y) {
        // vec2
        tmp[getKey(key, 'y2')] = signal.y;
        tmp[getKey(key, 'x2')] = signal.x;
      } else if (signal.xor || signal.concat || signal.pinLastValue) {
        // bool // string // scalar, this very likely unintentionally catches any and all other signal types, even the ones that can't be snapshot'ed
        tmp[getKey(key, 'x1')] = signal;
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
        report(
          `@ Volts.World.formattedSnapshotToUserFriendly: dimension of signals[name] not 1|2|3|4. Dim: ${dim}. Name: ${name}.\n\nKeys: ${keys}`,
        ).asIssue('throw');

      const arr: any[] = [];
      for (let index = 0; index < dim; index++) {
        arr.push(snapshot[`CONVERTED::${name}::${Vector.components[index]}${dim}::${uuid}`]);
      }

      if (this.internalData.quaternions.has(name)) {
        result[name] = new Quaternion(arr[3], arr[0], arr[1], arr[2]);
      } else {
        result[name] = dim >= 2 ? new Vector(arr) : arr[0];
      }
    }

    return result;
  }

  public addToSnapshot(obj: Snapshot = {}): void {
    if (
      this.internalData.FLAGS.lockInternalSnapshotOverride &&
      !Object.keys(obj).every((k) => k.indexOf('__volts__internal') === -1)
    )
      throw new Error('Cannot override internal key after the internal snapshot override has been locked');
    this.internalData.formattedValuesToSnapshot = Object.assign(
      this.internalData.formattedValuesToSnapshot,
      this.signalsToSnapshot_able(obj),
    );
  }

  public removeFromSnapshot(keys: string | string[]): void {
    const keysToRemove = Array.isArray(keys) ? keys : [keys];
    if (
      this.internalData.FLAGS.lockInternalSnapshotOverride &&
      !keysToRemove.every((k) => k.indexOf('__volts__internal') === -1)
    )
      throw new Error('Cannot remove internal key after the internal snapshot override has been locked');
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

type VectorComponents = 'x' | 'y' | 'z' | 'w';

type swizzle<T extends string, V = T> = T extends VectorComponents ? V :
  T extends `${VectorComponents}${infer R}` ? swizzle<R, V> : "xyzw";

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
  toArray(): number[];
  swizzle<s extends string>(string: swizzle<s>): Vector<D>;
  get x(): number;
  set x(x: number);
  get signal(): D extends 2 ? Vec2Signal : D extends 3 ? PointSignal : D extends 4 ? Vec4Signal : ScalarSignal;
  setSignalComponents(): void;
  disposeSignalResources(): void;
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
  get pointSignal(): PointSignal;
  cross(...args: VectorArgRest<3>): Vector<3>;
  applyQuaternion(q: Quaternion): Vector<3>;
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
  fromSignal<sT extends ScalarSignal | Vec2Signal | VectorSignal | PointSignal | Vec4Signal>(
    s: sT,
  ): Vector<
    sT extends ScalarSignal
      ? 1
      : sT extends Vec2Signal
      ? 2
      : sT extends VectorSignal
      ? 3
      : sT extends PointSignal
      ? 3
      : sT extends Vec4Signal
      ? 4
      : number
  >;
  random2D(): Vector<2>;
  random3D(): Vector<3>;
  components: ['x', 'y', 'z', 'w'];
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

export const Vector = function <D extends number>(this: Vector<number>, ...args: VectorArgRest): Vector<D> {
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
  let e = this.values.length === 0;
  for (let i = 0; i < this.values.length; i++) {
    e = e || typeof this.values[i] !== 'number';
  }
  if (e)
    throw new Error(`@ Vector.constructor: Values provided are not valid. args: ${args}. this.values: ${this.values}`);
  // @ts-expect-error
  this.dimension = this.values.length;
  // @ts-expect-error
  return this;
} as unknown as NDVector;

Object.defineProperties(Vector.prototype, {
  x: {
    get: function () {
      return this.values[0];
    },
    set: function (x) {
      this.values[0] = x;
    },
  },
  y: {
    get: function () {
      if (this.dimension < 2) throw new Error(`Cannot get Vector.y, vector is a scalar`);
      return this.values[1];
    },
    set: function (y) {
      if (this.dimension < 2) throw new Error(`Cannot get Vector.y, vector is a scalar`);
      this.values[1] = y;
    },
  },
  z: {
    get: function () {
      if (this.dimension < 3) throw new Error(`Cannot get Vector.z, vector is not 3D`);
      return this.values[2];
    },
    set: function (z) {
      if (this.dimension < 3) throw new Error(`Cannot get Vector.z, vector is not 3D`);
      this.values[2] = z;
    },
  },
  w: {
    get: function () {
      if (this.dimension < 4) throw new Error(`Cannot get Vector.w, vector is not 4D`);
      return this.values[3];
    },
    set: function (w) {
      if (this.dimension < 4) throw new Error(`Cannot get Vector.w, vector is not 4D`);
      this.values[3] = w;
    },
  },
  signal: {
    get: function () {
      if (this.rs) return this.rs;

      const uuid = getUUIDv4(),
        vals = this.values;
      for (let index = 0; index < this.dimension; index++) {
        const c = Vector.components[index];
        this[`r${c}`] = Reactive.scalarSignalSource(`v${this.dimension}-${c}-${uuid}`);
        this[`r${c}`].set(vals[index]);
      }

      if (this.dimension === 1) {
        this.rs = this.rx.signal;
      } else if (this.dimension === 2) {
        this.rs = Reactive.point2d(this.rx.signal, this.ry.signal);
      } else if (this.dimension === 3) {
        this.rs = Reactive.vector(this.rx.signal, this.ry.signal, this.rz.signal);
      } else if (this.dimension === 4) {
        this.rs = Reactive.pack4(this.rx.signal, this.ry.signal, this.rz.signal, this.rw.signal);
      } else {
        throw new Error(
          `Tried to get the Signal of a N>4 Vector instance. Signals are only available for Vectors with up to 4 dimensions`,
        );
      }

      return this.rs;
    },
  },
  pointSignal: {
    get: function () {
      // reactive point signal
      if (this.rps) return this.rps;
      if (this.dimension !== 3)
        throw new Error(`@Vector.pointSignal accessor only available on 3D Vectors. Please use Vector.signal instead`);

      const uuid = getUUIDv4(),
        vals = this.values;
      for (let index = 0; index < 3; index++) {
        const c = Vector.components[index];
        this[`r${c}`] = Reactive.scalarSignalSource(`v${this.dimension}-${c}-${uuid}`);
        this[`r${c}`].set(vals[index]);
      }

      this.rps = Reactive.point(this.rx.signal, this.ry.signal, this.rz.signal);

      return this.rps;
    },
  },
});

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
Vector.fromSignal = function <sT extends ScalarSignal | Vec2Signal | VectorSignal | PointSignal | Vec4Signal>(
  s: any,
): Vector<
  sT extends ScalarSignal
    ? 1
    : sT extends Vec2Signal
    ? 2
    : sT extends VectorSignal
    ? 3
    : sT extends PointSignal
    ? 3
    : sT extends Vec4Signal
    ? 4
    : number
> {
  if (!s) throw new Error(`@ Volts.Vector.fromSignal: s is not defined`);
  const tmp = [];
  // returns a scalar
  if (!s.x) return new Vector([s.pinLastValue()]);
  for (let index = 0; index < Vector.components.length; index++) {
    const e = s[Vector.components[index]];
    if (!e) continue;
    tmp.push(e.pinLastValue());
  }
  return new Vector(tmp);
};

Vector.random2D = function random2D(magnitude = 1): Vector<2> {
  const angle = Math.random();
  return new Vector(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
};
Vector.random3D = function random3D(magnitude = 1): Vector<3> {
  const angle = Math.random() * TWO_PI;
  const vz = Math.random() * 2 - 1;
  const vzBase = Math.sqrt(1 - vz * vz);
  const vx = vzBase * Math.cos(angle);
  const vy = vzBase * Math.sin(angle);
  return new Vector(vx * magnitude, vy * magnitude, vz * magnitude);
};
Vector.components = ['x', 'y', 'z', 'w'];
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
  if (!([...this.values, ...b].every((v) => typeof v === 'number' && Number.isFinite(v)) && b.every((v) => v !== 0))) {
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
  return new Vector([...this.values]);
};
/** @description Test whether two Vectors are equal to each other. This does NOT test whether they are the same instance of Volts.Vector */
Vector.prototype.equals = function <D extends number>(this: Vector<D>, b: Vector<number>): boolean {
  return !!b && this.dimension === b.dimension && this.values.every((v, i) => v === b.values[i]);
};
Vector.prototype.toString = function <D extends number>(this: Vector<D>, toFixed = 5): string {
  // Writeable Reactive Signal
  // @ts-expect-error
  return `Vector<${this.dimension}>${this.rs ? ' (WRS)' : ''} [${(toFixed
    ? this.values.map((v) => v.toFixed(toFixed))
    : this.values
  ).toString()}]`;
};
Vector.prototype.toArray = function () {
  return [...this.values];
};
Vector.prototype.swizzle = function<D extends number, s extends string>(string: swizzle<s>): Vector<D> {
  return new Vector(string.split('').map((char: VectorComponents ) => this[char] ));
};
Vector.prototype.setSignalComponents = function (): void {
  this.rx && this.rx.set(this.values[0]);
  this.ry && this.ry.set(this.values[1]);
  this.rz && this.rz.set(this.values[2]);
  this.rw && this.rw.set(this.values[3]);
};
Vector.prototype.disposeSignalResources = function (): void {
  this.rx && this.rx.dispose();
  this.ry && this.ry.dispose();
  this.rz && this.rz.dispose();
  this.rw && this.rw.dispose();
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
/** @see https://math.stackexchange.com/questions/40164/how-do-you-rotate-a-vector-by-a-unit-quaternion */
Vector.prototype.applyQuaternion = function (this: Vector<3>, q: Quaternion): Vector<3> {
  q = q.normalized;
  const x = this.x,
    y = this.y,
    z = this.z;
  const qx = q.x,
    qy = q.y,
    qz = q.z,
    qw = q.w;

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  this.values = [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];

  return this;
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
  values: [number, number, number, number];
  static components: ['w', 'x', 'y', 'z'];
  constructor(...args: QuaternionArgRest) {
    if (!args || args[0] === undefined) {
      // Quaternion.identity()
      this.values = [1, 0, 0, 0];
    } else if (args[0] instanceof Quaternion) {
      this.values = args[0].values;
    } else if (Array.isArray(args[0])) {
      // @ts-expect-error
      this.values = args[0];
    } else {
      this.values = <any>args;
    }
    if (!this.values.every((v) => typeof v === 'number' && Number.isFinite(v)) || this.values.length !== 4)
      throw new Error(
        `@ Quaternion.constructor: Values provided are not valid. args: ${args}. this.values: ${this.values}`,
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
      throw new Error(`@ Quaternion.constructor: Values provided are not valid. args: ${args}. tmp: ${tmp}`);

    return new Quaternion(tmp);
  }
  /**
   * @returns the identity ( `Quaternion(1, 0, 0, 0)` )
   */
  static identity(): Quaternion {
    return new Quaternion(1, 0, 0, 0);
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
      cr * cp * sy - sr * sp * cy,
    );
  }
  static createFromAxisAngle(axis: Vector<3>, angle: number): Quaternion {
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    const q = new Quaternion();
    q.values[1] = axis.values[0] * s;
    q.values[2] = axis.values[1] * s;
    q.values[3] = axis.values[2] * s;
    q.values[0] = Math.cos(halfAngle);
    return q;
  }
  /**
   * @description LookAt function
   * @param sourcePoint The point where the looker is located in 3D space
   * @param destPoint The point to look at in 3D space
   */
  static lookAt(sourcePoint: Vector<3>, destPoint: Vector<3>): Quaternion {
    const forwardVector = destPoint.copy().sub(sourcePoint).normalize();
    const dot = new Vector(0, 0, 1).dot(forwardVector);
    // @todo replace with a single if statement that gets skipped if none are met
    if (Math.abs(dot + 1.0) < 0.000001) {
      return new Quaternion(0, 1, 0, PI);
    }
    if (Math.abs(dot - 1.0) < 0.000001) {
      return new Quaternion([1, 0, 0, 0]);
    }
    const rotAngle = Math.acos(dot);
    const rotAxis = new Vector([0, 0, 1]).cross(forwardVector).normalize();
    return Quaternion.createFromAxisAngle(rotAxis, rotAngle);
  }
  /**
   * @author Tomas Pietravallo
   * @description Look at function. Optimized for speed. Borrowed from the early beta versions of Volts
   * @param headingVector3DArray an array of length 3, containing data pointing from the looker to the object to be watched. Essentially Vector<3>.values
   */
  static lookAtOptimized(headingVector3DArray: number[]): Quaternion {
    // Heavily inlined and pre-calculated the return is the same as Quaternion.LookAt()
    // It is assumed that UP is 0,1,0 and that the forward axis points towards 0,0,1
    // The assumptions above allow for skipping some calculations, since multiplying/adding 0 is irrelevant
    const forwardVector: number[] = [...headingVector3DArray];
    let mag = Math.sqrt(forwardVector[0] ** 2 + forwardVector[1] ** 2 + forwardVector[2] ** 2);
    mag !== 0 && (forwardVector[0] /= mag);
    mag !== 0 && (forwardVector[1] /= mag);
    mag !== 0 && (forwardVector[2] /= mag);
    const dot = forwardVector[2];
    if (Math.abs(dot + 1) < 0.00001) return new Quaternion(0, 1, 0, PI);
    if (Math.abs(dot - 1) < 0.00001) return new Quaternion(1, 0, 0, 0);
    let rotAngle = Math.acos(dot);
    const rotAxis = [-forwardVector[1], forwardVector[0], 0];
    mag = (rotAxis[0] ** 2 + rotAxis[1] ** 2) ** 0.5;
    mag !== 0 && (rotAxis[0] /= mag);
    mag !== 0 && (rotAxis[1] /= mag);
    rotAngle *= 0.5;
    const s = Math.sin(rotAngle);
    return new Quaternion(Math.cos(rotAngle), rotAxis[0] * s, rotAxis[1] * s, rotAxis[2] * s);

    // Convert to Spark's Euler angles
    // Note that because of the singularities, Q -> Euler can produce unexpected results
    // https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles

    // let angles = [];
    // let sinr_cosp = 2 * (q[0] * q[1] + q[2] * q[3]);
    // let cosr_cosp = 1 - 2 * (q[1] * q[1] + q[2] * q[2]);
    // angles[0] = Math.atan2(sinr_cosp, cosr_cosp);
    // let sinp = 2 * (q[0] * q[2] - q[3] * q[3]);
    // if (Math.abs(sinp) >= 1) {angles[1] = (1.57079632679) * Math.sign(sinp);} else {angles[1] = Math.asin(sinp);}
    // let siny_cosp = 2 * (q[0] * q[3] + q[1] * q[2]);
    // let cosy_cosp = 1 - 2 * (q[2] * q[2] + q[3] * q[3]);
    // angles[2] = Math.atan2(siny_cosp, cosy_cosp);
    // return new EulerAngles(angles);
  }
  static slerp(q1: Quaternion, q2: Quaternion, t: number): Quaternion {
    const q = new Quaternion();
    const cosHalfTheta = q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;

    if (Math.abs(cosHalfTheta) >= 1.0) {
      q.w = q1.w;
      q.x = q1.x;
      q.y = q1.y;
      q.z = q1.z;
      return q;
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = (1.0 - cosHalfTheta * cosHalfTheta) ** 0.5;

    if (Math.abs(sinHalfTheta) < 0.001) {
      q.w = q1.w * 0.5 + q2.w * 0.5;
      q.x = q1.x * 0.5 + q2.x * 0.5;
      q.y = q1.y * 0.5 + q2.y * 0.5;
      q.z = q1.z * 0.5 + q2.z * 0.5;
      return q;
    }
    const ra = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const rb = Math.sin(t * halfTheta) / sinHalfTheta;

    q.w = q1.w * ra + q2.w * rb;
    q.x = q1.x * ra + q2.x * rb;
    q.y = q1.y * ra + q2.y * rb;
    q.z = q1.z * ra + q2.z * rb;

    return q;
  }
  public toQuaternionSignal(): QuaternionSignal {
    return Reactive.quaternion(this.values[0], this.values[1], this.values[2], this.values[3]);
  }
  public calcNorm(): number {
    return (this.values[0] ** 2 + this.values[1] ** 2 + this.values[2] ** 2 + this.values[3] ** 2) ** 0.5;
  }
  public normalize(): Quaternion {
    const norm = this.calcNorm();
    this.values[0] /= norm;
    this.values[1] /= norm;
    this.values[2] /= norm;
    this.values[3] /= norm;
    return this;
  }
  /**
   * @description Component-wise addition
   */
  public add(...other: QuaternionArgRest): Quaternion {
    const b = Quaternion.convertToQuaternion(...other).values;
    this.values[0] = this.values[0] + b[0];
    this.values[1] = this.values[1] + b[1];
    this.values[2] = this.values[2] + b[2];
    this.values[3] = this.values[3] + b[3];
    return this;
  }
  /**
   * @description To compose two Quaternion rotations together you need to rotate one by the other (multiply them), this operation does that. Note: non-commutative
   * @param other
   * @todo Tests
   * @returns
   */
  public mul(...other: QuaternionArgRest): Quaternion {
    const b = Quaternion.convertToQuaternion(...other);
    const w1 = this.w;
    const x1 = this.x;
    const y1 = this.y;
    const z1 = this.z;

    const w2 = b.w;
    const x2 = b.x;
    const y2 = b.y;
    const z2 = b.z;

    this.w = w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2;
    this.x = w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2;
    this.y = w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2;
    this.z = w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2;
    return this;
  }
  public copy(): Quaternion {
    return new Quaternion([...this.values]);
  }
  public setSignalComponents(): void {
    // @ts-expect-error
    this.rw && this.rw.set(this.values[0]); // @ts-expect-error
    this.rx && this.rx.set(this.values[1]); // @ts-expect-error
    this.ry && this.ry.set(this.values[2]); // @ts-expect-error
    this.rz && this.rz.set(this.values[3]);
  }
  public disposeSignalResources(): void {
    // @ts-expect-error
    this.rw && this.rw.dispose(); // @ts-expect-error
    this.rx && this.rx.dispose(); // @ts-expect-error
    this.ry && this.ry.dispose(); // @ts-expect-error
    this.rz && this.rz.dispose();
  }
  /**
   * @description Returns an array containing the Euler angles (in radian) for the corresponding Quaternion.
   *
   * Note: Singularities
   * @returns
   */
  public toEulerArray(): number[] {
    const angles: number[] = [];
    // roll (x-axis rotation)
    const sinr_cosp = 2 * (this.w * this.x + this.y * this.z);
    const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y);
    angles[0] = Math.atan2(sinr_cosp, cosr_cosp);
    // pitch (y-axis rotation)
    const sinp = 2 * (this.w * this.y - this.z * this.x);
    if (Math.abs(sinp) >= 1) {
      angles[1] = (PI / 2) * Math.sign(sinp); // use 90 degrees if out of range
    } else {
      angles[1] = Math.asin(sinp);
    }
    // yaw (z-axis rotation)
    const siny_cosp = 2 * (this.w * this.z + this.x * this.y);
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z);
    angles[2] = Math.atan2(siny_cosp, cosy_cosp);
    return angles;
  }
  public toString(toFixed = 5): string {
    //@ts-expect-error
    return `Quaternion${this.rs ? ' (WRS)' : ''}: [${this.values.map((v) => v.toFixed(toFixed))}]`;
  }
  public toArray(): number[] {
    return [...this.values];
  }
  get normalized(): Quaternion {
    return new Quaternion([...this.values]).normalize();
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
  get signal(): QuaternionSignal {
    // @ts-expect-error
    if (this.rs) return this.rs;

    const uuid = getUUIDv4(),
      vals = this.values;
    for (let index = 0; index < 4; index++) {
      const c = Quaternion.components[index];
      this[`r${c}`] = Reactive.scalarSignalSource(`quat-${c}-${uuid}`);
      this[`r${c}`].set(vals[index]);
    }

    // @ts-expect-error
    this.rs = Reactive.quaternion(this.rw.signal, this.rx.signal, this.ry.signal, this.rz.signal);

    return this.rs;
  }
}

Quaternion.components = ['w', 'x', 'y', 'z'];

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
export class State<Data extends { [key: string]: Vector<any> | Quaternion | number | string | boolean }> {
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
  setValue(key: keyof Data, value: Data[typeof key]): void {
    // @ts-ignore
    this.data[key] = value instanceof Vector ? value.copy() : value instanceof Quaternion ? value.copy() : value;
    // rate limit (?)
    this.setPersistenceAPI();
  }

  get data(): { [Property in keyof Data]+?: Data[Property] } {
    return this._data;
  }
}

// new State<{a: Vector<3>}>('any').setValue('a', true);

//#endregion

//#region Object3D

export enum SceneObjectClassNames {
  'Plane' = 'Plane',
  'Canvas' = 'Canvas',
  'PlanarImage' = 'PlanarImage',
  'AmbientLightSource' = 'AmbientLightSource',
  'DirectionalLightSource' = 'DirectionalLightSource',
  'PointLightSource' = 'PointLightSource',
  'SpotLightSource' = 'SpotLightSource',
  'ParticleSystem' = 'ParticleSystem',
  'SceneObject' = 'SceneObject',
}

export enum MaterialClassNames {
  'DefaultMaterial' = 'DefaultMaterial',
  'BlendedMaterial' = 'BlendedMaterial',
  'PhysicallyBasedMaterial' = 'PhysicallyBasedMaterial',
  'FacePaintMaterial' = 'FacePaintMaterial',
}
/**
 * @description A base type to be implemented by other classes that want to implement Object3D-like behavior.
 *
 * Named `Skeleton` instead of `Base` to avoid confusion with Spark's class names
 */
export interface Object3DSkeleton {
  pos: Vector<3>;
  rot: Quaternion;
  update(): void;
}

export class Object3D<T extends SceneObjectBase = any> {
  pos: Vector<3>;
  rot: Quaternion;
  acc: Vector<3>;
  vel: Vector<3>;
  scl: Vector<3>;
  box: Vector<3>;
  awake: boolean;
  body: IfEquals<any, T, Promise<SceneObjectBase>, T>;

  constructor(body?: T) {
    (this.pos = new Vector()),
      (this.rot = new Quaternion()),
      (this.acc = new Vector()),
      (this.vel = new Vector()),
      (this.scl = new Vector(1, 1, 1)),
      (this.box = new Vector(0.05)),
      (this.awake = true);

    /**
     * The key idea behind this, is decoupling processing from rendering.
     *
     * Use `null` to have no body.
     *
     * `undefined` will instance an object for you. This choice boils down to two things:
     *
     * 1. Non-body objects are useful and should be easy to create
     *
     * 2. out of bounds array creating dynamic objects may help identify an issue,
     * and instancing without hassle can be useful while iterating
     */
    this.body = body;
    if (body !== null) {
      const p = new Promise<T>((resolve) => {
        (body ? typeof body === 'string' ? Blocks.instantiate('sphere', { hidden: false,  }) : Promise.resolve(body) : Scene.create('Plane')).then(async (plane: T) => {
          typeof body === 'string' && (await Scene.root.addChild(plane));
          plane.transform.position = this.pos.signal;
          plane.transform.rotation = this.rot.signal;
          plane.transform.scale = this.scl.signal;
          // Improve with volts snapshot fetch
          // const boxSignal = plane.getBoundingBox();
          // box.values = Vector.fromSignal(boxSignal.max.sub(boxSignal.min)).values;
          // if (box.values.every((v) => v < 1e-6)) throw new Error('1e-6 limit not exceeded ')
          resolve(plane);
        });
      });
      if (!body || typeof body === 'string') this.body = p;
    }
  }

  lookAtOther(other: Object3D): Object3D {
    this.rot.values = Quaternion.lookAt(this.pos, other.pos).values;
    return this;
  }

  lookAtHeading(): Object3D {
    this.rot.values = Quaternion.lookAtOptimized(this.vel.values).values;
    return this;
  }

  update({ pos, rot }: { pos?: boolean; rot?: boolean } = {}): void {
    if (pos) this.pos.setSignalComponents();
    if (rot) this.rot.setSignalComponents();
  }

  setPos(...newPos: VectorArgRest): Object3D {
    this.pos.values = Vector.convertToSameDimVector(3, ...newPos).values;
    return this;
  }

  setRot(...newRot: QuaternionArgRest): Object3D {
    this.rot.values = Quaternion.convertToQuaternion(...newRot).values;
    return this;
  }

  setScl(...newScl: VectorArgRest): Object3D {
    this.scl.values = Vector.convertToSameDimVector(3, ...newScl).values;
    return this;
  }

  bindMesh(sceneObjectBase: SceneObjectBase): Object3D {
    sceneObjectBase.transform.position = this.pos.signal;
    sceneObjectBase.transform.rotation = this.rot.signal;
    return this;
  }

  static async createDebugMaterial(hue?: number): Promise<MaterialBase> {
    if (hue === undefined) hue = 0;
    return Materials.create(MaterialClassNames.DefaultMaterial, {
      opacity: 1.0,
      blendMode: 'ALPHA',
      doubleSided: true,
    }).then((m) => {
      return m.setTextureSlot('DIFFUSE', Reactive.pack4(...hsv2rgb(hue, 1, 1), 1) as any), m;
    });
  }

  /**
   * @description *Not available for Block assets*
   */
  setMaterial<T extends MaterialBase>(material: T): Object3D {
    if (!this.body) return
    // @ts-expect-error
    this.body.then ? this.body.then((b) => (b.material = material)) : (this.body.material = material);
    return this;
  }

  /**
   * @version 0.0.0
   * @description ***ONLY AVAILABLE FOR BLOCK ASSETS***
   * 
   * ****EARLY DEVELOPMENT****
   * 
   * Just to test out the concept
   */
  setInputs(inputs: {[key: string]: [ any, string ] }){
    const keys = Object.keys(inputs);
    const set = (b: BlockSceneRoot) => {
      for (let index = 0; index < keys.length; index++) {
        b.inputs[inputs[keys[index]][1]](keys[index], inputs[keys[index]][0])
      }
    }
    // @ts-expect-error
    this.body.then ? this.body.then(b => set(b)) : set(this.body);
  }
}

//#endregion

//#region Pool

type PooledObject<obj> = obj & { returnToPool: () => void };

/**
 * @description Still in EARLY development
 */
export class Pool {
  public objects: Object3D<SceneObjectBase | BlockSceneRoot>[];
  protected seed: (string | BlockAsset)[];
  protected root: SceneObjectBase | Promise<SceneObjectBase>;
  protected initialState: {
    [Prop in keyof SceneObjectBase]+?: SceneObjectBase[Prop] | ReactiveToVanilla<SceneObjectBase[Prop]>;
  };
  static SceneObjects: typeof SceneObjectClassNames;
  constructor(
    objectsOrPath: string | string[] | BlockAsset | BlockAsset[],
    root?: string | SceneObjectBase,
    initialState?: {
      [Prop in keyof SceneObjectBase]+?: SceneObjectBase[Prop] | ReactiveToVanilla<SceneObjectBase[Prop]>;
    } = {},
  ) {
    if (!Blocks.instantiate)
      throw new Error(
        `@ VOLTS.Pool.constructor: Dynamic instances capability is not enabled.\n\nPlease go to Project > Properties > Capabilities > + Scripting Dynamic Instantiation`,
      );
    if (!objectsOrPath) throw new Error(`@ VOLTS.Pool.constructor: objectsOrPath is undefined`);
    this.seed = Array.isArray(objectsOrPath) ? objectsOrPath : [objectsOrPath];
    this.objects = [];
    this.initialState = initialState;
    // Promise.resolve pushed further down to Pool.instantiate
    if (root) this.root = this.setRoot(root);
  }
  protected async instantiate(): Promise<void> {
    const assetName = this.seed[Math.floor(Math.random() * this.seed.length)];
    const i = await (Object.values(SceneObjectClassNames).includes(assetName as any)
      ? Scene.create(assetName as string, this.initialState)
      : Blocks.instantiate(assetName, this.initialState));
    // @ts-ignore
    this.root = (this.root || {}).then ? await this.root.catch(() => undefined) : this.root;

    if (!this.root || !this.root.addChild)
      throw new Error(
        `@ VOLTS.Pool.instantiate: No root was provided, or the string provided did not match a valid SceneObject`,
      );
    await this.root.addChild(i);
    this.objects.push(new Object3D(i));
  }
  public async getObject(): Promise<PooledObject<BlockSceneRoot>> {
    // @ts-expect-error
    let obj: PooledObject<T> = this.objects.pop();
    if (!obj) {
      await this.instantiate();
      obj = this.objects.pop();
    }
    obj.returnToPool = () => this.objects.push(obj);
    return obj;
  }
  public async populate(amount: number, limitConcurrentPromises?: number): Promise<void> {
    await promiseAllConcurrent(
      limitConcurrentPromises || 10,
      true,
    )(new Array(amount).fill(this.instantiate.bind(this)));
  }
  public async setRoot(newRoot: string | SceneObjectBase): Promise<SceneObjectBase> {
    this.root = typeof newRoot === 'string' ? await Scene.root.findFirst(newRoot).catch(() => undefined) : newRoot;
    if (!this.root)
      throw new Error(
        `Error @ VOLTS.Pool.setRoot: Scene.root.findFirst was unable to find the provided root: "${newRoot}"`,
      );
    return this.root;
  }
  get hasPreInstancedObjectsAvailable(): boolean {
    return this.objects.length > 0;
  }
  get preInstancedObjectsCount(): number {
    return this.objects.length;
  }
}

Pool.SceneObjects = SceneObjectClassNames;

//#endregion

//#region Cube

export class Cube {
  public readonly x: number;
  public readonly y: number;
  public readonly z: number;
  public readonly s: number;
  constructor(origin: Vector<3>, size: number) {
    if (!(origin && origin.values && Number.isFinite(origin.values[0]) && typeof size === 'number'))
      throw new Error(`@ Volts.Cube.constructor: Values provided are not valid. origin: ${origin}, size: ${origin}`);
    this.x = origin.x;
    this.y = origin.y;
    this.z = origin.z;
    this.s = size;
  }

  contains(Object3D: Object3D): boolean {
    return (
      // The front-bottom-left vertex is contained. This ensures stacked cubes don't overlap
      Object3D.pos.x >= this.x - this.s &&
      Object3D.pos.x < this.x + this.s &&
      Object3D.pos.y >= this.y - this.s &&
      Object3D.pos.y < this.y + this.s &&
      Object3D.pos.z >= this.z - this.s &&
      Object3D.pos.z < this.z + this.s
    );
  }

  /**
   * @description for debugging purposes. Creates dynamic planes two opposing corner
   */
  debugVisualize(hue?: number): Promise<void> {
    const origin = new Vector(this.x, this.y, this.z);
    hue = hue || Math.random();
    return Object3D.createDebugMaterial(hue).then((mat) => {
      allBinaryOptions(3, -this.s, this.s).forEach((o) =>
        new Object3D(undefined).setPos(origin.copy().add(o)).setScl(0.1).setMaterial(mat),
      );
    });
  }

  toString(): string {
    return `x: ${this.x.toFixed(5)} y: ${this.y.toFixed(5)} z: ${this.z.toFixed(5)} s: ${this.s.toFixed(5)}`;
  }
}

//#endregion

//#region Tree

export class Tree {
  boundary: Cube;
  capacity: number;
  level: number;
  divided: boolean;
  points: Tree[] | Object3D[];
  constructor(boundary: Cube, capacity: number, level: number) {
    if (!(boundary.contains && typeof capacity === 'number' && typeof level === 'number' && level <= 5))
      throw new Error(
        `@ Volts.Tree.constructor: Values provided are not valid. boundary: ${boundary}, capacity: ${capacity}, level: ${level}`,
      );
    this.boundary = boundary;
    this.capacity = capacity;
    this.level = level;
    this.points = [];
    this.divided = false;
  }

  subdivide(): void {
    /** @Note COPY OVER CHANGES TO TREE.TEST.TS JEST MOCK */
    this.divided = true;
    const cubePos = new Vector(this.boundary.x, this.boundary.y, this.boundary.z);
    const tmp = this.points as Object3D[];
    this.points = allBinaryOptions(3, -this.boundary.s / 2, this.boundary.s / 2).map(
      (o) => new Tree(new Cube(cubePos.copy().add(o), this.boundary.s / 2), this.capacity, this.level + 1),
    );
    for (let index = 0; index < tmp.length; index++) {
      this.insert(tmp[index]);
    }
  }

  insert(Object3D: Object3D): boolean {
    if (this.boundary.contains(Object3D)) {
      if (this.divided) {
        for (let index = 0; index < 8; index++) {
          if ((this.points[index] as Tree).insert(Object3D)) return true;
        }
      } else if (!this.divided && this.points.length < this.capacity) {
        (this.points as Object3D[]).push(Object3D);
        return true;
      } else if (!this.divided) {
        this.subdivide();
        return this.insert(Object3D);
      }
    } else {
      if (this.level === 0)
        Diagnostics.warn(
          `Out of bounds contains on level 0. Tree.boundary: ${this.boundary.toString()}. Point: ${Object3D.pos.toString()}`,
        );
      return false;
    }
  }

  /**
   * @description Gets all Object3D instances contained within the same cell as `other`
   */
  allSharingSubTree(other: Object3D, includeSelf?: boolean): Object3D[] {
    const stack: Tree[] = [this];
    while (stack.length !== 0) {
      const e = stack.pop() as Tree;
      if (e.boundary && e.boundary.contains(other)) {
        if (e.divided) {
          stack.push(...(e.points as Tree[]));
        } else {
          return (e.points as Object3D[]).filter((e) => (includeSelf ? true : e !== other));
        }
      }
    }
    return [];
  }

  getTotalObjectCount(): number {
    let total = 0;
    const stack: Tree[] = [this];
    while (stack.length !== 0) {
      const e = stack.pop();
      if (e.points && e.divided) {
        stack.push(...(e.points as Tree[]));
      } else {
        total += e.points.length;
      }
    }
    return total;
  }

  /**
   * @description Calling `subdivide` after this function may result in an `Error`
   */
  forceSubdivideAndColorAround(object: Object3D, downToLevel = 5): void {
    const stack: Tree[] = [this];
    const cubes = [];
    let hue = -0.1;

    while (stack.length !== 0) {
      const e = stack.pop() as Tree;
      if (e.boundary && e.boundary.contains(object)) {
        cubes.push(e);
        if (e.divided) {
          stack.push(...(e.points as Tree[]));
        } else if (e.level < downToLevel) {
          e.subdivide();
          stack.push(...(e.points as Tree[]));
        } else {
          break;
        }
      }
    }

    cubes.filter((t: Tree) => t.boundary.contains(object)).forEach((c: Tree) => c.debugVisualize((hue += 0.1), false));
  }

  debugVisualize(hue?: number, subTrees = true): void {
    const stack: Tree[] = [this];
    while (stack.length !== 0) {
      const e = stack.pop() as Tree;
      if (e.boundary && e.divided) {
        subTrees && stack.push(...(e.points as Tree[]));
        e.boundary.debugVisualize(hue);
      }
    }
  }
}

//#endregion

//#region exports

export const privates = {
  clearVoltsWorld: VoltsWorld.devClear,
  report: report,
  promiseAllConcurrent: promiseAllConcurrent,
};

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
  Cube: Cube,
  Tree: Tree,
  PRODUCTION_MODES: PRODUCTION_MODES,
  plugins,
};

//#endregion

// prettier-ignore
(!(Reactive.scalarSignalSource)) && report('Please enable Writeable Signal Sources in the project capabilities for Volts to work properly').asBackwardsCompatibleDiagnosticsError();
