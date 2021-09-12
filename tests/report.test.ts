import { World, privates } from '../volts';
import Diagnostics from './__mocks__/Diagnostics';
import Scene from './__mocks__/Scene';

describe('report', () => {
  const report = privates.getReport();
  const msg = 'this is an important issue';
  const reps = report(msg);

  test('asIssue', () => {
    expect(() => reps.asIssue()).not.toThrow();
    expect(Diagnostics.warn).toHaveBeenCalledTimes(1);
  });
  test('log', () => {
    expect(() => reps.asIssue('log')).not.toThrow();
    expect(Diagnostics.log).toHaveBeenCalledTimes(1);
  });
  test('warn', () => {
    expect(() => reps.asIssue('warn')).not.toThrow();
    expect(Diagnostics.warn).toHaveBeenCalledTimes(1);
  });
  test('error', () => {
    expect(() => reps.asIssue('error')).not.toThrow();
    expect(Diagnostics.error).toHaveBeenCalledTimes(1);
  });
  test('throw', () => {
    expect(() => reps.asIssue('throw')).toThrow();
  });
  test('default to warn', () => {
    // @ts-expect-error
    expect(() => reps.asIssue('anyString')).not.toThrow();
    expect(Diagnostics.warn).toHaveBeenCalledTimes(1);
  });
});

describe('getSceneInfo', () => {
  const report = privates.getReport();
  test('empty scene', async ()=>{
    expect.assertions(1);
    const info = report.getSceneInfo({});
    await expect(info).resolves.toMatch('no instance')
  });
  test('default', async ()=>{
    expect.assertions(1);
    const W = World.getInstance({
      mode: 'NO_AUTO',
      assets: {
        coolAssetArray: Scene.root.findByPath('a-path')
      }
    });
    // @ts-expect-error
    await W.rawInitPromise.then(()=>{
      expect(report.getSceneInfo()).resolves.not.toThrow();
    });
  })
});
