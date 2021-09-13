import { Vector, World, privates } from '../volts';
import Reactive from './__mocks__/Reactive';
import { Camera } from './__mocks__/Scene';

jest.useFakeTimers();

describe('vector construction', () => {
  test('default', () => {
    const V = new Vector();
    expect(V.values).toEqual([0,0,0]);
  });
  test('scalar argument', () => {
    expect(new Vector(1).values).toEqual([1, 1, 1]);
  });
  test('rest parameters', () => {
    const V = new Vector(1, 2, 3, 4);
    expect(V.values).toEqual([1, 2, 3, 4]);
  });
  test('from array', () => {
    const V = new Vector([1, 2, 3, 4]);
    expect(V.values).toEqual([1, 2, 3, 4]);
  });
  test('from Vector', () => {
    const A = new Vector([1, 2, 3, 4]);
    const B = new Vector(A);
    expect(B.values).toEqual(A.values);
  });
});

describe('vector utils', () => {
  test('convertToSameDimVector', () => {
    const a3 = new Vector(1, 2, 3);
    const b3 = new Vector(4, 5, 6);
    expect(Vector.convertToSameDimVector(a3.dimension, b3)).toEqual(b3);
    expect(Vector.convertToSameDimVector(a3.dimension, 5).values).toEqual([5, 5, 5]);
    expect(Vector.convertToSameDimVector(a3.dimension, [1, 2, 3]).values).toEqual([1, 2, 3]);
    expect(() => Vector.convertToSameDimVector(a3.dimension, [1, 2])).toThrow();
    expect(() => Vector.convertToSameDimVector(a3.dimension, new Vector(1, 2))).toThrow();
    expect(Vector.convertToSameDimVector(a3.dimension, [1, 2, 3, 4, 5, 6]).values).toEqual([1, 2, 3]);
    expect(Vector.convertToSameDimVector(a3.dimension, new Vector(1, 2, 3, 4, 5, 6)).values).toEqual([1, 2, 3]);

    expect(() => {
      // @ts-expect-error
      Vector.convertToSameDimVector(a3.dimension, [1, '2', 3]);
    }).toThrow();

    expect(() => {
      Vector.convertToSameDimVector(100, 1, 2, 3);
    }).toThrow();

    expect(() => {
      Vector.convertToSameDimVector(undefined, 1, 2, 3);
    }).toThrow();

    expect(() => {
      // @ts-expect-error
      Vector.convertToSameDimVector(100, { x: 1, y: 2 });
    }).toThrow();
  });
  test('toString', () => {
    const vec = new Vector();
    expect(vec.toString()).toEqual(`Vector<3> [0,0,0]`);
    expect(vec.toString(5)).toEqual(`Vector<3> [0.00000,0.00000,0.00000]`);
  });
  test('fromSignal', () => {
    const Scalar = Reactive.val(1);
    const Vec4Signal = Reactive.pack4(1, 2, 3, 4);
    expect(Vector.fromSignal(Scalar).values).toEqual([1]);
    expect(Vector.fromSignal(Vec4Signal).values).toEqual([1, 2, 3, 4]);
  });
  test('screenToWorld', async () => {
    privates.clearVoltsWorld();

    const W = World.getInstance({
      mode: 'DEV',
    });

    expect(()=>Vector.screenToWorld(1,1,true)).toThrow();
    // @ts-expect-error
    expect(()=>Vector.screenToWorld(false,undefined,true)).toThrow();

    // @ts-expect-error
    await W.rawInitPromise.then(() => {
      jest.advanceTimersByTime(100);
      const vecOnFocal = Vector.screenToWorld(0, 1, true);
      const vecOnZero = Vector.screenToWorld(0.5, 1, false);
      expect(vecOnFocal.dimension).toEqual(3);
      expect(vecOnZero.z).toEqual(0);
      expect(vecOnFocal.z).toEqual(new Camera('camera-mock').focalPlane.distance.pinLastValue());
    });
  });
});

describe('math operations', () => {
  test('add', () => {
    // vec3
    const a = new Vector(1, 2, 3);
    const b = new Vector(4, 5, 6);
    expect(a.add(b).values).toEqual([5, 7, 9]);
    expect(b.values).toEqual([4, 5, 6]);

    // scalar
    const scalar = new Vector([2]);
    expect(scalar.add(1).values).toEqual([3]);
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
    expect(a.cross(b).values).toEqual([-3, 6, -3]);
  });
  test('distance', () => {
    const a = new Vector([-1]);
    const b = new Vector([2]);
    expect(a.distance(b)).toEqual(3);
  });
  test('magSq', () => {
    expect(new Vector([1, 2, 3]).magSq()).toEqual(14);
  });
  test('mag', () => {
    expect(new Vector([1]).mag()).toEqual(1);
    expect(new Vector([2]).mag()).toEqual(2);
    expect(new Vector([1, 2, 3]).mag()).toEqual(Math.sqrt(14));
  });
  test('abs', () => {
    expect(new Vector([-1]).abs().values).toEqual([1]);
    expect(new Vector([1, -2]).abs().values).toEqual([1, 2]);
    expect(new Vector([1, 2, 3]).abs().values).toEqual([1, 2, 3]);
  });
  test('normalize', () => {
    expect(new Vector([-1]).normalize().values).toEqual([-1]);
    expect(new Vector([1]).normalize().values).toEqual([1]);
    expect(new Vector([1, 1]).normalize().values).toEqual([1 / Math.sqrt(2), 1 / Math.sqrt(2)]);
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
  test('equals', () => {
    expect(new Vector().equals(new Vector())).toEqual(true);
    expect(new Vector([0]).equals(new Vector([0, 0]))).toEqual(false);
    expect(new Vector(-1, 2).equals(new Vector(-1, 2))).toEqual(true);
    expect(new Vector(0, 0).equals(undefined)).toEqual(false);
  });
  test('heading', () => {
    expect(new Vector(1, 1).heading()).toBeCloseTo(0.785398163);
    expect(new Vector(0, 0).heading()).toBeCloseTo(0);
  });
  test('rotate', () => {
    const vec = new Vector(1, 0);
    expect(vec.heading()).toBeCloseTo(0);
    vec.rotate(Math.PI / -2);
    expect(vec.heading()).toBeCloseTo(Math.PI / -2);
    expect(vec.x).toBeCloseTo(0);
    expect(vec.y).toBeCloseTo(-1);
  });
});

describe('accessors', () => {
  const scalar = new Vector([1]);
  const twoD = new Vector(1, 2);
  const threeD = new Vector(1, 2, 3);
  const fourD = new Vector(1, 2, 3, 4);

  test('1d', () => {
    expect(scalar.x).toEqual(1);
    expect((scalar.x += 4)).toEqual(5);
    expect(scalar.x).toEqual(5);
    expect(() => scalar.y).toThrow();
  });
  test('2d', () => {
    expect(twoD.x).toEqual(1);
    expect(twoD.y).toEqual(2);
    expect((twoD.y += 3)).toEqual(5);
    expect(twoD.y).toEqual(5);
    expect(() => twoD.z).toThrow();
  });
  test('3d', () => {
    expect(threeD.x).toEqual(1);
    expect(threeD.z).toEqual(3);
    expect((threeD.z += 2)).toEqual(5);
    expect(threeD.z).toEqual(5);
    expect(() => threeD.w).toThrow();
  });
  test('4d', () => {
    expect(fourD.x).toEqual(1);
    expect(fourD.w).toEqual(4);
    expect((fourD.w += 1)).toEqual(5);
    expect(fourD.w).toEqual(5);
  });
});
