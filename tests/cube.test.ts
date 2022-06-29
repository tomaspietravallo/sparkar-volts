import { Cube, Object3D, Vector, allBinaryOptions } from '../volts';

jest.useFakeTimers();

describe('Cube construction', () => {

    test('correct parameters', () => {
        expect(() => new Cube(new Vector(), 1)).not.toThrow();
    })

    test('wrong parameters', () => {
        // @ts-expect-error
        expect(() => new Cube(1, undefined)).toThrowError();
        // @ts-expect-error
        expect(() => new Cube(undefined, 1)).toThrowError();
        // technically any should be checked & tested but in most situations, if one coordinate is NaN, all are
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
        const options = allBinaryOptions(3, -0.0999, 0.0999);
        expect.assertions(8);
        for (let index = 0; index < 8; index++) {
            obj.pos.values = options[index];
            const cube = new Cube(new Vector(), 0.1);
            expect(cube.contains(obj)).toEqual(true);   
        }
    })

    test('contains object on the limit', () => {
        const obj = new Object3D();
        const options = allBinaryOptions(3, -0.1, 0.1);
        expect.assertions(8);
        for (let index = 0; index < 8; index++) {
            obj.pos.values = options[index];
            const cube = new Cube(new Vector(), 0.1);
            expect(cube.contains(obj)).toEqual(false);   
        }
    })

    test('non zero origin cube', () => {
        const obj = new Object3D();
        obj.pos.values = [0.01,0,0];
        const cube = new Cube(new Vector(0.05,0,0), 0.05);
        expect(cube.contains(obj)).toEqual(true)
    })
})

describe('Cube debug utils', () => {
    test('toString', () => {
        const cube = new Cube(new Vector(0,0,0), 1);
        expect(typeof cube.toString()).toEqual('string')
    });

    test('debugVisualize', async () => {
        const createMaterialMock = jest.spyOn(Object3D, 'createDebugMaterial').mockImplementation( async (_hue?) => {} )
        const setMaterial = jest.spyOn(Object3D.prototype, 'setMaterial').mockImplementation( function(mat) { return this } );

        const cube = new Cube(new Vector(0,0,0), 1);
    
        await expect( cube.debugVisualize() ).resolves.not.toThrow();
        expect(createMaterialMock).toHaveBeenCalledTimes(1);
        expect(setMaterial).toHaveBeenCalledTimes(8);
    
        jest.resetAllMocks();
        jest.restoreAllMocks();
    })
})