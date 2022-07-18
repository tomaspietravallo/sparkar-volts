import { Quaternion, Vector } from '../volts';
import Reactive, { scalarSignalSource } from './__mocks__/Reactive';

describe('quaternion construction', () => {
  test('identity', () => {
    const I = Quaternion.identity();
    expect(I.values).toEqual([1, 0, 0, 0]);
  });
  test('default', () => {
    const Q = new Quaternion();
    const I = Quaternion.identity();
    expect(Q).toEqual(I);
  });
  test('rest parameters', () => {
    const Q = new Quaternion(1, 2, 3, 4);
    expect(Q.values).toEqual([1, 2, 3, 4]);
  });
  test('from array', () => {
    const Q = new Quaternion([1, 2, 3, 4]);
    expect(Q.values).toEqual([1, 2, 3, 4]);
    expect(new Quaternion(1, 2, 3, 4).values).toEqual(new Quaternion([1, 2, 3, 4]).values);
  });
  test('from Quaternion', () => {
    const A = new Quaternion([1, 2, 3, 4]);
    const B = new Quaternion(A);
    expect(B.values).toEqual(A.values);
  });
  test('inf', () => {
    expect(() => new Quaternion(Number.POSITIVE_INFINITY, 1, 1, 1)).toThrow();
  });
  test('fromEuler', () => {
    const Q = Quaternion.fromEuler(0, 0, 0);
    expect(Q.values).toEqual([1, 0, 0, 0]);
  });
  test('createFromAxisAngle', () => {
    expect(() => Quaternion.createFromAxisAngle(new Vector(), 0)).not.toThrow();
  });
  test('lookAt', () => {
    const a = new Vector(0, -1, 0);
    const b = new Vector(0, 1, 0);
    const rot = Quaternion.lookAt(a, b);
    expect(rot.w).toBeCloseTo(0.707);
    expect(rot.x).toBeCloseTo(-0.707);
    expect(rot.y).toBeCloseTo(0.0);
    expect(rot.z).toBeCloseTo(0.0);

    Quaternion.lookAt(new Vector(), new Vector([0.0, 0.0, -1.0])).values.forEach((v, i) =>
      expect(v).toBeCloseTo([0, 1, 0, Math.PI][i]),
    );
    Quaternion.lookAt(new Vector(), new Vector([0.0, 0.0, +1.0])).values.forEach((v, i) =>
      expect(v).toBeCloseTo([1, 0, 0, 0][i]),
    );
  });
  test('lookAtOptimized', () => {
    expect(() => Quaternion.lookAtOptimized([0, 1, 0])).not.toThrow();
    expect(() => Quaternion.lookAtOptimized([0, 0, 0])).not.toThrow();
    Quaternion.lookAtOptimized([0, 0, -1]).values.forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0, Math.PI][i]));
    Quaternion.lookAtOptimized([0, 0, +1]).values.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, 0][i]));
  });
});

describe('quaternion utils', () => {
  test('convertToQuaternion', () => {
    expect(() => Quaternion.convertToQuaternion()).toThrow();
    // @ts-expect-error
    expect(() => Quaternion.convertToQuaternion(1)).toThrow();
    expect(() => Quaternion.convertToQuaternion(1, 1, 1, 1)).not.toThrow();
  });
  test('toQuaternionSignal', () => {
    const Q = Quaternion.identity();
    expect(() => Q.toQuaternionSignal()).not.toThrow();
    expect(Q.toQuaternionSignal().pinLastValue().values).toEqual([1, 0, 0, 0]);
  });
  test('copy', () => {
    const A = new Quaternion(0, 0, 0, 1);
    const B = new Quaternion(0, 0, 1, 0);
    expect(A.copy().add(B).values).toEqual([0, 0, 1, 1]);
    expect(A.values).toEqual([0, 0, 0, 1]);
    expect(B.values).toEqual([0, 0, 1, 0]);
  });
  test('toString', () => {
    const Q = new Quaternion(1, 0, 0, 0);
    expect(Q.toString(0)).toEqual('Quaternion: [1,0,0,0]');
  });
  test('toArray', () => {
    const Q = new Quaternion(1, 0, 0, 0);
    expect(Q.toArray()).toEqual([1, 0, 0, 0]);
  });
  test('toEulerArray', () => {
    const Q = new Quaternion(1, 0, 0, 0);
    expect(Q.toEulerArray()).toEqual([0, 0, 0]);
  });
  test('setSignalComponents', () => {
    const Q = new Quaternion(1, 0, 0, 0);
    expect(() => Q.setSignalComponents()).not.toThrow();
    Q.signal;
    expect(() => Q.setSignalComponents()).not.toThrow();
  });
  test('disposeSignalResources', () => {
    const Q = new Quaternion(1, 0, 0, 0);
    expect(() => Q.disposeSignalResources()).not.toThrow();
    Q.signal;
    expect(() => Q.setSignalComponents()).not.toThrow();
  });
});

