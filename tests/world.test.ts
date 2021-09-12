import { World, Vector, PublicOnly, PRODUCTION_MODES, privates } from '../volts';
import Scene, { SceneObjectBase } from './__mocks__/Scene';
import Reactive from './__mocks__/Reactive';
import Time from './__mocks__/Time';
import Diagnostics from './__mocks__/Diagnostics';

jest.useFakeTimers();

describe('world construction', () => {
  test('default world', () => {
    privates.clearVoltsWorld();
    const world = World.getInstance({ mode: PRODUCTION_MODES.NO_AUTO });
    expect(world.mode).toEqual(PRODUCTION_MODES.NO_AUTO);

    privates.clearVoltsWorld();
    // @ts-ignore
    expect(() => World.getInstance({})).toThrow();

    privates.clearVoltsWorld();
    // @ts-ignore
    expect(() => World.getInstance()).toThrow();
  });
  test('incorrect dev mode', () => {
    privates.clearVoltsWorld();
    // @ts-ignore
    expect(() => World.getInstance({ mode: 'not-a-mode' })).toThrow();

    privates.clearVoltsWorld();
    // @ts-ignore
    expect(() => World.getInstance({ mode: true })).toThrow();

    privates.clearVoltsWorld();
    // @ts-ignore
    expect(() => World.getInstance({ mode: { dev: true } })).toThrow();
  });
  test('run/stop functions', () => {
    privates.clearVoltsWorld();
    const world = World.getInstance({
      mode: 'NO_AUTO',
    });
    expect(World.getInstance().run()).toBeTruthy();
    expect(World.getInstance().stop()).toBeTruthy();
    expect(World.getInstance().stop()).toBeFalsy();
  });
  test('instance already created', () => {
    privates.clearVoltsWorld();
    expect(World.getInstance(false)).toBeUndefined();
    expect(() => World.getInstance()).toThrow();

    const world = World.getInstance({ mode: PRODUCTION_MODES.NO_AUTO });
    expect(world.mode).toEqual(PRODUCTION_MODES.NO_AUTO);

    // would overwrite
    World.getInstance({ mode: 'NO_AUTO', snapshot: { thisIsAnInvalidConfig: Reactive.val(1) } });
    expect(Diagnostics.warn).toHaveBeenCalledTimes(1);

    expect(World.getInstance()).toEqual(world);
  });
});

describe('load assets', () => {
  test('scene mocks', async () => {
    await expect(() => Scene.root.findFirst('fail')).rejects.toThrow();
    await expect(Scene.root.findByPath('any-other-string')).resolves.toBeTruthy();
  });

  test('valid objects', async () => {
    privates.clearVoltsWorld();
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

    await expect(World.getInstance().forceAssetReload()).resolves.toBeUndefined();
  });

  test('invalid objects', async () => {
    privates.clearVoltsWorld();
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

    await expect(() => World.getInstance().forceAssetReload()).rejects.toThrow();
  });
});

