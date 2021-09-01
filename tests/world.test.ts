import { World, Vector, PublicOnly, PRODUCTION_MODES } from '../volts';
import Scene, { SceneObjectBase } from './__mocks__/Scene';
import Reactive from './__mocks__/Reactive';
import Time from './__mocks__/Time';

jest.useFakeTimers();

describe('world construction', () => {
  test('default world', () => {
    const world = World.getInstance({ mode: PRODUCTION_MODES.NO_AUTO });
    expect(world.mode).toEqual(PRODUCTION_MODES.NO_AUTO);

    World.devClear();
    // @ts-ignore
    expect(() => World.getInstance({})).toThrow();

    World.devClear();
    // @ts-ignore
    expect(() => World.getInstance()).toThrow();
  });
  test('incorrect dev mode', () => {
    World.devClear();
    // @ts-ignore
    expect(() => World.getInstance({ mode: 'not-a-mode' })).toThrow();

    World.devClear();
    // @ts-ignore
    expect(() => World.getInstance({ mode: true })).toThrow();

    World.devClear();
    // @ts-ignore
    expect(() => World.getInstance({ mode: { dev: true } })).toThrow();
  });
  test('run/stop functions', () => {
    World.devClear();
    const world = World.getInstance({
      mode: 'NO_AUTO',
    });
    expect(World.getInstance().run()).toBeTruthy();
    expect(World.getInstance().stop()).toBeTruthy();
    expect(World.getInstance().stop()).toBeFalsy();
  });
});

describe('load assets', () => {
  test('scene mocks', async () => {
    await expect(() => Scene.root.findFirst('fail')).rejects.toThrow();
    await expect(Scene.root.findByPath('any-other-string')).resolves.toBeTruthy();
  });

  test('valid objects', async () => {
    World.devClear();
    // This one is actually doing the entire set up
    await expect(
      World.getInstance({
        mode: 'NO_AUTO',
        assets: {
          obj: Scene.root.findFirst('obj'),
        },
        // @ts-ignore
      }).rawInitPromise,
    ).resolves.not.toThrow();
  });

  test('invalid objects', async () => {
    World.devClear();
    await expect(
      () =>
        World.getInstance({
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
    World.devClear();
    const world = World.getInstance({
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
    World.devClear();
    const world = World.getInstance({
      mode: PRODUCTION_MODES.DEV,
      assets: {
        obj: Scene.root.findFirst('obj'),
      },
      snapshot: {},
      loadStates: undefined,
    });
    expect(world.running).toEqual(false);
    // @ts-ignore
    await world.rawInitPromise.then(() => {
      expect(world.loaded).toEqual(true);
      expect(world.running).toEqual(true);
      expect(world.assets.obj[0]).toBeInstanceOf(SceneObjectBase);
      expect(world.frameCount).toBeDefined();
    });

    // await new Promise((resolve) => {
    //   setTimeout(resolve, 300);
    // });

    jest.advanceTimersByTime(100);

    expect(world.running).toEqual(true);
    expect(World.getInstance().mode).toEqual(PRODUCTION_MODES.DEV);
    expect(world.frameCount).toBeGreaterThan(1);

    World.getInstance().stop();
  }, 500);

  test('snapshot', async () => {
    World.devClear();
    const World = World.getInstance({
      mode: 'DEV',
      snapshot: {
        scalar: Reactive.val(1),
        point2D: Reactive.point2d(1, 5),
        point3D: Reactive.vector(1, 5, 10),
        point4D: Reactive.pack4(1, 5, 10, 15),
        string: Reactive.stringSignal('a-string'),
      },
    });

    World.addToSnapshot({added: Reactive.point2d(1,2)});

    // @ts-ignore
    await World.rawInitPromise.then(() => {
      jest.advanceTimersByTime(100);
      expect(World.snapshot.scalar).toEqual(1);
      expect(World.snapshot.point2D.values).toEqual([1, 5]);
      expect(World.snapshot.point3D.values).toEqual([1, 5, 10]);
      expect(World.snapshot.point4D.values).toEqual([1, 5, 10, 15]);
      expect(World.snapshot.string).toEqual('a-string');

      // @ts-ignore
      expect(World.snapshot.added.values).toEqual([1,2]);
      expect(()=>World.removeFromSnapshot('added')).not.toThrow();
      jest.advanceTimersByTime(100);
      // @ts-ignore
      expect(World.snapshot.added).not.toBeDefined();
    });
  }, 500);
  test('events - onEvent/emitEvent', async () => {
    World.devClear();
    const World = World.getInstance({
      mode: 'NO_AUTO',
    });

    let i = 0;
    const fn = (function(){i++}).bind(this);
    World.onEvent('evt', fn);
    World.emitEvent('evt');
    expect(i).toEqual(1);
  }, 500);
});
