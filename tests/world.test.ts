import { World, PublicOnly, PRODUCTION_MODES } from '../volts';

describe('world construction', () => {
  test('default world', () => {
    const world = new World({
      mode: PRODUCTION_MODES.NO_AUTO,
      snapshot: {},
    });
    expect(world.MODE).toEqual(PRODUCTION_MODES.NO_AUTO);
    // @ts-ignore
    expect(()=>new World()).toBeTruthy();
    // @ts-ignore
    expect(()=>new World({})).toBeTruthy();
  });
  test('incorrect dev mode', () => {
    // @ts-ignore
    expect(()=>new World({mode: 'not-a-mode'})).toThrow();
    // @ts-ignore
    expect(()=>new World({mode: true})).toThrow();
    // @ts-ignore
    expect(()=>new World({mode: {dev: true}})).toThrow();
  });
});
