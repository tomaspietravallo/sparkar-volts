import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive';
import Time from 'Time';
import Blocks from 'Blocks';
import CameraInfo from 'CameraInfo';
let Persistence, Multipeer;
const _plugins = {};
export const plugins = Object.defineProperties({}, {
    oimo: { get: () => safeImportPlugins('oimo') },
});
function safeImportPlugins(name, version) {
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
                report(`Plugin versions for "${name}" do not match. Expected version: ${version}, but received "${_plugins[name].VERSION}". Please make sure you include a compatible version of "${name}" in your project.`).asIssue('error');
            if (_plugins[name].onImport && !_plugins[name].onImport())
                report(`Plugin "${name} onImport function failed. Please check with the Plugin's creator"`);
        }
        catch (error) {
            report(`Could not find module "${name}". Please make sure you include the "${fileName}" file in your project.\n${error}`).asIssue('error');
        }
    }
    return _plugins[name];
}
const PI = 3.14159265359;
const TWO_PI = 6.28318530718;
function getUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
const pAll = async (queue, concurrency, areFn) => {
    let index = 0;
    const results = [];
    const execThread = async () => {
        while (index < queue.length) {
            const curIndex = index++;
            results[curIndex] = await (areFn ? queue[curIndex]() : queue[curIndex]);
        }
    };
    const threads = [];
    for (let thread = 0; thread < concurrency; thread++) {
        threads.push(execThread());
    }
    await Promise.all(threads);
    return results;
};
const promiseAllConcurrent = (n, areFn) => (list) => pAll(list, n, areFn);
const prettifyJSON = (obj, spacing = 2) => JSON.stringify(obj, null, spacing);
export const report = function report(...msg) {
    let message;
    const toLogLevel = (lvl, msg) => {
        if (lvl === 'throw') {
            throw msg;
        }
        else {
            Diagnostics[lvl] ? Diagnostics[lvl](msg) : Diagnostics.warn(msg + `\n\n[[logger not found: ${lvl}]]`);
        }
    };
    if (msg.length > 1) {
        message = msg.join('\n');
    }
    else {
        message = msg[0];
    }
    return {
        asIssue: (lvl = 'warn') => {
            message = new Error(`${message}`);
            const info = `This issue arose during execution.\nIf you believe it's related to VOLTS itself, please report it as a Github issue here: https://github.com/tomaspietravallo/sparkar-volts/issues\nPlease make your report detailed (include this message too!), and if possible, include a package of your current project`;
            message = `Message: ${message.message ? message.message : message}\n\nInfo: ${info}\n\nStack: ${message.stack ? message.stack : undefined}`;
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
};
report.getSceneInfo = async function ({ getMaterials, getTextures, getIdentifiers, getPositions } = {
    getMaterials: true,
    getTextures: true,
    getIdentifiers: true,
    getPositions: true,
}) {
    const Instance = World.getInstance(false);
    const info = {};
    if (Instance && Instance.loaded) {
        const sceneData = {};
        const keys = Object.keys(Instance.assets);
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            const element = Instance.assets[key];
            const getElementData = async (e) => {
                if (!e)
                    return { warning: 'no-element-was-found' };
                const data = {};
                let mat, tex;
                data['name'] = e.name;
                data['hidden'] = e.hidden.pinLastValue();
                if (getIdentifiers)
                    data['identifier'] = e.identifier;
                if (getPositions) {
                    data['position'] = Vector.fromSignal(e.transform.position).toString(5);
                }
                if (getMaterials || getTextures) {
                    mat = e.getMaterial ? (await e.getMaterial()) || {} : {};
                    if (getMaterials)
                        data['material'] = mat.name || 'undefined';
                    if (getMaterials && getIdentifiers)
                        data['material-id'] = mat.identifier || 'undefined';
                }
                if (getTextures) {
                    tex = mat && mat.getDiffuse ? (await mat.getDiffuse()) || {} : {};
                    data['texture'] = tex.name || 'undefined';
                    if (getIdentifiers)
                        data['texture-id'] = tex.identifier || 'undefined';
                }
                return data;
            };
            if (Array.isArray(element) && element.length > 1) {
                sceneData[key] = await promiseAllConcurrent(10, true)(element.map((e) => getElementData.bind(this, e)));
            }
            else if (element) {
                sceneData[key] = await getElementData(element[0]);
            }
            else {
                sceneData[key] = `obj[key] is possibly undefined. key: ${key}`;
            }
        }
        info['scene'] = sceneData;
    }
    else {
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
export function transformAcrossSpaces(vec, vecParentSpace, targetParentSpace) {
    if (!(vec && vec.z && vec.pinLastValue))
        throw new Error(`@ transformAcrossSpaces: Argument vec is not defined, or is not a VectorSignal`);
    if (!(vecParentSpace && vecParentSpace.inverse && vecParentSpace.pinLastValue))
        throw new Error(`@ transformAcrossSpaces: Argument vecParentSpace is not defined, or is not a TransformSignal`);
    if (!(targetParentSpace && targetParentSpace.inverse && targetParentSpace.pinLastValue))
        throw new Error(`@ transformAcrossSpaces: Argument targetParentSpace is not defined, or is not a TransformSignal`);
    return targetParentSpace.inverse().applyToPoint(vecParentSpace.applyToPoint(vec));
}
export const randomBetween = (min, max) => {
    return Math.random() * (max - min) + min;
};
export var PRODUCTION_MODES;
(function (PRODUCTION_MODES) {
    PRODUCTION_MODES["PRODUCTION"] = "PRODUCTION";
    PRODUCTION_MODES["DEV"] = "DEV";
    PRODUCTION_MODES["NO_AUTO"] = "NO_AUTO";
})(PRODUCTION_MODES || (PRODUCTION_MODES = {}));
class VoltsWorld {
    constructor() {
        this.mode = VoltsWorld.userConfig.mode;
        this.assets = {};
        this.internalData = {
            initPromise: this.init.bind(this, VoltsWorld.userConfig.assets, VoltsWorld.userConfig.loadStates),
            running: false,
            loaded: false,
            events: {},
            elapsedTime: 0,
            frameCount: 0,
            timedEvents: [],
            userFriendlySnapshot: {},
            formattedValuesToSnapshot: this.signalsToSnapshot_able(VoltsWorld.userConfig.snapshot),
            FLAGS: {
                stopTimeout: false,
                lockInternalSnapshotOverride: false,
            },
            quaternions: new Map(),
            Camera: null,
        };
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
    static getInstance(config) {
        if (config === false)
            return VoltsWorld.instance;
        if (!VoltsWorld.instance) {
            if (typeof config !== 'object' || config === null)
                throw new Error(`@ VoltsWorld.getInstance: 'config' was not provided, but is required when creating the first instance`);
            if (!config.mode)
                throw new Error(`@ VoltsWorld.getInstance: 'config.mode' was not provided, but is required when creating the first instance`);
            if (!Object.values(PRODUCTION_MODES).includes(config.mode))
                throw new Error(`@ VoltsWorld.getInstance: 'config.mode' was provided, but was not valid.\n\nAvailable modes are: ${Object.values(PRODUCTION_MODES)}`);
            config.loadStates = config.loadStates || [];
            Array.isArray(config.loadStates) ? config.loadStates : [config.loadStates];
            config.assets = config.assets || {};
            config.snapshot = config.snapshot || {};
            VoltsWorld.userConfig = config;
            VoltsWorld.instance = new VoltsWorld();
        }
        else if (config) {
            Diagnostics.warn(`@ VoltsWorld.getInstance: 'config' was provided (attempted to create new instance) but there's already an instance running`);
        }
        return VoltsWorld.instance;
    }
    static subscribeToInstance(cb) {
        if (typeof cb === 'function')
            return !!VoltsWorld.subscriptions.push(cb);
        return false;
    }
    static devClear() {
        VoltsWorld.userConfig = undefined;
        VoltsWorld.instance = undefined;
        VoltsWorld.subscriptions = [];
    }
    async init(assets, states) {
        this.internalData.Camera = (await Scene.root.findFirst('Camera'));
        if (!this.internalData.FLAGS.lockInternalSnapshotOverride)
            this.addToSnapshot({
                __volts__internal__focalDistance: this.internalData.Camera.focalPlane.distance,
                __volts__internal__time: Time.ms,
                __volts__internal__screen: Scene.unprojectToFocalPlane(Reactive.point2d(0, 0)),
                __volts__internal_screenSizePixels: CameraInfo.previewSize,
            });
        this.internalData.FLAGS.lockInternalSnapshotOverride = true;
        const loadStateArr = await promiseAllConcurrent(10, true)(states.map((s) => s.loadState));
        const keys = Object.keys(assets);
        const getAssets = await promiseAllConcurrent(10, false)(keys.map((n) => assets[n]));
        for (let k = 0; k < keys.length; k++) {
            if (!getAssets[k])
                throw new Error(`@ Volts.World.init: Object(s) not found. Key: "${keys[k]}"`);
            this.assets[keys[k]] = Array.isArray(getAssets[k])
                ? getAssets[k].sort((a, b) => {
                    return a.name.localeCompare(b.name);
                })
                : getAssets[k];
        }
        this.internalData.loaded = true;
        if (this.mode !== PRODUCTION_MODES.NO_AUTO)
            this.run();
    }
    run() {
        if (this.internalData.running)
            return false;
        this.internalData.FLAGS.stopTimeout = false;
        this.internalData.running = true;
        const lastThreeFrames = [];
        let offset = 0;
        const loop = () => {
            Time.setTimeoutWithSnapshot(this.internalData.formattedValuesToSnapshot, (_, snapshot) => {
                snapshot = this.formattedSnapshotToUserFriendly(snapshot);
                this.internalData.userFriendlySnapshot = snapshot;
                if (!lastThreeFrames[0])
                    offset = this.internalData.userFriendlySnapshot.__volts__internal__time || 0;
                const delta = (this.internalData.userFriendlySnapshot.__volts__internal__time || 0) -
                    offset -
                    this.internalData.elapsedTime;
                const fps = Math.round((1000 / delta) * 10) / 10;
                this.internalData.elapsedTime += delta;
                if (lastThreeFrames.length > 2) {
                    lastThreeFrames[0] = lastThreeFrames[1];
                    lastThreeFrames[1] = lastThreeFrames[2];
                    lastThreeFrames[2] = this.internalData.userFriendlySnapshot.__volts__internal__time;
                }
                else {
                    lastThreeFrames.push(this.internalData.userFriendlySnapshot.__volts__internal__time);
                }
                if (lastThreeFrames[0] === lastThreeFrames[1] &&
                    lastThreeFrames[1] === lastThreeFrames[2] &&
                    VoltsWorld.userConfig.mode !== PRODUCTION_MODES.PRODUCTION)
                    return loop();
                VoltsWorld.userConfig.mode !== PRODUCTION_MODES.NO_AUTO &&
                    this.internalData.frameCount === 0 &&
                    this.emitEvent('load', this.internalData.userFriendlySnapshot);
                const onFramePerformanceData = { fps, delta, frameCount: this.internalData.frameCount };
                this.runTimedEvents(onFramePerformanceData);
                this.emitEvent('frameUpdate', this.internalData.userFriendlySnapshot, onFramePerformanceData);
                this.internalData.frameCount += 1;
                if (!this.internalData.FLAGS.stopTimeout)
                    return loop();
            }, 0);
        };
        loop();
        return true;
    }
    get loaded() {
        return this.internalData.loaded;
    }
    get running() {
        return this.internalData.running;
    }
    get frameCount() {
        return this.internalData.frameCount;
    }
    get snapshot() {
        return this.internalData.userFriendlySnapshot;
    }
    forceAssetReload() {
        return this.internalData.initPromise();
    }
    stop({ clearTimedEvents } = { clearTimedEvents: false }) {
        if (!this.internalData.running)
            return false;
        this.internalData.running = false;
        if (clearTimedEvents)
            this.internalData.timedEvents = [];
        this.internalData.FLAGS.stopTimeout = true;
        return true;
    }
    emitEvent(event, ...args) {
        const shouldBind = ['load', 'frameUpdate', 'internal'].some((e) => e === event);
        const evts = this.internalData.events[event] || [];
        for (let index = 0; index < evts.length; index++) {
            const event = evts[index];
            if (shouldBind) {
                event.bind(this)(...args);
            }
            else {
                event(...args);
            }
        }
    }
    onEvent(event, cb) {
        (this.internalData.events[event] = this.internalData.events[event] || []).push(cb);
        return () => (this.internalData.events[event] = (this.internalData.events[event] || []).filter((i) => i !== cb));
    }
    onNextTick(cb) {
        return this.setTimedEvent(cb, { ms: 0, recurring: false, onNext: this.frameCount });
    }
    setTimeout(cb, ms) {
        return this.setTimedEvent(cb, { ms, recurring: false });
    }
    setInterval(cb, ms) {
        return this.setTimedEvent(cb, { ms, recurring: true });
    }
    setDebounce(cb, ms, trailing = false) {
        let timer;
        if (trailing)
            return (...args) => {
                timer && timer.clear();
                timer = this.setTimeout(() => {
                    cb.apply(this, args);
                }, ms);
            };
        return (...args) => {
            if (!timer) {
                cb.apply(this, args);
            }
            timer && timer.clear();
            timer = this.setTimeout(() => {
                timer = undefined;
            }, ms);
        };
    }
    setTimedEvent(cb, { ms, recurring, onNext }) {
        const event = {
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
    runTimedEvents(onFramePerformanceData) {
        this.internalData.timedEvents = this.internalData.timedEvents.sort((e1, e2) => e1.lastCall + e1.delay - (e2.lastCall + e2.delay));
        let i = this.internalData.timedEvents.length;
        while (i--) {
            const event = this.internalData.timedEvents[i];
            if ((event.onNext !== undefined && event.onNext !== this.frameCount) ||
                (event.onNext === undefined && event.lastCall + event.delay < this.internalData.elapsedTime)) {
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
                }
                else {
                    this.internalData.timedEvents.splice(i, 1);
                }
            }
        }
    }
    signalsToSnapshot_able(values) {
        const prefix = 'CONVERTED';
        const suffix = getUUIDv4();
        const getKey = (k, e) => `${prefix}::${k}::${e}::${suffix}`;
        const tmp = {};
        const keys = Object.keys(values);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const signal = values[key];
            if (!signal)
                throw new Error(`@ (static) signalsToSnapshot_able: value[key] is not defined. Key: "${key}"`);
            if (signal.w) {
                tmp[getKey(key, 'w4')] = signal.w;
                tmp[getKey(key, 'z4')] = signal.z;
                tmp[getKey(key, 'y4')] = signal.y;
                tmp[getKey(key, 'x4')] = signal.x;
                if (signal.eulerAngles)
                    this.internalData.quaternions.set(key, true);
            }
            else if (signal.z) {
                tmp[getKey(key, 'z3')] = signal.z;
                tmp[getKey(key, 'y3')] = signal.y;
                tmp[getKey(key, 'x3')] = signal.x;
            }
            else if (signal.y) {
                tmp[getKey(key, 'y2')] = signal.y;
                tmp[getKey(key, 'x2')] = signal.x;
            }
            else if (signal.xor || signal.concat || signal.pinLastValue) {
                tmp[getKey(key, 'x1')] = signal;
            }
            else {
                throw new Error(`@ (static) signalsToSnapshot_able: The provided Signal is not defined or is not supported. Key: "${key}"\n\nPlease consider opening an issue/PR: https://github.com/tomaspietravallo/sparkar-volts/issues`);
            }
        }
        return tmp;
    }
    formattedSnapshotToUserFriendly(snapshot) {
        let keys = Object.keys(snapshot);
        const signals = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const parts = key.split('::');
            if (parts.length !== 4 || parts[0] !== 'CONVERTED')
                throw new Error(`@ Volts.World.formattedSnapshotToUserFriendly: Signal is missing the correct prefix, or is missing parts. Key: ${key}. Parts: ${parts}`);
            const name = parts[1];
            const [component, dimension] = parts[2].split('');
            const uuid = parts[3];
            signals[name] = [Number(dimension), uuid];
        }
        keys = Object.keys(signals);
        const result = {};
        for (let i = 0; i < keys.length; i++) {
            const name = keys[i];
            const [dim, uuid] = signals[name];
            if (!Number.isFinite(dim) || dim == 0 || dim > 4)
                report(`@ Volts.World.formattedSnapshotToUserFriendly: dimension of signals[name] not 1|2|3|4. Dim: ${dim}. Name: ${name}.\n\nKeys: ${keys}`).asIssue('throw');
            const arr = [];
            for (let index = 0; index < dim; index++) {
                arr.push(snapshot[`CONVERTED::${name}::${Vector.components[index]}${dim}::${uuid}`]);
            }
            if (this.internalData.quaternions.has(name)) {
                result[name] = new Quaternion(arr[3], arr[0], arr[1], arr[2]);
            }
            else {
                result[name] = dim >= 2 ? new Vector(arr) : arr[0];
            }
        }
        return result;
    }
    addToSnapshot(obj = {}) {
        if (this.internalData.FLAGS.lockInternalSnapshotOverride &&
            !Object.keys(obj).every((k) => k.indexOf('__volts__internal') === -1))
            throw new Error('Cannot override internal key after the internal snapshot override has been locked');
        this.internalData.formattedValuesToSnapshot = Object.assign(this.internalData.formattedValuesToSnapshot, this.signalsToSnapshot_able(obj));
    }
    removeFromSnapshot(keys) {
        const keysToRemove = Array.isArray(keys) ? keys : [keys];
        if (this.internalData.FLAGS.lockInternalSnapshotOverride &&
            !keysToRemove.every((k) => k.indexOf('__volts__internal') === -1))
            throw new Error('Cannot remove internal key after the internal snapshot override has been locked');
        const snapKeys = Object.keys(this.internalData.formattedValuesToSnapshot);
        const matches = snapKeys.filter((k) => keysToRemove.indexOf(k.split('::')[1]) !== -1);
        for (let index = 0; index < matches.length; index++) {
            const match = matches[index];
            delete this.internalData.formattedValuesToSnapshot[match];
        }
    }
    getWorldSpaceScreenBounds() {
        if (!this.internalData.running) {
            throw new Error(`Vector.getWorldSpaceScreenBounds can only be called when there's a Volts.World instance running`);
        }
        return this.internalData.userFriendlySnapshot.__volts__internal__screen.copy().abs().mul(1, -1, 0);
    }
}
VoltsWorld.subscriptions = [];
export const Vector = function (...args) {
    if (args[0] instanceof Vector) {
        return args[0].copy();
    }
    else if (Array.isArray(args[0])) {
        this.values = args[0];
    }
    else if (args.length === 1) {
        this.values = [args[0], args[0], args[0]];
    }
    else if (args[0] == undefined) {
        this.values = [0, 0, 0];
    }
    else {
        this.values = args;
    }
    let e = this.values.length === 0;
    for (let i = 0; i < this.values.length; i++) {
        e = e || typeof this.values[i] !== 'number';
    }
    ;
    if (e)
        throw new Error(`@ Vector.constructor: Values provided are not valid. args: ${args}. this.values: ${this.values}`);
    this.dimension = this.values.length;
    return this;
};
Object.defineProperties(Vector.prototype, {
    x: {
        get: function () { return this.values[0]; },
        set: function (x) { this.values[0] = x; }
    },
    y: {
        get: function () { if (this.dimension < 2)
            throw new Error(`Cannot get Vector.y, vector is a scalar`); return this.values[1]; },
        set: function (y) { if (this.dimension < 2)
            throw new Error(`Cannot get Vector.y, vector is a scalar`); this.values[1] = y; }
    },
    z: {
        get: function () { if (this.dimension < 3)
            throw new Error(`Cannot get Vector.z, vector is not 3D`); return this.values[2]; },
        set: function (z) { if (this.dimension < 3)
            throw new Error(`Cannot get Vector.z, vector is not 3D`); this.values[2] = z; }
    },
    w: {
        get: function () { if (this.dimension < 4)
            throw new Error(`Cannot get Vector.w, vector is not 4D`); return this.values[3]; },
        set: function (w) { if (this.dimension < 4)
            throw new Error(`Cannot get Vector.w, vector is not 4D`); this.values[3] = w; }
    },
    signal: {
        get: function () {
            if (this.rs)
                return this.rs;
            for (let index = 0; index < this.dimension; index++) {
                const c = Vector.components[index];
                this[`r${c}`] = Reactive.scalarSignalSource(`v${this.dimension}-${c}-${getUUIDv4()}`);
                this[`r${c}`].set(this[c]);
            }
            ;
            if (this.dimension === 1) {
                this.rs = this.rx.signal;
            }
            else if (this.dimension === 2) {
                this.rs = Reactive.point2d(this.rx.signal, this.ry.signal);
            }
            else if (this.dimension === 3) {
                this.rs = Reactive.pack3(this.rx.signal, this.ry.signal, this.rz.signal);
            }
            else if (this.dimension === 4) {
                this.rs = Reactive.pack4(this.rx.signal, this.ry.signal, this.rz.signal, this.rw.signal);
            }
            else {
                throw new Error(`Tried to get the Signal of a N>4 Vector instance. Signals are only available for Vectors with up to 4 dimensions`);
            }
            ;
            return this.rs;
        }
    }
});
Vector.convertToSameDimVector = function (dim, ...args) {
    if (!args)
        throw new Error('@ Vector.convertToSameDimVector: No values provided');
    if (args.length == 1) {
        if (args[0] instanceof Vector) {
            if (args[0].dimension == dim)
                return args[0];
            if (args[0].dimension > dim)
                return new Vector(args[0].values.slice(0, dim));
            throw new Error(`@ Vector.convertToVector: values provided are not valid. Dimensions do not match. dim: ${dim}. args(s): ${args}`);
        }
        else if (Array.isArray(args[0])) {
            if (args[0].length == dim)
                return new Vector(args[0]);
            if (args[0].length > dim)
                return new Vector(args[0].slice(0, dim));
            throw new Error(`@ Vector.convertToVector: values provided are not valid. Dimensions do not match. dim: ${dim}. args(s): ${args}`);
        }
        else if (typeof args[0] == 'number') {
            return new Vector(new Array(dim).fill(args[0]));
        }
        else {
            throw new Error(`@ Vector.convertToVector: values provided are not valid. dim: ${dim}. args(s): ${args}`);
        }
    }
    else {
        if (!(Array.isArray(args) && args.every((a) => typeof a === 'number')) || args.length < dim)
            throw new Error(`@ Vector.convertToVector: values provided are not valid. dim: ${dim}. args(s): ${args}`);
        return new Vector(args.splice(0, dim));
    }
};
Vector.screenToWorld = function (x, y, focalPlane = true) {
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
    return new Vector(bounds.values[0] * x, bounds.values[1] * y, focalPlane ? Instance.snapshot.__volts__internal__focalDistance : 0);
};
Vector.fromSignal = function (s) {
    if (!s)
        throw new Error(`@ Volts.Vector.fromSignal: s is not defined`);
    const tmp = [];
    if (!s.x)
        return new Vector([s.pinLastValue()]);
    for (let index = 0; index < Vector.components.length; index++) {
        const e = s[Vector.components[index]];
        if (!e)
            continue;
        tmp.push(e.pinLastValue());
    }
    return new Vector(tmp);
};
Vector.random2D = function random2D() {
    const angle = Math.random();
    return new Vector(Math.cos(angle), Math.sin(angle));
};
Vector.random3D = function random3D() {
    const angle = Math.random() * TWO_PI;
    const vz = Math.random() * 2 - 1;
    const vzBase = Math.sqrt(1 - vz * vz);
    const vx = vzBase * Math.cos(angle);
    const vy = vzBase * Math.sin(angle);
    return new Vector(vx, vy, vz);
};
Vector.components = ['x', 'y', 'z', 'w'];
Vector.prototype.add = function (...args) {
    const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
    this.values = this.values.map((v, i) => v + b[i]);
    return this;
};
Vector.prototype.sub = function (...args) {
    const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
    this.values = this.values.map((v, i) => v - b[i]);
    return this;
};
Vector.prototype.mul = function (...args) {
    const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
    this.values = this.values.map((v, i) => v * b[i]);
    return this;
};
Vector.prototype.div = function (...args) {
    const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
    if (![...this.values, ...b].every((v) => typeof v === 'number' && Number.isFinite(v) && v !== 0)) {
        throw new Error(`@ Vector.div: values provided are not valid. this value(s): ${this.values}\n\nb value(s): ${b}`);
    }
    this.values = this.values.map((v, i) => v / b[i]);
    return this;
};
Vector.prototype.dot = function (...args) {
    const b = Vector.convertToSameDimVector(this.dimension, ...args).values;
    return this.values.map((x, i) => this.values[i] * b[i]).reduce((acc, val) => acc + val);
};
Vector.prototype.distance = function (...other) {
    const b = Vector.convertToSameDimVector(this.dimension, ...other);
    return b.copy().sub(this).mag();
};
Vector.prototype.magSq = function () {
    return this.values.reduce((acc, val) => acc + val * val);
};
Vector.prototype.mag = function () {
    return this.values.map((v) => v * v).reduce((acc, val) => acc + val) ** 0.5;
};
Vector.prototype.setMag = function (newMag) {
    return this.normalize().mul(newMag);
};
Vector.prototype.abs = function () {
    this.values = this.values.map((v) => (v < 0 ? -v : v));
    return this;
};
Vector.prototype.normalize = function () {
    const len = this.mag();
    len !== 0 && this.mul(1 / len);
    return this;
};
Vector.prototype.copy = function () {
    return new Vector([...this.values]);
};
Vector.prototype.equals = function (b) {
    return !!b && this.dimension === b.dimension && this.values.every((v, i) => v === b.values[i]);
};
Vector.prototype.toString = function (toFixed = 5) {
    return `Vector<${this.dimension}>${this.rs ? ' (WRS)' : ''} [${(toFixed
        ? this.values.map((v) => v.toFixed(toFixed))
        : this.values).toString()}]`;
};
Vector.prototype.toArray = function () {
    return [...this.values];
};
Vector.prototype.setSignalComponents = function () {
    this.rx && this.rx.set(this.values[0]);
    this.ry && this.ry.set(this.values[1]);
    this.rz && this.rz.set(this.values[2]);
    this.rw && this.rw.set(this.values[3]);
};
Vector.prototype.disposeSignalResources = function () {
    this.rx && this.rx.dispose();
    this.ry && this.ry.dispose();
    this.rz && this.rz.dispose();
    this.rw && this.rw.dispose();
};
Vector.prototype.cross = function (...args) {
    if (this.dimension !== 3)
        throw `Attempting to use Vector<3>.cross on non 3D vector. Dim: ${this.dimension}`;
    const b = Vector.convertToSameDimVector(3, ...args);
    return new Vector(this.values[1] * b.values[2] - this.values[2] * b.values[1], this.values[2] * b.values[0] - this.values[0] * b.values[2], this.values[0] * b.values[1] - this.values[1] * b.values[0]);
};
Vector.prototype.heading = function () {
    return Math.atan2(this.values[1], this.values[0]);
};
Vector.prototype.rotate = function (a) {
    const newHeading = Math.atan2(this.values[1], this.values[0]) + a;
    const mag = this.mag();
    this.values[0] = Math.cos(newHeading) * mag;
    this.values[1] = Math.sin(newHeading) * mag;
    return this;
};
export class Quaternion {
    constructor(...args) {
        if (!args || args[0] === undefined) {
            this.values = [1, 0, 0, 0];
        }
        else if (args[0] instanceof Quaternion) {
            this.values = args[0].values;
        }
        else if (Array.isArray(args[0])) {
            this.values = args[0];
        }
        else {
            this.values = args;
        }
        if (!this.values.every((v) => typeof v === 'number' && Number.isFinite(v)) || this.values.length !== 4)
            throw new Error(`@ Quaternion.constructor: Values provided are not valid. args: ${args}. this.values: ${this.values}`);
    }
    static convertToQuaternion(...args) {
        let tmp = [];
        if (args[0] instanceof Quaternion) {
            tmp = args[0].values;
        }
        else if (Array.isArray(args[0])) {
            tmp = args[0];
        }
        else {
            tmp = args;
        }
        if (!tmp.every((v) => typeof v === 'number' && Number.isFinite(v)) || tmp.length !== 4)
            throw new Error(`@ Quaternion.constructor: Values provided are not valid. args: ${args}. tmp: ${tmp}`);
        return new Quaternion(tmp);
    }
    static identity() {
        return new Quaternion(1, 0, 0, 0);
    }
    static fromEuler(...args) {
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
        return new Quaternion(cr * cp * cy + sr * sp * sy, sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy);
    }
    static createFromAxisAngle(axis, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const q = new Quaternion();
        q.values[1] = axis.values[0] * s;
        q.values[2] = axis.values[1] * s;
        q.values[3] = axis.values[2] * s;
        q.values[0] = Math.cos(halfAngle);
        return q;
    }
    static lookAt(sourcePoint, destPoint) {
        const forwardVector = destPoint.copy().sub(sourcePoint).normalize();
        const dot = new Vector(0, 0, 1).dot(forwardVector);
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
    static lookAtOptimized(headingVector3DArray) {
        const forwardVector = [...headingVector3DArray];
        let mag = Math.sqrt(forwardVector[0] ** 2 + forwardVector[1] ** 2 + forwardVector[2] ** 2);
        forwardVector[0] /= mag;
        forwardVector[1] /= mag;
        forwardVector[2] /= mag;
        const dot = forwardVector[2];
        if (Math.abs(dot + 1) < 0.00001)
            return new Quaternion(0, 1, 0, PI);
        if (Math.abs(dot - 1) < 0.00001)
            return new Quaternion(1, 0, 0, 0);
        let rotAngle = Math.acos(dot);
        const rotAxis = [-forwardVector[1], forwardVector[0], 0];
        mag = Math.sqrt(rotAxis[0] ** 2 + rotAxis[1] ** 2);
        rotAxis[0] /= mag;
        rotAxis[1] /= mag;
        rotAngle *= 0.5;
        const s = Math.sin(rotAngle);
        return new Quaternion(Math.cos(rotAngle), rotAxis[0] * s, rotAxis[1] * s, rotAxis[2] * s);
    }
    toQuaternionSignal() {
        return Reactive.quaternion(this.values[0], this.values[1], this.values[2], this.values[3]);
    }
    calcNorm() {
        return (this.values[0] ** 2 + this.values[1] ** 2 + this.values[2] ** 2 + this.values[3] ** 2) ** 0.5;
    }
    normalize() {
        const norm = this.calcNorm();
        this.values[0] /= norm;
        this.values[1] /= norm;
        this.values[2] /= norm;
        this.values[3] /= norm;
        return this;
    }
    add(...other) {
        const b = Quaternion.convertToQuaternion(...other).values;
        this.values[0] = this.values[0] + b[0];
        this.values[1] = this.values[1] + b[1];
        this.values[2] = this.values[2] + b[2];
        this.values[3] = this.values[3] + b[3];
        return this;
    }
    mul(...other) {
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
    copy() {
        return new Quaternion([...this.values]);
    }
    setSignalComponents() {
        this.rw && this.rw.set(this.values[0]);
        this.rx && this.rx.set(this.values[1]);
        this.ry && this.ry.set(this.values[2]);
        this.rz && this.rz.set(this.values[3]);
    }
    disposeSignalResources() {
        this.rw && this.rw.dispose();
        this.rx && this.rx.dispose();
        this.ry && this.ry.dispose();
        this.rz && this.rz.dispose();
    }
    toEulerArray() {
        const angles = [];
        const sinr_cosp = 2 * (this.w * this.x + this.y * this.z);
        const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y);
        angles[0] = Math.atan2(sinr_cosp, cosr_cosp);
        const sinp = 2 * (this.w * this.y - this.z * this.x);
        if (Math.abs(sinp) >= 1) {
            angles[1] = (PI / 2) * Math.sign(sinp);
        }
        else {
            angles[1] = Math.asin(sinp);
        }
        const siny_cosp = 2 * (this.w * this.z + this.x * this.y);
        const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z);
        angles[2] = Math.atan2(siny_cosp, cosy_cosp);
        return angles;
    }
    toString(toFixed = 5) {
        return `Quaternion${this.rs ? ' (WRS)' : ''}: [${this.values.map((v) => v.toFixed(toFixed))}]`;
    }
    toArray() {
        return [...this.values];
    }
    get normalized() {
        return new Quaternion([...this.values]).normalize();
    }
    get w() {
        return this.values[0];
    }
    set w(w) {
        this.values[0] = w;
    }
    get x() {
        return this.values[1];
    }
    set x(x) {
        this.values[1] = x;
    }
    get y() {
        return this.values[2];
    }
    set y(y) {
        this.values[2] = y;
    }
    get z() {
        return this.values[3];
    }
    set z(z) {
        this.values[3] = z;
    }
    get signal() {
        if (this.rs)
            return this.rs;
        for (let index = 0; index < Quaternion.components.length; index++) {
            const c = Quaternion.components[index];
            this[`r${c}`] = Reactive.scalarSignalSource(`quat-${c}-${getUUIDv4()}`);
            this[`r${c}`].set(this[c]);
        }
        this.rs = Reactive.pack4(this.rw.signal, this.rx.signal, this.ry.signal, this.rz.signal);
        return this.rs;
    }
}
Quaternion.components = ['w', 'x', 'y', 'z'];
export class State {
    constructor(persistenceKey) {
        if (!persistenceKey) {
            throw new Error(`@ Volts.State: argument 'persistenceKey' is not defined`);
        }
        else {
            this.key = persistenceKey;
        }
        try {
            if (!Persistence)
                Persistence = require('Persistence');
        }
        catch {
            throw new Error(`@ Volts.State: Persistence is not enabled as a capability, or is not available in the current target platforms.\n\nTo use Volts.State, please go to your project capabilities, inspect the target platforms, and remove the ones that don't support "Persistence"`);
        }
        this._data = {};
        Object.defineProperty(this, 'loadState', {
            value: async () => {
                const loadedDataFromPersistence = await Promise.race([
                    Persistence.userScope.get(this.key).catch(() => {
                        return new Error(`@ Volts.State: The key provided: "${this.key}" is not whitelisted.\n\ngo to Project > Capabilities > Persistence > then write the key into the field (case sensitive). If there are multiple keys, separate them with spaces`);
                    }),
                    new Promise((resolve) => {
                        Time.setTimeout(resolve, 350);
                    }),
                ]);
                if (loadedDataFromPersistence instanceof Error) {
                    throw loadedDataFromPersistence;
                }
                if (loadedDataFromPersistence && loadedDataFromPersistence.data) {
                    this._data = JSON.parse(loadedDataFromPersistence.data);
                    const keys = Object.keys(this._data);
                    for (let index = 0; index < keys.length; index++) {
                        const key = keys[index];
                        if (this._data[key].dimension && Array.isArray(this._data[key].values)) {
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
    setPersistenceAPI() {
        Persistence.userScope.set(this.key, { data: JSON.stringify(this._data) });
    }
    setValue(key, value) {
        this.data[key] = value instanceof Vector ? value.copy() : value instanceof Quaternion ? value.copy() : value;
        this.setPersistenceAPI();
    }
    get data() {
        return this._data;
    }
}
export class Object3D {
    constructor(body) {
        this._pos = new Vector();
        this._rot = new Quaternion();
        this.vel = new Vector();
        this.acc = new Vector();
        this.size = new Vector();
        this.body = body;
        this.UUID = getUUIDv4();
        if (!(this.body && this.body.transform)) {
            throw new Error(`Object3D.constructor: Object body "${this.body && this.body.name ? this.body.name : this.body}" is not a valid Object3D body (needs to extend SceneObjectBase)`);
        }
        this.body.transform.position = this._pos.signal;
        this.body.transform.rotation = this._rot.signal;
    }
    async stayInPlace() {
        return await Promise.all([this.fetchLastPosition(), this.fetchLastRotation(), this.fetchSize()]).then(([pos, rot, size]) => {
            this._pos.values = pos.values;
            this._rot.values = rot.values;
            this.size.values = size.values;
        });
    }
    async fetchLastPosition() {
        const Instance = World.getInstance(false);
        if (!Instance)
            throw new Error(`No VOLTS.World Instance found`);
        const props = {};
        props[this.UUID + 'pos'] = this.body.transform.position;
        Instance.addToSnapshot(props);
        return await new Promise((resolve) => {
            Instance.onNextTick(() => {
                Instance.removeFromSnapshot(this.UUID + 'pos');
                resolve(Instance.snapshot[this.UUID + 'pos']);
            });
        });
    }
    async fetchLastRotation() {
        const Instance = World.getInstance(false);
        if (!Instance)
            throw new Error(`No VOLTS.World Instance found`);
        const props = {};
        props[this.UUID + 'rot'] = this.body.transform.rotation;
        Instance.addToSnapshot(props);
        return await new Promise((resolve) => {
            Instance.onNextTick(() => {
                Instance.removeFromSnapshot(this.UUID + 'rot');
                resolve(Instance.snapshot[this.UUID + 'rot']);
            });
        });
    }
    async fetchSize() {
        const Instance = World.getInstance(false);
        if (!Instance)
            throw new Error(`No VOLTS.World Instance found`);
        const props = {};
        props[this.UUID + 'size'] = this.body.boundingBox.max.sub(this.body.boundingBox.min);
        Instance.addToSnapshot(props);
        return await new Promise((resolve) => {
            Instance.onNextTick(() => {
                const snap = Instance.snapshot[this.UUID + 'size'];
                if (JSON.stringify(snap).indexOf('null,null,null') !== -1)
                    report('Cannot run Object3D.fetchSize on non-mesh object').asBackwardsCompatibleDiagnosticsError();
                Instance.removeFromSnapshot(this.UUID + 'size');
                resolve(Instance.snapshot[this.UUID + 'size']);
            });
        });
    }
    update(update = { position: true, rotation: true }) {
        if (update.position)
            this._pos.setSignalComponents();
        if (update.rotation)
            this._rot.setSignalComponents();
    }
    lookAtOther(otherObject) {
        this._rot.values = Quaternion.lookAt(this.pos, otherObject.pos).values;
    }
    lookAtHeading() {
        this._rot.values = Quaternion.lookAtOptimized(this.vel.values).values;
    }
    makeRigidBody() {
        safeImportPlugins('oimo', 1.0);
        const w = _plugins.oimo.createOimoWorld({ World }, {
            timestep: 1 / 30,
            iterations: 8,
            broadphase: 2,
            worldscale: 1,
            random: true,
            info: false,
            gravity: [0, -0.9807, 0],
        });
        const o = w.add({
            type: 'box',
            size: this.size.toArray(),
            pos: this._pos.toArray(),
            rot: this._rot.toEulerArray().map((v) => v * 57.2958),
            move: true,
            density: 1,
            friction: 1.0,
            restitution: 1.0,
            belongsTo: 1,
            collidesWith: 0xffffffff,
        });
        o.connectMesh(this);
    }
    set pos(xyz) {
        this._pos.values = xyz.values;
    }
    get pos() {
        return this._pos;
    }
    set rot(quat) {
        this._rot.values = quat.values;
    }
    get rot() {
        return this._rot;
    }
}
var SceneObjectClassNames;
(function (SceneObjectClassNames) {
    SceneObjectClassNames["Plane"] = "Plane";
    SceneObjectClassNames["Canvas"] = "Canvas";
    SceneObjectClassNames["PlanarImage"] = "PlanarImage";
    SceneObjectClassNames["AmbientLightSource"] = "AmbientLightSource";
    SceneObjectClassNames["DirectionalLightSource"] = "DirectionalLightSource";
    SceneObjectClassNames["PointLightSource"] = "PointLightSource";
    SceneObjectClassNames["SpotLightSource"] = "SpotLightSource";
    SceneObjectClassNames["ParticleSystem"] = "ParticleSystem";
    SceneObjectClassNames["SceneObject"] = "SceneObject";
})(SceneObjectClassNames || (SceneObjectClassNames = {}));
export class Pool {
    constructor(objectsOrPath, root, initialState = {}) {
        if (!Blocks.instantiate)
            throw new Error(`@ VOLTS.Pool.constructor: Dynamic instances capability is not enabled.\n\nPlease go to Project > Properties > Capabilities > + Scripting Dynamic Instantiation`);
        if (!objectsOrPath)
            throw new Error(`@ VOLTS.Pool.constructor: objectsOrPath is undefined`);
        this.seed = Array.isArray(objectsOrPath) ? objectsOrPath : [objectsOrPath];
        this.objects = [];
        this.initialState = initialState;
        if (root)
            this.root = this.setRoot(root);
    }
    async instantiate() {
        const assetName = this.seed[Math.floor(Math.random() * this.seed.length)];
        const i = await (Object.values(SceneObjectClassNames).includes(assetName)
            ? Scene.create(assetName, this.initialState)
            : Blocks.instantiate(assetName, this.initialState));
        this.root = (this.root || {}).then ? await this.root.catch(() => undefined) : this.root;
        if (!this.root || !this.root.addChild)
            throw new Error(`@ VOLTS.Pool.instantiate: No root was provided, or the string provided did not match a valid SceneObject`);
        await this.root.addChild(i);
        this.objects.push(new Object3D(i));
    }
    async getObject() {
        let obj = this.objects.pop();
        if (!obj) {
            await this.instantiate();
            obj = this.objects.pop();
        }
        obj.returnToPool = () => this.objects.push(obj);
        return obj;
    }
    async populate(amount, limitConcurrentPromises) {
        await promiseAllConcurrent(limitConcurrentPromises || 10, true)(new Array(amount).fill(this.instantiate.bind(this)));
    }
    async setRoot(newRoot) {
        this.root = typeof newRoot === 'string' ? await Scene.root.findFirst(newRoot).catch(() => undefined) : newRoot;
        if (!this.root)
            throw new Error(`Error @ VOLTS.Pool.setRoot: Scene.root.findFirst was unable to find the provided root: "${newRoot}"`);
        return this.root;
    }
    get hasPreInstancedObjectsAvailable() {
        return this.objects.length > 0;
    }
    get preInstancedObjectsCount() {
        return this.objects.length;
    }
}
Pool.SceneObjects = SceneObjectClassNames;
const makeDevEnvOnly = (d) => {
    try {
        jest;
        return d;
    }
    catch {
        throw `Cannot read 'private.clearVoltsWorld' in the current environment. To be read by jest/testing env only`;
    }
};
function privateRead(obj) {
    const tmp = {};
    const keys = Object.keys(obj);
    for (let index = 0; index < keys.length; index++) {
        const k = keys[index];
        Object.defineProperty(tmp, k, {
            get: () => makeDevEnvOnly(obj[k]),
        });
    }
    return obj;
}
export const privates = privateRead({
    clearVoltsWorld: VoltsWorld.devClear,
    report: report,
    promiseAllConcurrent: promiseAllConcurrent,
});
export const World = {
    getInstance: VoltsWorld.getInstance,
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
    plugins,
};
(!(Reactive.scalarSignalSource)) && report('Please enable Writeable Signal Sources in the project capabilities for Volts to work properly').asBackwardsCompatibleDiagnosticsError();
