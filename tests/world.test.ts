import { VOLTSWorld, PublicOnly, PRODUCTION_MODES } from '../volts';
import Scene, { SceneObjectBase } from './__mocks__/Scene';

describe('world construction', () => {
  test('default world', () => {
    const world = VOLTSWorld.getInstance({ mode: PRODUCTION_MODES.NO_AUTO });
    expect(world.mode).toEqual(PRODUCTION_MODES.NO_AUTO);

    VOLTSWorld.devClear();
    // @ts-ignore
    expect(() => VOLTSWorld.getInstance({})).toThrow();

    VOLTSWorld.devClear();
    // @ts-ignore
    expect(() => VOLTSWorld.getInstance()).toThrow();
  });
  test('incorrect dev mode', () => {
    VOLTSWorld.devClear();
    // @ts-ignore
    expect(() => VOLTSWorld.getInstance({ mode: 'not-a-mode' })).toThrow();

    VOLTSWorld.devClear();
    // @ts-ignore
    expect(() => VOLTSWorld.getInstance({ mode: true })).toThrow();

    VOLTSWorld.devClear();
    // @ts-ignore
    expect(() => VOLTSWorld.getInstance({ mode: { dev: true } })).toThrow();
  });
  test('run/stop functions', () => {
    VOLTSWorld.devClear();
    const world = VOLTSWorld.getInstance({
      mode: 'NO_AUTO',
    });
    expect(VOLTSWorld.getInstance().run()).toBeTruthy();
    expect(VOLTSWorld.getInstance().stop()).toBeTruthy();
    expect(VOLTSWorld.getInstance().stop()).toBeFalsy();
  });
});

describe('load assets', () => {
  test('scene mocks', async () => {
    await expect(() => Scene.root.findFirst('fail')).rejects.toThrow();
    await expect(Scene.root.findByPath('any-other-string')).resolves.toBeTruthy();
  });

  test('valid objects', async () => {
    VOLTSWorld.devClear();
    // This one is actually doing the entire set up
    await expect(
      VOLTSWorld.getInstance({
        mode: 'NO_AUTO',
        assets: {
          obj: Scene.root.findFirst('obj'),
        },
        // @ts-ignore
      }).rawInitPromise,
    ).resolves.not.toThrow();
  });

  test('invalid objects', async () => {
    VOLTSWorld.devClear();
    await expect(
      () =>
        VOLTSWorld.getInstance({
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
    VOLTSWorld.devClear();
    const world = VOLTSWorld.getInstance({
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
      expect(world.stop()).toEqual(false);
    });
  });

  test('run - mode.dev', async () => {
    // expect.assertions(6);
    VOLTSWorld.devClear();
    const world = VOLTSWorld.getInstance({
      mode: PRODUCTION_MODES.DEV,
      assets: {
        obj: Scene.root.findFirst('obj'),
      },
      snapshot: {},
      loadStates: undefined
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
      setTimeout(resolve, 300);
    });

    expect(world.running).toEqual(true);
    expect(VOLTSWorld.getInstance().mode).toEqual(PRODUCTION_MODES.DEV);
    expect(world.frameCount).toBeGreaterThan(1);

    VOLTSWorld.getInstance().stop();
  }, 500);
});
