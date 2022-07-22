import { Matrix, OBB, Quaternion, Vector } from '../volts';

describe('OBB - Oriented Bounding Box', () => {
  test('constructor', () => {
    expect(() => new OBB()).not.toThrow();
    // @ts-expect-error
    expect(() => new OBB(false)).not.toThrow();
    expect(
      () => new OBB({ position: new Vector(), size: new Vector(), orientation: Matrix.identity(3) }),
    ).not.toThrow();
  });
  test('closestPoint', () => {
    const obb = new OBB();
    obb.closestToPoint(new Vector(0, 0, -10)).values.forEach((v, i) => expect(v).toBeCloseTo([0, 0, -1][i]));
    obb.closestToPoint(new Vector(1, 1, 1)).values.forEach((v, i) => expect(v).toBeCloseTo([1, 1, 1][i]));

    const smallObb = new OBB({ size: new Vector(0.1) });
    smallObb.closestToPoint(new Vector(1, 1, 1)).values.forEach((v, i) => expect(v).toBeCloseTo([0.1, 0.1, 0.1][i]));
  });
  test('getInterval', () => {
    const obb = new OBB();
    expect(() => obb.getInterval([0,0,0])).not.toThrow();
    let interval = obb.getInterval([0, 1, 0]);
    expect(interval.max).toBeCloseTo(+1);
    expect(interval.min).toBeCloseTo(-1);

    interval = obb.getInterval([1, 0, 0]);
    expect(interval.max).toBeCloseTo(+1);
    expect(interval.min).toBeCloseTo(-1);

    interval = obb.getInterval([0, 0, 1]);
    expect(interval.max).toBeCloseTo(+1);
    expect(interval.min).toBeCloseTo(-1);
  });
  test('againstOBB', () => {
    const OBB1 = new OBB({ position: new Vector(0, 0, 0), size: new Vector(0.5) });
    const OBB2 = new OBB({ position: new Vector(0, 0, 1), size: new Vector(0.5) });
    // These two are barely touching
    expect(OBB1.againstOBB(OBB2)).toBeTruthy();
    expect(OBB2.againstOBB(OBB1)).toBeTruthy();

    const OBB3 = new OBB({ position: new Vector(0, 0, 0), size: new Vector(0.499) });
    const OBB4 = new OBB({ position: new Vector(0, 0, 1), size: new Vector(0.5) });
    // These two not touching
    expect(OBB3.againstOBB(OBB4)).not.toBeTruthy();
    expect(OBB4.againstOBB(OBB3)).not.toBeTruthy();

    const OBB5 = new OBB({ position: new Vector(0, 0, 0), size: new Vector(0.499) });
    const OBB6 = new OBB({
      position: new Vector(0, 0, 1),
      size: new Vector(0.5),
      orientation: Quaternion.fromEuler(0.3, 0.3, 0).toMatrix(),
    });
    // Because of the rotation these should be touching
    expect(OBB5.againstOBB(OBB6)).toBeTruthy();
    expect(OBB6.againstOBB(OBB5)).toBeTruthy();

    // Test 10 Z axis rotations, all should have no effect
    for (let index = 0; index < 10; index++) {
      const orientation = Quaternion.fromEuler(0, 0, Math.PI * 2 * (index / 10)).toMatrix();

      const OBB1 = new OBB({ position: new Vector(0, 0, 0), size: new Vector(0.499) });
      const OBB2 = new OBB({ position: new Vector(0, 0, 1), size: new Vector(0.5), orientation });
      // Because of the rotation these should be touching
      expect(OBB1.againstOBB(OBB2)).not.toBeTruthy();
      expect(OBB2.againstOBB(OBB1)).not.toBeTruthy();
    }
  });
});

describe('performance (run local only)', () => {
  test.skip('againstOBB', () => {
    
    // 356.11ms to compute 500 OBB
    // 32.18ms to compute 500 OBB (optimized)
    // 22.98ms to compute 500 OBB (optimized)
    // Goes as far down as 8ms if the OBBs aren't on top of each other
    let it: any = process.hrtime(); it = it[0] * 1000 + it[1] / 1000000;

    for (let i = 0; i < 500; i++) {
      const a = new OBB({ position: new Vector(0,0,0) });
      const b = new OBB({ position: new Vector(0,0,0) });

      a.againstOBB(b);;
    };

    let ft: any = process.hrtime(); ft = ft[0] * 1000 + ft[1] / 1000000;
    // Use this to purposefully prompt an error displaying the amount it took
    expect(ft - it).toBeLessThan(0);
  })
})