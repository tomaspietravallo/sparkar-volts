import { privates, randomBetween, hsv2rgb, PRODUCTION_MODES } from '../volts';

describe('promiseAllConcurrent', () => {
  test('simple test', async () => {
    expect.assertions(1);
    const fake = jest.fn();
    // @ts-expect-error
    await privates.promiseAllConcurrent(1, true)([fake, fake, fake]);
    expect(fake).toHaveBeenCalledTimes(3);
  });
});

describe('randomBetween', () => {
  test('randomBetween', () => {
    expect(randomBetween.bind(0, 1)).not.toThrow();
    expect(randomBetween(0.4, 0.6)).toBeCloseTo(0.5, 0);
  });
});

describe('hsv2rgb', () => {
  test('hsv2rgb', () => {
    expect(() => hsv2rgb(0,0,0)).not.toThrow();
    expect(hsv2rgb(0,1,1)).toEqual([1,0,0])
    expect(hsv2rgb(0,1,0)).toEqual([0,0,0])
  })
})