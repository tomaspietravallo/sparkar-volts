import { Matrix, OBB, Quaternion, Vector } from "../volts";

describe('OBB - Oriented Bounding Box', () => {
    test('constructor', () => {
        expect(() => new OBB()).not.toThrow();
        // @ts-expect-error
        expect(() => new OBB(false)).not.toThrow();
        expect(() => new OBB({ position: new Vector(), size: new Vector(), orientation: Matrix.identity(3) })).not.toThrow();
    });
    test('closestPoint', () => {
        const obb = new OBB();
        obb.closestToPoint(new Vector(0,0,-10)).values.forEach((v, i) => expect(v).toBeCloseTo([0,0,-1][i]));
        obb.closestToPoint(new Vector(1,1,1)).values.forEach((v, i) => expect(v).toBeCloseTo([1,1,1][i]));

        const smallObb = new OBB({ size: new Vector(0.1) });
        smallObb.closestToPoint(new Vector(1,1,1)).values.forEach((v,i) => expect(v).toBeCloseTo([0.1, 0.1, 0.1][i]) )
    });
    test('getInterval', () => {
        const obb = new OBB();
        expect(() => obb.getInterval(new Vector()) ).not.toThrow();
        const interval = obb.getInterval(new Vector(0,1,0));
        expect(interval.max).toBeCloseTo(+1);
        expect(interval.min).toBeCloseTo(-1);
    })
    test('againstOBB', () => {
        const OBB1 = new OBB({ position: new Vector(0,0,0), size: new Vector(0.5) });
        const OBB2 = new OBB({ position: new Vector(0,0,1), size: new Vector(0.5) });
        // These two are barely touching
        expect(OBB1.againstOBB(OBB2)).toEqual(true);
        expect(OBB2.againstOBB(OBB1)).toEqual(true);

        const OBB3 = new OBB({ position: new Vector(0,0,0), size: new Vector(0.499) });
        const OBB4 = new OBB({ position: new Vector(0,0,1), size: new Vector(0.5) });
        // These two not touching
        expect(OBB3.againstOBB(OBB4)).toEqual(false);
        expect(OBB4.againstOBB(OBB3)).toEqual(false);

        const OBB5 = new OBB({ position: new Vector(0,0,0), size: new Vector(0.499) });
        const OBB6 = new OBB({ position: new Vector(0,0,1), size: new Vector(0.5), orientation: Quaternion.fromEuler(0.3,0.3,0).toMatrix() });
        // Because of the rotation these should be touching
        expect(OBB5.againstOBB(OBB6)).toEqual(true);
        expect(OBB6.againstOBB(OBB5)).toEqual(true);

        // Test 10 Z axis rotations, all should have no effect
        for (let index = 0; index < 10; index++) {
            const orientation = Quaternion.fromEuler(0,0, (Math.PI * 2) * (index / 10) ).toMatrix();

            const OBB1 = new OBB({ position: new Vector(0,0,0), size: new Vector(0.499) });
            const OBB2 = new OBB({ position: new Vector(0,0,1), size: new Vector(0.5), orientation });
            // Because of the rotation these should be touching
            expect(OBB1.againstOBB(OBB2)).toEqual(false);
            expect(OBB2.againstOBB(OBB1)).toEqual(false);
        }
    })
})