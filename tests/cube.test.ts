import { Cube, Object3D, Vector } from '../volts';

describe('Cube construction', () => {

    test('correct parameters', () => {
        expect(() => new Cube(new Vector(), 1)).not.toThrow();
    })

    test('wrong parameters', () => {
        // @ts-expect-error
        expect(() => new Cube(1, undefined)).toThrowError();
        // @ts-expect-error
        expect(() => new Cube(undefined, 1)).toThrowError();
        // technically any should be tested but in most situations, if one coordinate is NaN, all are
        expect(() => new Cube(new Vector(Number.NaN,0,0), 1)).toThrowError();
        // @ts-expect-error
        expect(() => new Cube({}, 1)).toThrowError();
    })

})

describe('Cube contains', () => {
    test('point does not contain object', () => {
        const obj = new Object3D();
        const cube = new Cube(new Vector(), 0);
        expect(cube.contains(obj)).toEqual(false);
    })

    test('contains object in center', () => {
        const obj = new Object3D();
        const cube = new Cube(new Vector(), 0.1);
        expect(cube.contains(obj)).toEqual(true);
    })

    test('contains object close to limit', () => {
        const obj = new Object3D();
        expect.assertions(8);
        for (let index = 0; index < 8; index++) {
            // all permutations from 000 to 111 mapped to 0.0999 and 0
            const binary = String(index.toString(2)).padStart(3, '0').split('').map((n)=> Number(n) ? 0.0999 : -0.0999);
            // this line is redundant, but i hope it makes clear what's happening
            obj.pos.values = new Vector( binary[0], binary[1], binary[2]).values;
            const cube = new Cube(new Vector(), 0.1);
            expect(cube.contains(obj)).toEqual(true);   
        }
    })

    test('contains object on the limit', () => {
        const obj = new Object3D();
        expect.assertions(8);
        for (let index = 0; index < 8; index++) {
            obj.pos.values = String(index.toString(2)).padStart(3, '0').split('').map((n)=>Number(n) ? 0.1 : -0.1);
            const cube = new Cube(new Vector(), 0.1);
            expect(cube.contains(obj)).toEqual(false);   
        }
    })
})