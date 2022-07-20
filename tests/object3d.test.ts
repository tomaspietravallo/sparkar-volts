import { Object3D, privates, Quaternion, Vector, World } from '../volts';
import Reactive, { ScalarSignal, VectorSignal } from './__mocks__/Reactive';
import Scene, { SceneObjectBase } from './__mocks__/Scene';
import Blocks, { BlockInstance } from './__mocks__/Blocks';

jest.useFakeTimers();

describe('constructor', () => {
  test('from scene obj', async () => {
    const obj = await Scene.root.findFirst('a-scene-obj');
    expect(() => new Object3D({body: obj})).not.toThrow();
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
    expect(() => new Object3D({body: 'JEST_DYNAMIC_INSTANCE'})).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockReset();
    spy.mockRestore();
  });
  test('all || conditions', () => {
    // @ts-expect-error
    expect(() => new Object3D(false)).not.toThrow();
    expect(() => new Object3D({
      body: undefined,
      pos: new Vector(1),
      vel: new Vector(2),
      acc: new Vector(3),
      rot: Quaternion.fromEuler(Math.PI, 0, 0),
      ang_vel: Quaternion.identity(),
      scl: new Vector(2),
      mass: 10.0,
      awake: true,
    })).not.toThrow();
  })
});

describe('reactive values', () => {
  test('from scene obj', async () => {
    const Instance = World.getInstance({ mode: 'DEV' });
    jest.advanceTimersByTime(100);
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D({body: sceneObj});
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
    const obj = new Object3D({body: sceneObj});
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
    const first = new Object3D({body: sceneObjOne});
    const second = new Object3D({body: sceneObjTwo});

    expect(() => first.lookAtOther(second)).not.toThrow();
  });
  test('lookAtHeading', async () => {
    const sceneObjOne: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj = new Object3D({body: sceneObjOne});
    obj.vel = new Vector(0, 0, 1);

    expect(() => obj.lookAtHeading()).not.toThrow();
    expect(obj.rot.values).toEqual([1, 0, 0, 0]);
  });
  test('body promise', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj3d = new Object3D({body: sceneObj});
    const dynamicInstance = new Object3D();

    expect(obj3d.body).toBe(sceneObj);
    expect(dynamicInstance.body).toBeTruthy();
    await expect(dynamicInstance.body).resolves.toBeInstanceOf(SceneObjectBase);
  });
  test('createDebugMaterial', async () => {
    const sceneObj: SceneObjectBase = await Scene.root.findFirst('a-scene-obj');
    const obj3d = new Object3D({body: sceneObj});
    expect(Object3D.createDebugMaterial()).resolves.not.toThrow();
  });

  test('destroyDynamicBody', () => {
    expect(() => new Object3D({body: 'JEST_DYNAMIC_INSTANCE'}).destroyDynamicBody()).not.toThrow();
    expect(() => new Object3D().destroyDynamicBody()).not.toThrow();
    expect(() => new Object3D({body: null}).destroyDynamicBody()).toThrow();
  });
});

/**
 * Tests marked with CASIO have been double checked with UARM/MRUV formulas and a calculator
 */
describe('physics', () => {
  test('createPhysicsSolver', () => {
    expect(() => Object3D.createPhysicsSolver(new Object3D())(30)).not.toThrow();
    expect(() => Object3D.createPhysicsSolver(new Object3D(), { solver: 'verlet' })(new Object3D(), 0)).not.toThrow();
    // @ts-expect-error
    expect(() => Object3D.createPhysicsSolver(new Object3D(), { solver: 'xxxxxx' })(new Object3D(), 0)).toThrow();
  });

  test('usePhysics', () => {
    const obj = new Object3D();
    // test || [].push
    new Object3D().usePhysics();
    expect(() => obj.usePhysics()).not.toThrow();
    expect( obj.Solver ).toBeDefined();
    expect( () => obj.Solver( 33.33) ).not.toThrow();
    const spy = jest.spyOn(obj, 'Solver').mockImplementation();
    expect(() => obj.update({ solver: true }) ).not.toThrow();
    expect(() => obj.update({ solver: true, delta: 30 }) ).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(2);
    // @ts-expect-error
    expect(() => new Object3D().usePhysics({solver: 'this-is-not-a-solver'})()).toThrow();
    spy.mockReset();
    spy.mockRestore();
  });

  test('static object', () => {
    expect.assertions(9);
    const obj = new Object3D().usePhysics({ solver: 'verlet', steps: 1, drag: 1.0, gravity: 0.0 });
    // 1000ms == 1s
    obj.update({ pos: true, rot: true, solver: true, delta: 1000 });
    obj.pos.values.forEach((v) => expect(v).toBeCloseTo(0));
    obj.vel.values.forEach((v) => expect(v).toBeCloseTo(0));
    obj.acc.values.forEach((v) => expect(v).toBeCloseTo(0))
  })

  test('constant speed - CASIO', () => {
    expect.assertions(9);
    const obj = new Object3D().usePhysics({ solver: 'verlet', steps: 1, drag: 1.0, gravity: 0.0 });
    obj.vel = new Vector(0,0,1);
    // 1000ms == 1s
    obj.update({ pos: true, rot: true, solver: true, delta: 1000 });
    obj.pos.values.forEach((v, i) => expect(v).toBeCloseTo([0,0,1][i]));
    obj.vel.values.forEach((v, i) => expect(v).toBeCloseTo([0,0,1][i]));
    obj.acc.values.forEach((v) => expect(v).toBeCloseTo(0))
  })

  test('parabolic trajectory - CASIO', () => {
    expect.assertions(9);
    const obj = new Object3D().usePhysics({ solver: 'verlet', steps: 10, drag: 1.0, gravity: -10.0 });
    obj.vel = new Vector(0,0,1);
    obj.acc = new Vector(0,-10,0);
    // 1000ms == 1s
    // @todo remove using more steps
    obj.update({ pos: true, rot: true, solver: true, delta: 1000 });
    obj.pos.values.forEach((v, i) => expect(v).toBeCloseTo([0,-5, 1][i]));
    obj.vel.values.forEach((v, i) => expect(v).toBeCloseTo([0,-10,1][i]));
    obj.acc.values.forEach((v, i) => expect(v).toBeCloseTo([0,-10,0][i]));
  });

  test('solveCollision', () => {
    expect(() => Object3D.solveCollision(new Object3D(), new Object3D())).not.toThrow();
  })

})
