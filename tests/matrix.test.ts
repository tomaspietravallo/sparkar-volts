import { Matrix } from '../volts';

describe('matrix construction', () => {
    test('construct', () => {
        expect(() => new Matrix([0,0,0], [0,0,0], [0,0,0])).not.toThrow();
    });
    test('identity', () => {
        expect(() => Matrix.identity(3)).not.toThrow();
        expect(JSON.stringify(Matrix.identity(3).values)).toEqual('[[1,0,0],[0,1,0],[0,0,1]]');
    });
    test('error', () => {
        expect(() => new Matrix([1,2,3], [1,2], [1])).toThrow();
        expect(() => new Matrix([1,2,3])).toThrow();
        expect(() => new Matrix([1], [2], [3])).toThrow();
    })
});

describe('utils', () => {
    test('toString', () => {
        expect(new Matrix([0,0,0], [0,0,0], [0,0,0]).toString()).toEqual('[[0,0,0],[0,0,0],[0,0,0]]');
    })
})