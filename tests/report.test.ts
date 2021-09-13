import { World, privates } from '../volts';
import Diagnostics from './__mocks__/Diagnostics';
import Scene from './__mocks__/Scene';

describe('report', () => {
  const msg = 'this is an important issue';
  const reps = privates.report(msg);

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
  test('multi line msg', () => {
    expect(() => privates.report('line1', 'line2', 'line3').asIssue()).not.toThrow();
    expect(Diagnostics.warn).toHaveBeenCalledTimes(1);
  });
});

describe('getSceneInfo', () => {
  const report = privates.report;
  test('empty scene', async () => {
    expect.assertions(1);
    const info = report.getSceneInfo({});
    await expect(info).resolves.toMatch('no instance');
  });
  test('asset array', async () => {
    expect.assertions(1);
    const W = World.getInstance({
      mode: 'NO_AUTO',
      assets: {
        coolAssetArray: Scene.root.findByPath('a-path'),
      },
    });
    // @ts-expect-error
    await W.rawInitPromise.then(() => {
      expect(report.getSceneInfo()).resolves.not.toThrow();
    });
  });
  test('single asset', async () => {
    expect.assertions(1);
    const W = World.getInstance({
      mode: 'NO_AUTO',
      assets: {
        obj: Scene.root.findFirst('an-object'),
      },
    });
    // @ts-expect-error
    await W.rawInitPromise.then(() => {
      expect(report.getSceneInfo()).resolves.not.toThrow();
    });
  });
  test('corrupt', async () => {
    expect.assertions(1);
    const W = World.getInstance({
      mode: 'NO_AUTO',
      assets: {
        obj: Scene.root.findFirst('an-object'),
      },
    });
    // @ts-expect-error
    await W.rawInitPromise.then(() => {
      W.assets.obj = null;
      expect(report.getSceneInfo()).resolves.not.toThrow();
    });
  });
});
