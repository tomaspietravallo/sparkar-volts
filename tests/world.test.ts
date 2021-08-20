import { World, PublicOnly, PRODUCTION_MODES, __clearGlobalInstance } from '../volts';
import Scene from './__mocks__/Scene';

describe('world construction', () => {
  test('default world', () => {
    __clearGlobalInstance();
    const world = new World({ mode: PRODUCTION_MODES.NO_AUTO });
    expect(world.MODE).toEqual(PRODUCTION_MODES.NO_AUTO);

    __clearGlobalInstance();
    // @ts-ignore
    expect(()=>new World({})).toThrow();
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
});

describe('load assets', () => {
  test('scene mocks', async () => {
    await expect(()=>Scene.root.findFirst('fail')).rejects.toThrow();
    await expect(Scene.root.findByPath('any-other-string')).resolves.toBeTruthy();
  });

  test('valid objects', async () => {
    __clearGlobalInstance();
    // This one is actually doing the entire set up
    await expect(
      new World({
        mode: 'DEV',
        assets: {
          obj: Scene.root.findFirst('obj')
        }
      }).rawInitPromise
    ).resolves.not.toThrow();
  });

  test('invalid objects', async () => {
    __clearGlobalInstance();
    await expect(
      () =>
        new World({
          mode: 'DEV',
          assets: {
            sceneObjZero: Scene.root.findFirst('object-zero'),
            arrayOfObjs: Scene.root.findByPath('**/FAIL-TO-LOAD/*'),
          },
          // @ts-ignore
        }).rawInitPromise,
    ).rejects.toThrow();
  });
});
