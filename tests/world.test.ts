import { World, PublicOnly, PRODUCTION_MODES, __clearGlobalInstance } from '../volts';
import Scene from './__mocks__/Scene';

describe('world construction', () => {
  test('default world', () => {
    __clearGlobalInstance();
    const world = new World({
      mode: PRODUCTION_MODES.NO_AUTO,
      snapshot: {},
    });
    expect(world.MODE).toEqual(PRODUCTION_MODES.NO_AUTO);
    // @ts-ignore
    expect(() => new World()).toBeTruthy();
    // @ts-ignore
    expect(() => new World({})).toBeTruthy();
  });
  test('incorrect dev mode', () => {
    // @ts-ignore
    expect(() => new World({ mode: 'not-a-mode' })).toThrow();
    // @ts-ignore
    expect(() => new World({ mode: true })).toThrow();
    // @ts-ignore
    expect(() => new World({ mode: { dev: true } })).toThrow();
  });
});

describe('load assets', ()=>{
  __clearGlobalInstance();
  const world = new World({
    mode: 'DEV',
    assets: {
      sceneObjZero: Scene.root.findFirst('object-zero'),
      arrayOfObjs: Scene.root.findByPath('**/path/*')
    }
  })
})