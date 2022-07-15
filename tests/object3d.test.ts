import { Object3D, privates, Quaternion, Vector, World } from '../volts';
import Reactive, { ScalarSignal, VectorSignal } from './__mocks__/Reactive';
import Scene, { SceneObjectBase } from './__mocks__/Scene';
import Blocks, { BlockInstance } from './__mocks__/Blocks';

jest.useFakeTimers();

describe('constructor', () => {
  test('from scene obj', async () => {
    const obj = await Scene.root.findFirst('a-scene-obj');
    expect(() => new Object3D(obj)).not.toThrow();
  });
  test('dynamic plane instance body', async () => {
    const spy = jest
      .spyOn(Scene, 'create')
      .mockImplementation(async () => new SceneObjectBase('JEST_DYNAMIC_INSTANCE'));
    expect(() => new Object3D()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockReset();
    spy.mockRestore();
  });
  test('dynamic Block instance body', async () => {
    const spy = jest.spyOn(Blocks, 'instantiate');
    expect(() => new Object3D('JEST_DYNAMIC_INSTANCE')).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockReset();
    spy.mockRestore();
  });
});

describe('reactive values', () => {
  test('from scene obj', async () => {
    const Instance = World.getInstance({ mode: 'DEV' });
    jest.advanceTimersByTime(100);
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D(sceneObj);
    obj.body.transform.position = Reactive.vector(1, 2, 3);
    obj.body.transform.rotation = Reactive.quaternion(1, 2, 3, 4);
    // await expect(obj.fetchLastPosition()).resolves.not.toThrow();
    // await expect(obj.fetchLastRotation()).resolves.not.toThrow();
    // await expect(obj.fetchSize()).resolves.not.toThrow();
    // await expect(obj.stayInPlace()).resolves.not.toThrow();
    // expect(obj.pos.values).toEqual([1, 2, 3]);
    // expect(obj.rot.values).toEqual([1, 2, 3, 4]);
    Instance.stop();
    jest.advanceTimersByTime(100);
    privates.clearVoltsWorld();
  });
  test('update', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D(sceneObj);
    obj.pos = new Vector(1, 2, 3);
    obj.rot = new Quaternion(1, 0, 0, 0);
    obj.update({ pos: true, rot: true });
    obj.update({ pos: false, rot: false });
    expect(obj.pos.values).toEqual([1, 2, 3]);
    expect(obj.rot.values).toEqual([1, 0, 0, 0]);
  });
});

describe('utils', () => {
  test('setPos setRot setScl setMaterial', () => {
    expect(() =>
      new Object3D(undefined).setPos(1, 1, 1).setRot(Quaternion.identity()).setScl(0.1).setMaterial(undefined),
    ).not.toThrow();
  });
  test('lookAtOther', async () => {
    const sceneObjOne: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const sceneObjTwo: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const first = new Object3D(sceneObjOne);
    const second = new Object3D(sceneObjTwo);

    expect(() => first.lookAtOther(second)).not.toThrow();
  });
  test('lookAtHeading', async () => {
    const sceneObjOne: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D(sceneObjOne);
    obj.vel = new Vector(0, 0, 1);

    expect(() => obj.lookAtHeading()).not.toThrow();
    expect(obj.rot.values).toEqual([1, 0, 0, 0]);
  });
  test('body promise', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj3d = new Object3D(sceneObj);
    const dynamicInstance = new Object3D();

    expect(obj3d.body).toBe(sceneObj);
    expect(dynamicInstance.body).toBeTruthy();
    await expect(dynamicInstance.body).resolves.toBeInstanceOf(SceneObjectBase);
  });
  test('createDebugMaterial', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj3d = new Object3D(sceneObj);
    expect(Object3D.createDebugMaterial()).resolves.not.toThrow();
  });

  test('destroyDynamicBody', () => {
    expect(() => new Object3D('JEST_DYNAMIC_INSTANCE').destroyDynamicBody()).not.toThrow();
    expect(() => new Object3D().destroyDynamicBody()).not.toThrow();
    expect(() => new Object3D(null).destroyDynamicBody()).toThrow();
  });
});

describe('physics', () => {
  test('createPhysicsSolver', () => {
    expect(Object3D.createPhysicsSolver).not.toThrow();
  });

  test('usePhysics', () => {
    const obj = new Object3D();
    // test || [].push
    new Object3D().usePhysics();
    expect(() => obj.usePhysics()).not.toThrow();
    expect( obj.Solver ).toBeDefined();
    expect( obj.Solver ).not.toThrow();
    const spy = jest.spyOn(obj, 'Solver').mockImplementation();
    expect(() => obj.update({ solver: true }) ).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockReset();
    spy.mockRestore();
  });

})
