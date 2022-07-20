import { Matrix, OBB, Vector } from "../volts";

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
        obb.closestToPoint(new Vector(1,1,1)).values.forEach((v, i) => expect(v).toBeCloseTo([1,1,1][i]))
    });
    test('getInterval', () => {
        const obb = new OBB();
        expect(() => obb.getInterval(new Vector()) ).not.toThrow();
        const interval = obb.getInterval(new Vector(0,1,0));
        expect(interval.max).toBeCloseTo(+1);
        expect(interval.min).toBeCloseTo(-1);
    })
})