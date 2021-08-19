import Reactive, { ScalarSignal, VectorSignal } from "./Reactive";

export class SceneObjectBase {
    transform: { position: Reactive.VectorSignal, rotation: Reactive.Quaternion };
    constructor(){
        this.transform = {
            position: Reactive.vector(0,0,0),
            rotation: Reactive.quaternion(0,0,0,0)
        };
    };
}

export class Camera extends SceneObjectBase {
    focalPlane: { distance: ScalarSignal, height:ScalarSignal, width:ScalarSignal };
    constructor(){
        super();
        this.focalPlane = {
            distance: new ScalarSignal(0.586),
            width: new ScalarSignal(0.281),
            height: new ScalarSignal(0.500)
        }
    }
}

declare global {
    namespace Scene {
        export type SceneObjectBase = typeof SceneObjectBase.prototype
        export type Camera = typeof Camera.prototype;
    }
}

export default {
    root: {
        findFirst: (s: string): Promise<SceneObjectBase> => {
            return new Promise((resolve, reject)=>{
                const shouldFail = s.toLowerCase().indexOf('fail');
                if (shouldFail) reject('The object was not found');
                resolve(new SceneObjectBase());
            });
        },
        findByPath: (s: string): Promise<SceneObjectBase[]> => {
            return new Promise((resolve, reject)=>{
                const shouldFail = s.toLowerCase().indexOf('fail');
                if (shouldFail) reject('The object was not found');
                let objs: SceneObjectBase[];
                let i = Math.floor(Math.random() * 5) + 1;
                while(i--){
                    objs.push(new SceneObjectBase());
                };
                resolve(objs);
            });
        },
    },
    unprojectToFocalPlane: (p: Reactive.Vec2Signal): VectorSignal => {
        return new VectorSignal(Math.random(), Math.random(), 0.586)
    }
};
