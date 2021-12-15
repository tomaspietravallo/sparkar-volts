import { Quaternion, Vector } from '../volts';

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
  test('createFromAxisAngle', ()=>{
    expect(()=>Quaternion.createFromAxisAngle(new Vector(), 0)).not.toThrow();
  });
  test('lookAt', ()=>{
    const a = new Vector(0,-1,0);
    const b = new Vector(0,1,0);
    const rot = Quaternion.lookAt(a, b);
    expect(rot.w).toBeCloseTo(0.707);
    expect(rot.x).toBeCloseTo(-0.707);
    expect(rot.y).toBeCloseTo(0.0);
    expect(rot.z).toBeCloseTo(0.0);
  });
  test('lookAtOptimized', ()=>{
    expect(()=>Quaternion.lookAtOptimized([0,1,0])).not.toThrow();
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
    const A = Quaternion.identity();
    const B = Quaternion.identity();
    expect(A.copy().add(B).values).toEqual([2, 0, 0, 0]);
    expect(A.values).toEqual([1, 0, 0, 0]);
    expect(B.values).toEqual([1, 0, 0, 0]);
  });
});

describe('operations', () => {
  test('add', () => {
    const Q = Quaternion.identity();
    expect(Q.add(Q).values).toEqual([2, 0, 0, 0]);
  });
  test('normalize', () => {
    const Q = Quaternion.identity();
    Q.add(Q);
    expect(Q.values).toEqual([2, 0, 0, 0]);
    Q.normalize();
    expect(Q.values).toEqual([1, 0, 0, 0]);
    Q.add(Q);
    expect(Q.normalized.values).toEqual([1, 0, 0, 0]);
  });
});

describe('accessors', () => {
  const Q1234 = new Quaternion(1, 2, 3, 4);
  test('w', () => {
    expect(Q1234.w).toEqual(1);
    Q1234.w *= 2;
    expect(Q1234.w).toEqual(2);
  });
  test('x', () => {
    expect(Q1234.x).toEqual(2);
    Q1234.x *= 2;
    expect(Q1234.x).toEqual(4);
  });
  test('y', () => {
    expect(Q1234.y).toEqual(3);
    Q1234.y *= 2;
    expect(Q1234.y).toEqual(6);
  });
  test('z', () => {
    expect(Q1234.z).toEqual(4);
    Q1234.z *= 2;
    expect(Q1234.z).toEqual(8);
  });
});