describe('snapshot', () => {
  test('snapshot', async () => {
    privates.clearVoltsWorld();
    const W = World.getInstance({
      mode: 'DEV',
      snapshot: {
        scalar: Reactive.val(1),
        point2D: Reactive.point2d(1, 5),
        point3D: Reactive.vector(1, 5, 10),
        point4D: Reactive.pack4(1, 5, 10, 15),
        string: Reactive.stringSignal('a-string'),
      },
    });

    W.addToSnapshot({ added: Reactive.point2d(1, 2) });

    expect(() => W.addToSnapshot({ notSupported: { definitelyNotASignal: null } })).toThrow();

    // @ts-ignore
    await W.rawInitPromise.then(() => {
      jest.advanceTimersByTime(100);
      expect(W.snapshot.scalar).toEqual(1);
      expect(W.snapshot.point2D.values).toEqual([1, 5]);
      expect(W.snapshot.point3D.values).toEqual([1, 5, 10]);
      expect(W.snapshot.point4D.values).toEqual([1, 5, 10, 15]);
      expect(W.snapshot.string).toEqual('a-string');

      // @ts-ignore
      expect(W.snapshot.added.values).toEqual([1, 2]);
      expect(() => W.removeFromSnapshot('added')).not.toThrow();
      jest.advanceTimersByTime(100);
      // @ts-ignore
      expect(W.snapshot.added).not.toBeDefined();
    });
  }, 500);
  test('signalToSnapshotable', async () => {
    privates.clearVoltsWorld();
    const W = World.getInstance({
      mode: 'DEV',
      snapshot: {},
    });
    expect(() => {
      W.onEvent('internal', function (this: typeof W) {
        this.internalData.events['internal'] = null;
        this.signalsToSnapshot_able({ value: undefined });
      });
      W.emitEvent('internal');
    }).toThrow();

    expect(() => {
      W.onEvent('internal', function (this: typeof W) {
        this.signalsToSnapshot_able({ value: new Map().set('a', 10) });
      });
      W.emitEvent('internal');
    }).toThrow();
  });
  test('formattedSnapshotToUserFriendly', async () => {
    privates.clearVoltsWorld();
    const W = World.getInstance({
      mode: 'DEV',
      snapshot: {},
    });
    expect(() => {
      W.onEvent('internal', function (this: typeof W) {
        this.internalData.events['internal'] = null;
        this.formattedSnapshotToUserFriendly({ 'CONVERTED::name::X1::uuid': 1 });
      });
      W.emitEvent('internal');
    }).not.toThrow();

    expect(() => {
      W.onEvent('internal', function (this: typeof W) {
        this.formattedSnapshotToUserFriendly({ 'CONVERTED::name::X::uuid': 1 });
      });
      W.emitEvent('internal');
    }).toThrow();

    expect(() => {
      W.onEvent('internal', function (this: typeof W) {
        this.formattedSnapshotToUserFriendly({ 'CONVERTED::name::uuid': 1 });
      });
      W.emitEvent('internal');
    }).toThrow();
  });
  test('corrupted snapshot', async () => {
    privates.clearVoltsWorld();
    const W = World.getInstance({
      mode: 'DEV',
      snapshot: {},
    });
    expect(async () => {
      // just proves how hard it is to corrupt
      W.onEvent('load', function (this: typeof W) {
        // const keys = Object.keys(this.internalData.formattedValuesToSnapshot);
        this.internalData.formattedValuesToSnapshot['nonFormattedKey'] = Reactive.val(999);
      });

      // @ts-ignore
      await W.rawInitPromise;
      jest.advanceTimersByTime(100);
    }).rejects.toThrow();

    W.stop();
    privates.clearVoltsWorld();
  }, 500);
});

describe('test real world use cases', () => {
  test('load objects - mode.no_auto', async () => {
    expect.assertions(4);
    privates.clearVoltsWorld();
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
    privates.clearVoltsWorld();
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

  test('onEvent & emitEvent', async () => {
    privates.clearVoltsWorld();

    const W = World.getInstance({
      mode: 'NO_AUTO',
    });

    let i = 0;
    const fn = function () {
      i++;
    }.bind(this);
    W.onEvent('evt', fn);
    W.emitEvent('evt');
    expect(i).toEqual(1);
  }, 500);
  test('setTimeout & setInterval', async () => {
    privates.clearVoltsWorld();

    const W = World.getInstance({
      mode: 'DEV',
    });

    const empty = () => {
      /* eslint */
    };

    // W.setTimeout(empty, 100);
    // W.setInterval(empty, 100);
    // expect(Diagnostics.warn).toHaveBeenCalledTimes(2);

    let i = 0;
    const fn = function () {
      i++;
    }.bind(this);

    // @ts-ignore
    await W.rawInitPromise.then(() => {
      const timeout = W.setTimeout(fn, 100);

      jest.advanceTimersByTime(150);
      expect(i).toEqual(1);
      expect(timeout.clear).not.toThrow();

      const interval = W.setInterval(fn, 100);
      jest.advanceTimersByTime(1000);

      expect(i).toBeGreaterThan(5);
      expect(interval.clear).not.toThrow();

      W.stop();
      privates.clearVoltsWorld();
    });
  }, 500);
  test('setDebounce', async () => {
    privates.clearVoltsWorld();

    const W = World.getInstance({
      mode: 'DEV',
    });

    let i = 0;
    const fn = function (val) {
      i += val;
    }.bind(this);

    // W.setDebounce(empty, 200);
    // expect(Diagnostics.warn).toHaveBeenCalledTimes(1);

    // @ts-ignore
    await W.rawInitPromise.then(() => {
      const debounceLeading = W.setDebounce(fn, 200);
      const debounceTrailing = W.setDebounce(fn, 200, true);

      for (let index = 0; index < 100; index++) {
        debounceLeading(1);
      }

      expect(i).toEqual(1);

      jest.advanceTimersByTime(250);

      debounceTrailing(1);
      expect(i).toEqual(1);
      jest.advanceTimersByTime(250);
      expect(i).toEqual(2);

      debounceLeading(1000);

      expect(i).toBeGreaterThan(1000);

      W.stop();
      privates.clearVoltsWorld();
    });
  }, 500);
  test('getWorldSpaceScreenBounds', async () => {
    privates.clearVoltsWorld();

    const W = World.getInstance({
      mode: 'DEV',
    });
    // @ts-expect-error
    await W.rawInitPromise.then(() => {
      jest.advanceTimersByTime(100);
      const vec = W.getWorldSpaceScreenBounds();
      expect(vec.dimension).toEqual(3);
    });
  });
});
