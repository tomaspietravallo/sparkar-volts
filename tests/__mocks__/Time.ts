import Reactive from './Reactive';

const initTime = Date.now();

// const fakeDelay = 5;

export default {
  ms: Reactive.val(() => Date.now() - initTime),
  setTimeoutWithSnapshot: (obj: object, cb, ms) =>
    setTimeout(() => {
      let res = {};
      let keys = Object.keys(obj);
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        res[key] = obj[key].pinLastValue();
        if (res[key].values && res[key].values.length === 1) res[key] = res[key].values[0];
      }
      cb(ms, res);
    }, ms),
  setTimeout: setTimeout,
};
