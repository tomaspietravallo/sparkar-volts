import { transformAcrossSpaces } from '../volts';
import Reactive from './__mocks__/Reactive';

describe('invalid parameters', () => {
  test('undefined', () => {
    // @ts-expect-error
    expect(() => transformAcrossSpaces(undefined)).toThrow();

    expect(Reactive.vector(1, 1, 1).z).toBeDefined();
    expect(Reactive.vector(1, 1, 1).pinLastValue).toBeDefined();
    expect(() => transformAcrossSpaces(Reactive.vector(1, 1, 1), undefined, undefined)).toThrow();
  });
});
