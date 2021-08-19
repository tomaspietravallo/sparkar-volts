import { Vector } from '../../volts';

class NDVectorSignal {
  protected readonly isReactive: boolean;
  protected readonly f: () => number[];
  protected _vector: Vector;
  protected _ops: [string, number[]][];
  constructor(...args: number[] | [() => number[]]) {
    if (typeof args[0] == 'function') {
      this.isReactive = true;
      this.f = args[0];
      this._vector = new Vector(this.f());
    } else {
      // @ts-ignore
      this._vector = new Vector(args);
    }
  }
  add(...args: number[]): NDVectorSignal {
    this._ops.push(['add', args]);
    return this;
  }
  mul(...args: number[]): NDVectorSignal {
    this._ops.push(['mul', args]);
    return this;
  }
  public pinLastValue(): Vector {
    let res;
    if (!this.isReactive) {
      res = this._vector.copy();
    } else {
      res = this._vector = this._vector = new Vector(this.f());
    }
    for (let index = 0; index < this._ops.length; index++) {
      const op = this._ops[index];
      res[op[0]](...op[1]);
    }
    return res;
  }
}

export class ScalarSignal extends NDVectorSignal {
    constructor(...args: number[] | [() => number[]]) {
      super(...args);
    }
}

export class Vec2Signal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
}

export class VectorSignal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
}

export class Vec4Signal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
}

export class Quaternion extends NDVectorSignal {
    constructor(...args: number[] | [() => number[]]) {
      super(...args);
    }
  }

declare global {
  namespace Reactive {
    export type ScalarSignal = typeof ScalarSignal.prototype;
    export type Vec2Signal = typeof Vec2Signal.prototype;
    export type VectorSignal = typeof VectorSignal.prototype;
    export type Vec4Signal = typeof Vec4Signal.prototype;
    export type Quaternion = typeof Quaternion.prototype;
  }
}

export default {
  val: (x: number): ScalarSignal => new ScalarSignal(x),
  point2d: (...args: [number, number]): Vec2Signal => new Vec2Signal(...args),
  vector: (...args: [number, number, number]): VectorSignal => new VectorSignal(...args),
  quaternion: (...args: [number, number, number, number]): Quaternion => new Quaternion(...args),
};
