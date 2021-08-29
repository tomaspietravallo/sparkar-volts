import { VOLTSWorld, PublicOnly, PRODUCTION_MODES } from '../volts';
import Scene, { SceneObjectBase } from './__mocks__/Scene';

describe('Test heap', () => {

  test('run - 30s', async () => {
//     // expect.assertions(6);
//     VOLTSWorld.devClear();
//     const world = VOLTSWorld.getInstance({
//       mode: PRODUCTION_MODES.DEV,
//       assets: {
//         obj: Scene.root.findFirst('obj'),
//       },
//       snapshot: {},
//       loadStates: undefined
//     });
//     expect(world.running).toEqual(false);
//     // @ts-ignore
//     await world.rawInitPromise.then(() => {
//       expect(world.loaded).toEqual(true);
//       expect(world.running).toEqual(true);
//       expect(world.assets.obj[0]).toBeInstanceOf(SceneObjectBase);
//       expect(world.frameCount).toBeDefined();
//     });

//     await new Promise((resolve) => {
//       setTimeout(resolve, 30000);
//     });

//     expect(world.running).toEqual(true);
//     expect(VOLTSWorld.getInstance().mode).toEqual(PRODUCTION_MODES.DEV);
//     expect(world.frameCount).toBeGreaterThan(1);

//     VOLTSWorld.getInstance().stop();
  }, 31000);

});
