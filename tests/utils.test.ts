import { privates } from '../volts';

describe('promiseAllConcurrent', () => {
  test('simple test', async () => {
    expect.assertions(1);
    const fake = jest.fn();
    // @ts-expect-error
    await privates.promiseAllConcurrent(1, true)([fake, fake, fake]);
    expect(fake).toHaveBeenCalledTimes(3);
  });
});
