import { State } from '../volts';
jest.unmock('Persistence');

describe('State - missing modules', () => {
  test('Persistence', () => {
    expect(() => new State('valid')).toThrow();
  });
});
