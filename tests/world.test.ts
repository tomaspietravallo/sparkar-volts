import { World, PublicOnly, PRODUCTION_MODES, __clearGlobalInstance, RUN, STOP } from '../volts';
import Scene, { SceneObjectBase } from './__mocks__/Scene';

describe('world construction', () => {
  test('default world', () => {
    __clearGlobalInstance();
    const world = new World({ mode: PRODUCTION_MODES.NO_AUTO });
    expect(world.MODE).toEqual(PRODUCTION_MODES.NO_AUTO);

    __clearGlobalInstance();
    // @ts-ignore
    expect(() => new World({})).toThrow();
  });
  test('incorrect dev mode', () => {
    __clearGlobalInstance();
    // @ts-ignore
    expect(() => new World({ mode: 'not-a-mode' })).toThrow();

    __clearGlobalInstance();
    // @ts-ignore
    expect(() => new World({ mode: true })).toThrow();

    __clearGlobalInstance();
    // @ts-ignore
    expect(() => new World({ mode: { dev: true } })).toThrow();
  });
  test('exported utils', () => {
    __clearGlobalInstance();
    const world = new World({
      mode: 'NO_AUTO',
    });
    expect(RUN()).toBeTruthy();
    expect(STOP()).toBeTruthy();
    expect(STOP()).toBeUndefined();
  });
});

describe('load assets', () => {
  test('scene mocks', async () => {
    await expect(() => Scene.root.findFirst('fail')).rejects.toThrow();
    await expect(Scene.root.findByPath('any-other-string')).resolves.toBeTruthy();
  });

  test('valid objects', async () => {
    __clearGlobalInstance();
    // This one is actually doing the entire set up
    await expect(
      new World({
        mode: 'NO_AUTO',
        assets: {
          obj: Scene.root.findFirst('obj'),
        },
      }).rawInitPromise,
    ).resolves.not.toThrow();
  });

  test('invalid objects', async () => {
    __clearGlobalInstance();
    await expect(
      () =>
        new World({
          mode: 'NO_AUTO',
          assets: {
            sceneObjZero: Scene.root.findFirst('object-zero'),
            arrayOfObjs: Scene.root.findByPath('**/FAIL-TO-LOAD/*'),
          },
          // @ts-ignore
        }).rawInitPromise,
    ).rejects.toThrow();
  });
});

describe('test real world use cases', () => {
  test('load objects - mode.no_auto', async () => {
    expect.assertions(4);
    __clearGlobalInstance();
    const world = new World({
      mode: PRODUCTION_MODES.NO_AUTO,
      assets: {
        obj: Scene.root.findFirst('obj'),
      },
    });
    expect(world.running).toEqual(false);
    // @ts-ignore
    await world.rawInitPromise.then(() => {
      expect(world.loaded).toEqual(true);
      expect(world.running).toEqual(false);
      expect(STOP()).toEqual(undefined);
    });
  });

  test('run - mode.dev', async () => {
    expect.assertions(6);
    __clearGlobalInstance();
    const world = new World({
      mode: PRODUCTION_MODES.DEV,
      assets: {
        obj: Scene.root.findFirst('obj'),
      },
    });
    expect(world.running).toEqual(false);
    // @ts-ignore
    await world.rawInitPromise.then(() => {
      expect(world.loaded).toEqual(true);
      expect(world.running).toEqual(true);
      expect(world.assets.obj[0]).toBeInstanceOf(SceneObjectBase);
      expect(world.frameCount).toBeDefined();
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(world.frameCount).toBeGreaterThan(1);

    STOP();
  }, 500);
});
