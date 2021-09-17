import { State, privates } from '../volts';

jest.unmock('Persistence');
jest.unmock('Multipeer');

describe('State - missing modules', () => {
  test('Persistence', () => {
    expect(() => new State('valid')).toThrow();
  });
});

describe('report.getSceneInfo', () => {
  test('missing modules', async () => {
    const info = await privates.report.getSceneInfo({
      getIdentifiers: true,
      getPositions: false,
      getMaterials: false,
      getTextures: false,
    });
    expect(info).toMatch(`"Multipeer": false`);
    expect(info).toMatch(`"Persistence": false`);
  });
});
