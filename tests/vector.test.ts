import { Vector } from '../volts';

describe('vector construction', () => {
  test('default vector', () => {
    const vector = new Vector();
    expect(vector.values).toEqual([0, 0, 0]);
  });
  test('empty array as argument', () => {
    const nonValidVec = () => new Vector([]);
    expect(nonValidVec).toThrow();
  });
  test('string as argument', () => {
    // @ts-ignore
    const nonValidVec = () => new Vector('1', '2', '3');
    expect(nonValidVec).toThrow();
  });
  test('object as argument', () => {
    // @ts-ignore
    const nonValidVec = () => new Vector({ x: 0, y: 1, z: 2 });
    expect(nonValidVec).toThrow();
  });
  test('from another Vector', () => {
    const firstVec = new Vector([1, 2, 3]);
    const secondVec = new Vector(firstVec);
    expect(secondVec.values).toEqual([1, 2, 3]);
  });
  test('partially valid arguments', () => {
    // @ts-ignore
    const nonValidVec = () => new Vector(1, 2, '3');
    expect(nonValidVec).toThrow();
  });
  test('scalar', () => {
    expect(new Vector(1).values).toEqual([1]);
  });
  test('100D vector', () => {
    const arr = new Array(100).fill(0).map((e, i) => i);
    const vec = new Vector(arr);
    expect(vec.dimension).toEqual(100);
    expect(vec.add(vec).values).toEqual(arr.map((v) => v * 2));
  });
});

describe('vector utils', () => {
  test('convertToSameDimVector', () => {
    const a3 = new Vector(1, 2, 3);
    const b3 = new Vector(4, 5, 6);
    expect(Vector.convertToSameDimVector(a3, b3)).toEqual(b3);
    expect(Vector.convertToSameDimVector(a3, 5).values).toEqual([5, 5, 5]);
    expect(Vector.convertToSameDimVector(a3, [1, 2, 3]).values).toEqual([1, 2, 3]);
    expect(() => Vector.convertToSameDimVector(a3, [1, 2])).toThrow();
    expect(Vector.convertToSameDimVector(a3, [1, 2, 3, 4, 5, 6]).values).toEqual([1, 2, 3]);
  });
});

describe('math operations', () => {
  test('add', () => {
    const a = new Vector(1, 2, 3);
    const b = new Vector(4, 5, 6);
    expect(a.add(b).values).toEqual([5, 7, 9]);
    expect(b.values).toEqual([4, 5, 6]);
  });
  test('sub', () => {
    const a = new Vector(2, 3, 2);
    const b = new Vector(1, 3, 3.5);
    expect(a.sub(b).values).toEqual([1, 0, -1.5]);
  });
  test('mul', () => {
    const a = new Vector(1, 2, 3);
    const b = new Vector(1, 2, 3);
    expect(a.mul(b).values).toEqual([1, 4, 9]);
  });
  test('div', () => {
    const a = new Vector(1, 2, 3);
    const b = new Vector(1, 2, 3);

    expect(a.div(b).values).toEqual([1, 1, 1]);

    a.div(-1);
    expect(a.values).toEqual([-1, -1, -1]);

    a.div(0.5); // same as mul(2)
    expect(a.values).toEqual([-2, -2, -2]);

    expect(() => a.div(0)).toThrow();
    expect(() => a.div([1, 2, 0])).toThrow();
  });
  test('dot product', () => {
    const a = new Vector(1, 3, -5);
    const b = new Vector(4, -2, -1);
    expect(a.dot(b)).toEqual(3);
  });
  test('cross product', () => {
    const a = new Vector(2, 3, 4);
    const b = new Vector(5, 6, 7);
    expect(a.cross3D(b).values).toEqual([-3, 6, -3]);
  });
  test('distance', () => {
    const a = new Vector(-1);
    const b = new Vector(2);
    expect(a.distance(b)).toEqual(3);
  });
  test('magSq', () => {
    expect(new Vector([1, 2, 3]).magSq()).toEqual(14);
  });
  test('mag', () => {
    expect(new Vector(1).mag()).toEqual(1);
    expect(new Vector(2).mag()).toEqual(2);
    expect(new Vector([1, 2, 3]).mag()).toEqual(Math.sqrt(14));
  });
  test('normalize', () => {
    expect(new Vector(-1).normalize().values).toEqual([-1]);
    expect(new Vector(1).normalize().values).toEqual([1]);
    expect(new Vector(1, 1).normalize().values).toEqual([1 / Math.sqrt(2), 1 / Math.sqrt(2)]);
  });
  test('copy', () => {
    const a = new Vector([1, 2, 3]);
    const b = a.copy();
    expect(a).toEqual(b);
    b.add(0.1);
    expect(a).not.toEqual(b);
    a.add(0.1);
    expect(a).toEqual(b);
  });
});
