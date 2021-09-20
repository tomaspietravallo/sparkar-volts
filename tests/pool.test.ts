import { Pool } from '../volts';

describe('default pool', ()=>{
    test('pool constructor', ()=>{
        // @ts-expect-error
        expect(()=>new Pool()).toThrow();
    });
    test('hasPreInstancedObjectsAvailable', async ()=>{
        const pool = new Pool('string');
        expect(pool.hasPreInstancedObjectsAvailable).toBeFalsy();
    });
});

describe('dynamic-string pool', ()=>{
    test('populate', async ()=>{
        const pool = new Pool('name');
        await pool.populate(10,10);
        expect(pool.hasPreInstancedObjectsAvailable).toBeTruthy();
    });
    test('getObject', async ()=>{
        const pool = new Pool('name');
        expect(pool.hasPreInstancedObjectsAvailable).toBeFalsy();
        await pool.getObject().then(o=>o.returnToPool());
        expect(pool.hasPreInstancedObjectsAvailable).toBeTruthy();
    })
})