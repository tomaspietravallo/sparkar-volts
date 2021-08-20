import Reactive from './Reactive';

const initTime = Date.now();

export default {
  ms: Reactive.val(() => Date.now() - initTime),
  setTimeoutWithSnapshot: ()=>{}
};
