import { Pool } from '../volts';

describe('default pool', () => {
  test('pool constructor', () => {
    // @ts-expect-error
    expect(() => new Pool()).toThrow();
  });
  test('hasPreInstancedObjectsAvailable', async () => {
    const pool = new Pool('string', 'Focal Distance');
    expect(pool.hasPreInstancedObjectsAvailable).toBeFalsy();
  });
});

describe('dynamic-string pool', () => {
  test('populate', async () => {
    const pool = new Pool('name', 'Focal Distance');
    await expect(async () => await pool.populate(10, 10)).not.toThrow();
    expect(pool.hasPreInstancedObjectsAvailable).toBeTruthy();
    expect(pool.preInstancedObjectsCount).toEqual(10);
  });
  test('getObject', async () => {
    const pool = new Pool('name', 'Focal Distance');
    expect(pool.hasPreInstancedObjectsAvailable).toBeFalsy();
    await pool.getObject().then((o) => o.returnToPool());
    expect(pool.hasPreInstancedObjectsAvailable).toBeTruthy();
  });
  test('assigned after construction', async () => {
    const pool = new Pool('name');
    expect(pool.hasPreInstancedObjectsAvailable).toBeFalsy();
    expect(pool.getObject()).rejects.toThrow();
    await pool.setRoot('any-scene-obj-or-string');
    expect(pool.getObject()).resolves.toBeDefined();
  });
  test('fail to find object', async () => {
    const pool = new Pool('fail', 'any');
    await expect(pool.getObject()).rejects.toThrow();
  });
  test('fail to find root', async () => {
    const pool = new Pool('any');
    await expect(pool.setRoot('fail')).rejects.toThrow();
    await expect(pool.getObject()).rejects.toThrow();
  });
});
