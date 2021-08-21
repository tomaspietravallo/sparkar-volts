// copied from volts.ts to build the mock modules
// this code had already been tested
// most of the functions are completely unused
// but they can be added to the NDVectorSignal class & used in the future

type VectorArgRest = [number] | [number[]] | number[] | [Vector];

export class Vector {
  values: number[];
  readonly dimension: number;
  constructor(...args: [number[]] | [Vector] | number[]) {
    if (args[0] instanceof Vector) {
      return args[0].copy();
    } else if (Array.isArray(args[0])) {
      this.values = args[0];
    } else if (!args[0]) {
      this.values = [0, 0, 0];
    } else {
      this.values = args as number[];
    }
    if (!this.values.every((v) => typeof v == 'number') || this.values.length === 0)
      throw new Error(`@ Vector.constructor: Values provided are not valid`);
    this.dimension = this.values.length;
  }

  public static convertToSameDimVector(v: Vector, ...args: VectorArgRest): Vector {
    if (!args) throw new Error('@ Vector.convertToSameDimVector: No values provided');
    if (args.length == 1) {
      if (args[0] instanceof Vector) {
        if (args[0].dimension == v.dimension) return args[0]; // returns the same vector that was provided
        if (args[0].dimension > v.dimension) return new Vector(args[0].values.slice(0, v.dimension)); // returns a vector that's swizzled to match
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. v.values: ${v.values}.Value(s): ${args}`,
        );
      } else if (typeof args[0] == 'number') {
        return new Vector(new Array(v.dimension).fill(args[0])); // returns a vector filled with the given number
      } else if (Array.isArray(args[0])) {
        if (args[0].length == v.dimension) return new Vector(args[0]); // returns a vector with the given array as components
        if (args[0].length > v.dimension) return new Vector(args[0].slice(0, v.dimension)); // returns a vector with the given array as components (swizzled)
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. Dimensions do not match. v.values: ${v.values}.Value(s): ${args}`,
        );
      } else {
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. v.values: ${v.values}.Value(s): ${args}`,
        );
      }
    } else {
      if (!(Array.isArray(args) && (args as any[]).every((a) => typeof a === 'number')))
        throw new Error(
          `@ Vector.convertToVector: values provided are not valid. v.values: ${v.values}.Value(s): ${args}`,
        );
      return new Vector(args as unknown as number[]);
    }
  }

  add(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    this.values = this.values.map((v, i) => v + b[i]);
    return this;
  }
  sub(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    this.values = this.values.map((v, i) => v - b[i]);
    return this;
  }
  mul(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    this.values = this.values.map((v, i) => v * b[i]);
    return this;
  }
  div(...args: VectorArgRest): Vector {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    if (![...this.values, ...b].every((v) => typeof v === 'number' && Number.isFinite(v) && v !== 0)) {
      throw new Error(`@ Vector.div: values provided are not valid. this value(s): ${this.values}\n\nb value(s): ${b}`);
    }
    this.values = this.values.map((v, i) => v / b[i]);
    return this;
  }
  dot(...args: VectorArgRest): number {
    const b = Vector.convertToSameDimVector(this, ...args).values;
    return this.values.map((x, i) => this.values[i] * b[i]).reduce((acc, val) => acc + val);
  }
  distance(...other: VectorArgRest): number {
    const b = Vector.convertToSameDimVector(this, ...other);
    return b.copy().sub(this).mag();
  }
  magSq(): number {
    return this.values.reduce((acc, val) => acc + val * val);
  }
  mag(): number {
    return this.values.map((v) => v * v).reduce((acc, val) => acc + val) ** 0.5;
  }
  copy(): Vector {
    return new Vector(this.values);
  }
  normalize(): Vector {
    const len = this.mag();
    len !== 0 && this.mul(1 / len);
    return this;
  }
  // https://stackoverflow.com/a/243984/14899497
  // cross2D(){}
  cross3D(...args: VectorArgRest): Vector {
    if (this.dimension !== 3) throw `Attempting to use Vector.cross3D on non 3D vector. Dim: ${this.dimension}`;
    const b = Vector.convertToSameDimVector(this, ...args);
    return new Vector(
      this.values[1] * b.values[2] - this.values[2] * b.values[1],
      this.values[2] * b.values[0] - this.values[0] * b.values[2],
      this.values[0] * b.values[1] - this.values[1] * b.values[0],
    );
  }
  /** @description 2D Vectors only. Angles in RADIANS*/
  heading(): number {
    return Math.atan2(this.values[1], this.values[0]);
  }
  /** @description 2D Vectors only. Angles in RADIANS @param a Angle in RADIANS to rotate the vector by*/
  rotate(a: number): Vector {
    const newHeading = this.heading() + a;
    const mag = this.mag();
    this.values[0] = Math.cos(newHeading) * mag;
    this.values[1] = Math.sin(newHeading) * mag;
    return this;
  }
  /** @description Test whether two Vectors are equal to each other */
  equals(b: Vector): boolean {
    return b && this.dimension === b.dimension && this.values.every((v, i) => v === b.values[i]);
  }
  toString(): string {
    return `vec${this.dimension}: [${this.values.toString()}]`;
  }
}

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
    this._ops = [];
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
  val: (x: any): ScalarSignal => new ScalarSignal(x),
  point2d: (...args: [number, number]): Vec2Signal => new Vec2Signal(...args),
  vector: (...args: [number, number, number]): VectorSignal => new VectorSignal(...args),
  quaternion: (...args: [number, number, number, number]): Quaternion => new Quaternion(...args),
};
