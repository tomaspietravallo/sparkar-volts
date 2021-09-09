export default {
  log: (value: any) => {},
  watch: (value: any) => {},
  // For the sake of testing, throwing can be 'expect-ed'
  warn: (value: any) => {
    throw value;
  },
  error: (value: any) => {
    throw value;
  },
};
