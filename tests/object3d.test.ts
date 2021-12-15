import { Object3D, Quaternion, Vector } from '../volts';
import Reactive, { ScalarSignal, VectorSignal } from './__mocks__/Reactive';
import Scene, { SceneObjectBase } from './__mocks__/Scene';

describe('constructor', () => {
  test('from scene obj', async () => {
    const obj = await Scene.root.findFirst('a-scene-obj');
    expect(() => new Object3D(obj, false)).not.toThrow();
  });
});

describe('fetch reactive values', () => {
  test('from scene obj', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D(sceneObj, false);
    obj.body.transform.position = Reactive.vector(1, 2, 3);
    obj.body.transform.rotation = Reactive.quaternion(1, 2, 3, 4);

    expect(() => obj.fetchLastPosition()).not.toThrow();
    expect(() => obj.fetchLastRotation()).not.toThrow();

    expect(obj.pos.values).toEqual([1, 2, 3]);
    expect(obj.rot.values).toEqual([1, 2, 3, 4]);
  });
  test('stayInPlace', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D(sceneObj, true);

    expect(obj.pos.values).toEqual([0, 0, 0]);
    expect(obj.rot.values).toEqual([1, 0, 0, 0]);
  });
  test('update', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D(sceneObj, true);

    obj.pos = new Vector(1, 2, 3);
    obj.rot = new Quaternion(1, 0, 0, 0);
    obj.update({ position: true, rotation: true });

    expect(obj.pos.values).toEqual([1, 2, 3]);
    expect(obj.rot.values).toEqual([1, 0, 0, 0]);
  });
});
