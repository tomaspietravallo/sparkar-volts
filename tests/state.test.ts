import { State, Vector } from '../volts';
import Time from './__mocks__/Time';

// new State('any-string') // valid
// new State('fail-Fail-FAIL') // throws
// new State('never-Never-NEVER') // resolve(undefined)

jest.useFakeTimers();

describe('State constructor', () => {
  test('valid key', async () => {
    // @ts-ignore
    await expect(new State('valid').loadState()).resolves.toBeUndefined();
  });
  test('invalid key', async () => {
    expect.assertions(1);
    // @ts-ignore
    try {
      // @ts-ignore
      await new State('fail').rawConstructorPromise;
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
  test('invalid arguments', async () => {
    // @ts-ignore
    await expect(() => new State()).toThrow();
  });
});

// Why:
// https://github.com/tomaspietravallo/sparkar-volts/issues/4
describe('loadState', () => {
  test('expected', async () => {
    const data = 'some-data';
    const state = new State('key');
    state.setValue('someData', data);
    // @ts-ignore
    state.wipe();
    // @ts-ignore
    await state.loadState();
    expect(state.data.someData).toEqual(data);
  });
  test('never resolve', async () => {
    const state = new State('never');
    state.setValue('someData', 'some-data');
    // @ts-ignore
    state.wipe();
    // @ts-ignore
    await state.loadState();
    expect(state.data.someData).toBeUndefined();
  });
  test('load Vector', async () => {
    //
    const data = new Vector(1, 2, 3);
    const state = new State<{ someData: Vector<3> }>('key');
    state.setValue('someData', data);
    // @ts-ignore
    state.wipe();
    // @ts-ignore
    await state.loadState();
    expect(state.data.someData).toBeInstanceOf(Vector);
    expect(state.data.someData.values).toEqual([1, 2, 3]);
    expect(() => state.data.someData.add(1)).not.toThrow();
  });
});
