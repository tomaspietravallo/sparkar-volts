import { Vector } from '../volts';

describe('vector construction', ()=>{
    test('default vector', ()=>{
        const vector = new Vector();
        expect(vector.values).toEqual([0,0,0]);
    });
    test('empty array as argument', ()=>{
        const nonValidVec = () => new Vector([]);
        expect(nonValidVec).toThrow();
    });
    test('string as argument', ()=>{
        // @ts-ignore
        const nonValidVec = () => new Vector('1', '2', '3');
        expect(nonValidVec).toThrow();
    });
    test('object as argument', ()=>{
        // @ts-ignore
        const nonValidVec = () => new Vector({x: 0, y: 1, z: 2});
        expect(nonValidVec).toThrow();
    });
    test('from another Vector', ()=>{
        const firstVec = new Vector([1,2,3]);
        const secondVec = new Vector(firstVec);
        expect(secondVec.values).toEqual([1,2,3]);
    });
    test('partially valid arguments', ()=>{
        // @ts-ignore
        const nonValidVec = () => new Vector(1,2,'3');
        expect(nonValidVec).toThrow();
    });
});

describe('utils', ()=>{
    test('convertToSameDimVector', ()=>{
        const a3 = new Vector(1,2,3);
        const b3 = new Vector(4,5,6);
        expect(Vector.convertToSameDimVector(a3, b3)).toEqual(b3);
        expect(Vector.convertToSameDimVector(a3, 5).values).toEqual([5,5,5]);
        expect(Vector.convertToSameDimVector(a3, [1,2,3]).values).toEqual([1,2,3]);
        expect(() => Vector.convertToSameDimVector(a3, [1,2])).toThrow();
        expect(Vector.convertToSameDimVector(a3, [1,2,3,4,5,6]).values).toEqual([1,2,3]);
    });
});

describe('math operations', ()=>{
    test('add', ()=>{
        const a = new Vector(1,2,3);
        const b = new Vector(4,5,6);
        expect(a.add(b).values).toEqual([5,7,9]);
        expect(b.values).toEqual([4,5,6]);
    });
});