describe('operations', () => {
  test('add', () => {
    const Q = Quaternion.identity();
    expect(Q.add(Q).values).toEqual([2, 0, 0, 0]);
  });
  test('mul', () => {
    const A = new Quaternion(1, 0, 0, 0);
    const B = new Quaternion(0, 0, 0, 1);
    expect(A.copy().mul(B).values).toEqual([0, 0, 0, 1]);
  });
  test('normalize', () => {
    const Q = Quaternion.identity();
    expect(Q.normalized).toBeDefined();
    Q.add(Q);
    expect(Q.values).toEqual([2, 0, 0, 0]);
    Q.normalize();
    expect(Q.values).toEqual([1, 0, 0, 0]);
    Q.add(Q);
    expect(Q.normalized.values).toEqual([1, 0, 0, 0]);
  });
  test('lookAtOptimized', () => {
    // already tested on "quaternion construction"
    const nonOp = Quaternion.lookAt(new Vector(0, 0, 0), new Vector(0, 0, -1));
    const op = Quaternion.lookAtOptimized(new Vector(0, 0, -1).values);
    const match = nonOp.values.every((v, i) => Math.abs(v - op.values[i]) < 0.001);
    expect(match).toEqual(true);
  });
  test('Vector.applyQuaternion', () => {
    // 180º turn on the x axis
    const v = new Vector(1, 0, 0);
    const q = new Quaternion(0, 0, 1, 0);
    expect(v.applyQuaternion(q).values).toEqual([-1, 0, 0]);
  });
});

describe('accessors', () => {
  const Q1234 = new Quaternion(1, 2, 3, 4);
  test('w', () => {
    expect(Q1234.w).toEqual(1);
    Q1234.w = 4;
    expect(Q1234.w).toEqual(4);
  });
  test('x', () => {
    expect(Q1234.x).toEqual(2);
    Q1234.x = 3;
    expect(Q1234.x).toEqual(3);
  });
  test('y', () => {
    expect(Q1234.y).toEqual(3);
    Q1234.y = 2;
    expect(Q1234.y).toEqual(2);
  });
  test('z', () => {
    expect(Q1234.z).toEqual(4);
    Q1234.z = 1;
    expect(Q1234.z).toEqual(1);
  });
  test('signal', () => {
    const spy = jest.spyOn(scalarSignalSource.prototype, 'set').mockImplementation();
    expect(Q1234.signal).toBeTruthy();
    expect(Q1234.signal.w).toBeTruthy();
    expect(spy).toBeCalledTimes(4);
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });
});

describe('consistency test', () => {
  test('origin-up', () => {
    // origin
    const p1 = new Vector(0, 0, 0);
    // up
    const p2 = new Vector(0, 1, 0);

    const lookAt = new Vector(0, 0, 1).applyQuaternion(Quaternion.lookAt(p1, p2));
    expect(lookAt.x).toBeCloseTo(0, 8);
    expect(lookAt.y).toBeCloseTo(1, 8);
    expect(lookAt.z).toBeCloseTo(0, 8);
  });

  test('non-zero-origin', () => {
    expect.assertions(3);
    // origin
    const p1 = new Vector(1, -0.5, 3);
    // up
    const p2 = new Vector(1, 2, 3);

    // normalized difference
    const subNorm = p2.copy().sub(p1).normalize();

    const lookAt = new Vector(0, 0, 1).applyQuaternion(Quaternion.lookAt(p1, p2));
    lookAt.values.map((v, i) => expect(v).toBeCloseTo(subNorm.values[i], 8));
  });

  test('near zero dot product', () => {
    expect.assertions(8);
    const A = new Vector(0, 0, 1);
    const B = new Vector(0, 0, 0);
    Quaternion.lookAt(A, B).values.map((v, i) => expect(v).toBeCloseTo([0, 1, 0, Math.PI][i]));
    Quaternion.lookAt(B, A).values.map((v, i) => expect(v).toBeCloseTo(Quaternion.identity().values[i]));
  });
});
