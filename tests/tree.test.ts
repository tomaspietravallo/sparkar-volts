import { Tree, Cube, Object3D, Vector } from '../volts';

jest.useFakeTimers();

describe('tree constructor', () => {
    test('correct arguments', () => {
        const bounds = new Cube(new Vector(), 0.1);
        expect( () => new Tree(bounds, 8, 0) ).not.toThrow();
    })

    test('incorrect arguments', () => {
        // @ts-expect-error
        expect( () => new Tree(undefined, 8, 0) ).toThrowError();
        // @ts-expect-error
        expect( () => new Tree(bounds, undefined, 0) ).toThrowError();
        // @ts-expect-error
        expect( () => new Tree(bounds, 8, undefined) ).toThrowError();
    })
})