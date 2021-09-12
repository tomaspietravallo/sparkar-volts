import { privates } from '../volts';
import Diagnostics from './__mocks__/Diagnostics';

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
