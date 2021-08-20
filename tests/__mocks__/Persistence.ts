export default {
  storage: {},
  get(key: string): Promise<object> {
    const shouldFail = key.toLowerCase().indexOf('fail') !== -1;

    return new Promise((resolve) => {
      if (shouldFail) throw new Error(`Key not found/not whitelisted/other`);
      resolve(this.storage);
    });
  },
  set(key: string, value: Object): Promise<boolean> {
    const shouldFail = key.toLowerCase().indexOf('fail') !== -1;
    if (shouldFail) throw new Error(`Key not found/not whitelisted/other`);
    return new Promise((resolve) => {
      this.storage[key] = value;
      resolve(true);
    });
  },
  remove(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.storage[key] = null;
      resolve(true);
    });
  },
};
