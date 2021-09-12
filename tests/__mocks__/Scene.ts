import Reactive, { ScalarSignal, VectorSignal } from './Reactive';

export class SceneObjectBase {
  name: string;
  transform: { position: Reactive.VectorSignal; rotation: Reactive.Quaternion };
  identifier: string;
  constructor(name: string) {
    this.name = name;
    this.transform = {
      position: Reactive.vector(0, 0, 0),
      rotation: Reactive.quaternion(0, 0, 0, 0),
    };
    this.identifier = 'a-unique-identifier'
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
    return new VectorSignal(Math.random(), Math.random(), 0.586);
  },
};
