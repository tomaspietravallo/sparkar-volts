import { Vector, Pool } from '../../volts';
import Reactive, { ScalarSignal, VectorSignal, BoolSignal } from './Reactive';

let instanced = 0;

const FOCAL_DISTANCE = 0.586;
const SCREEN_SIZE = [Math.random(), Math.random()];

export class SceneObjectBase {
  name: string;
  transform: { position: Reactive.VectorSignal; rotation: Reactive.Quaternion };
  identifier: string;
  material: { identifier: string, getDiffuse: () => object };
  hidden: BoolSignal;
  constructor(name: string) {
    this.name = name;
    this.transform = {
      position: Reactive.vector(0, 0, 0),
      rotation: Reactive.quaternion(1, 0, 0, 0),
    };
    this.boundingBox = {
      max: Reactive.vector(0, 0, 0),
      min: Reactive.vector(0, 0, 0),
    };
    this.identifier = 'a-unique-identifier';
    this.hidden = Reactive.boolSignal(false);
    this.material = { identifier: 'id-xxx-material-JEST', getDiffuse: () => { return { identifier: 'id-fromMaterial-texture-JEST' }} }
  }
  async addChild(child: SceneObjectBase): Promise<void> {
    if (!child) throw new Error(`No child was provided @ mock.Scene.SceneObjectBase.addChild`);
    return;
  }
  async destroy() {
    /** ... */
  }
  async getMaterial() {
    return this.material;
  }
}

export class Camera extends SceneObjectBase {
  focalPlane: { distance: ScalarSignal; height: ScalarSignal; width: ScalarSignal };
  constructor(name: string) {
    super(name);
    this.focalPlane = {
      distance: new ScalarSignal(0.586),
      width: new ScalarSignal(0.281),
      height: new ScalarSignal(0.5),
    };
  }
}

declare global {
  namespace Scene {
    export type SceneObjectBase = typeof SceneObjectBase.prototype;
    export type Camera = typeof Camera.prototype;
  }
}

export default {
  root: {
    addChild: async (obj: SceneObjectBase) => {
      if (!obj || !obj.name || obj.name.indexOf('JEST_DYNAMIC_INSTANCE') === -1) {
        throw new Error(
          `The object passed to addChild is not a dynamic instance. This can result in unpredictable behaviour inside of Spark. Object is not marked with JEST_DYNAMIC_INSTANCE`,
        );
      }
    },
    removeChild: async (obj: SceneObjectBase) => {
      /** ... */
    },
    findFirst: (s: string): Promise<SceneObjectBase> => {
      return new Promise((resolve) => {
        const shouldFail = s.toLowerCase().indexOf('fail') !== -1;
        const reqCamera = s.indexOf('Camera') !== -1;
        if (shouldFail) throw new Error('The object was not found');
        if (reqCamera) resolve(new Camera(s));
        resolve(new SceneObjectBase(s));
      });
    },
    findByPath: (s: string): Promise<SceneObjectBase[]> => {
      return new Promise((resolve) => {
        const shouldFail = s.toLowerCase().indexOf('fail') !== -1;
        if (shouldFail) throw new Error('The object was not found');
        let objs: SceneObjectBase[] = [];
        let i = Math.floor(Math.random() * 5) + 1;
        while (i--) {
          objs.push(new SceneObjectBase(`${s}${i}`));
        }
        resolve(objs);
      });
    },
  },
  unprojectToFocalPlane: (p: Reactive.Vec2Signal): VectorSignal => {
    // @ts-ignore
    // not actually how unprojectToFocalPlane works in Spark, good enough for testing
    return new VectorSignal(SCREEN_SIZE[0], SCREEN_SIZE[1], FOCAL_DISTANCE).mul(
      <number>p.x.pinLastValue(),
      <number>p.y.pinLastValue(),
      1,
    );
  },
  create: async (className: string) => {
    instanced++;
    if (!Pool.SceneObjects[className]) throw `${className} is not a dynamic object class (Scene mock)`;
    return new SceneObjectBase(className + instanced + 'JEST_DYNAMIC_INSTANCE');
  },
};
