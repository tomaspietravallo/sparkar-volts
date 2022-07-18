import { Matrix } from '../volts';

describe('matrix construction', () => {
    test('construct', () => {
        expect(() => new Matrix([0,0,0], [0,0,0], [0,0,0])).not.toThrow();
    });
    test('error', () => {
        expect(() => new Matrix([1,2,3], [1,2], [1])).toThrow();
        expect(() => new Matrix([1,2,3])).toThrow();
        expect(() => new Matrix([1], [2], [3])).toThrow();
    })
});

describe('utils', () => {
    test('toString', () => {
        expect(new Matrix([0,0,0], [0,0,0], [0,0,0]).toString()).toEqual('0,0,0,0,0,0,0,0,0');
    })
})