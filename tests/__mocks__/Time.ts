import Reactive from './Reactive';

const initTime = Date.now();

export default {
  ms: Reactive.val(() => Date.now() - initTime),
  setTimeoutWithSnapshot: (obj: object, cb, ms)=>setTimeout(()=>{
    let keys = Object.keys(obj);
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      obj[key] = obj[key].pinLastValue ? obj[key].pinLastValue().values : obj[key]
    }
    cb(0, obj);
  }, 10),
  setTimeout: setTimeout
};
