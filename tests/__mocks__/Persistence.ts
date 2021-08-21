const Persistence = {
  userScope: {
    storage: {},
    get(key: string): Promise<object> {
      const shouldFail = key.toLowerCase().indexOf('fail') !== -1;
      const doNotResolve = key.toLowerCase().indexOf('never') !== -1;

      return new Promise((resolve, reject) => {
        if (shouldFail) reject(new Error(`@get: Key not found/not whitelisted/other`));
        if (doNotResolve) resolve(undefined);
        resolve(this.storage[key]);
      });
    },
    set(key: string, value: Object): Promise<boolean> {
      const shouldFail = key.toLowerCase().indexOf('fail') !== -1;
      if (shouldFail) throw new Error(`@set: Key not found/not whitelisted/other`);
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
  },
};

// export default Persistence;

// allow the use of require()
module.exports = Persistence;