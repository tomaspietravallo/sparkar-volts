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
  abs(): Vector {
    this.values = this.values.map((v) => (v < 0 ? -v : v));
    return this;
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
  get x(): number {
    return this.values[0];
  }
  get y(): number {
    return this.values[1];
  }
  get z(): number {
    return this.values[2];
  }
  get w(): number {
    return this.values[3];
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
  sub(...args: number[]){
    this._ops.push(['sub', args]);
    return this
  }
  // super basic, lacks a lot
  public pinLastValue(): Vector | number {
    let res;
    if (!this.isReactive) {
      res = this._vector.copy();
    } else {
      this._vector = new Vector(this.f());
      res = this._vector;
    }
    for (let index = 0; index < this._ops.length; index++) {
      const op = this._ops[index];
      res[op[0]](...op[1]);
    }
    if (res.values.length === 1) return res.values[0];
    return res;
  }
}

export class ScalarSignal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
}

export class scalarSignalSource {
  constructor(id: string) {
    // super()
    if (typeof id !== 'string') throw new Error(`ID is not string`);
  }
  set(x: number) {
    // this._vector.values[0] = x;
  }
  dispose() {
    //
  }
  get signal() {
    return 0;
  }
}

export class Vec2Signal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
  get x(): ScalarSignal {
    return new ScalarSignal(this._vector.x);
  }
  get y(): ScalarSignal {
    return new ScalarSignal(this._vector.y);
  }
}

export class VectorSignal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
  get x(): ScalarSignal {
    return new ScalarSignal(this._vector.x);
  }
  get y(): ScalarSignal {
    return new ScalarSignal(this._vector.y);
  }
  get z(): ScalarSignal {
    return new ScalarSignal(this._vector.z);
  }
}

export class Vec4Signal extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
  get x(): ScalarSignal {
    return new ScalarSignal(this._vector.x);
  }
  get y(): ScalarSignal {
    return new ScalarSignal(this._vector.y);
  }
  get z(): ScalarSignal {
    return new ScalarSignal(this._vector.z);
  }
  get w(): ScalarSignal {
    return new ScalarSignal(this._vector.w);
  }
}

export class Quaternion extends NDVectorSignal {
  constructor(...args: number[] | [() => number[]]) {
    super(...args);
  }
  get w(): ScalarSignal {
    return new ScalarSignal(this._vector.values[0]);
  }
  get x(): ScalarSignal {
    return new ScalarSignal(this._vector.values[1]);
  }
  get y(): ScalarSignal {
    return new ScalarSignal(this._vector.values[2]);
  }
  get z(): ScalarSignal {
    return new ScalarSignal(this._vector.values[3]);
  }
  get eulerAngles(): Object {
    return {x: 0};
  }
}

export class StringSignal {
  private val: string;
  constructor(string) {
    this.val = string;
  }
  pinLastValue(): string {
    return this.val;
  }
}

export class BoolSignal {
  private val: boolean;
  constructor(bool) {
    this.val = bool;
  }
  pinLastValue(): boolean {
    return this.val;
  }
}

declare global {
  namespace Reactive {
    export type StringSignal = typeof StringSignal.prototype;
    export type ScalarSignal = typeof ScalarSignal.prototype;
    export type Vec2Signal = typeof Vec2Signal.prototype;
    export type VectorSignal = typeof VectorSignal.prototype;
    export type Vec4Signal = typeof Vec4Signal.prototype;
    export type Quaternion = typeof Quaternion.prototype;
    export type BoolSignal = typeof BoolSignal.prototype;
  }
}

export default {
  stringSignal: (x: string) => new StringSignal(x),
  val: (x: any): ScalarSignal => new ScalarSignal(x),
  scalarSignalSource: (id: string) => new scalarSignalSource(id),
  point2d: (...args: [number, number]): Vec2Signal => new Vec2Signal(...args),
  vector: (...args: [number, number, number]): VectorSignal => new VectorSignal(...args),
  pack4: (...args: [number, number, number, number]): Vec4Signal => new Vec4Signal(...args),
  quaternion: (...args: [number, number, number, number]): Quaternion => new Quaternion(...args),
  boolSignal: (x: boolean): BoolSignal => new BoolSignal(x),
};
