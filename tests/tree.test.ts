import { Tree, Cube, Object3D, Vector, allBinaryOptions } from '../volts';

import Diagnostics from '../tests/__mocks__/Diagnostics'

jest.useFakeTimers();

describe('tree constructor', () => {
  test('correct arguments', () => {
    const bounds = new Cube(new Vector(), 0.1);
    expect(() => new Tree(bounds, 8, 0)).not.toThrow();
  });

  test('incorrect arguments', () => {
    // @ts-expect-error
    expect(() => new Tree(undefined, 8, 0)).toThrowError();
    // @ts-expect-error
    expect(() => new Tree(bounds, undefined, 0)).toThrowError();
    // @ts-expect-error
    expect(() => new Tree(bounds, 8, undefined)).toThrowError();
  });
});

describe('functionality', () => {
  const bounds = new Cube(new Vector(), 0.1);

  test('insert', () => {
    const tree = new Tree(bounds, 8, 0);
    tree.insert(new Object3D());
    expect(tree.points.length).toEqual(1);
  });

  test('subdivide on insert', () => {
    expect.assertions(13);

    const spySubdivide = jest.spyOn(Tree.prototype, 'subdivide').mockImplementation( function(this: Tree) {
      this.divided = true;
      const cubePos = new Vector(this.boundary.x, this.boundary.y, this.boundary.z);
      this.points = allBinaryOptions(3, -this.boundary.s / 2, this.boundary.s / 2).map(
        (o) => new Tree(new Cube(cubePos.copy().add(o), this.boundary.s / 2), this.capacity, this.level + 1),
      );
    });

    const tree = new Tree(bounds, 8, 0);
    const onePerQuadrant = allBinaryOptions(3, -0.05, 0.05).map((pos) => new Object3D().setPos(pos) );
    onePerQuadrant.forEach( o => expect(tree.insert(o) ).toEqual(true) );

    expect(tree.points.length).toEqual(8);
    expect(tree.divided).toEqual(false);

    expect( tree.insert( new Object3D() ) ).toBeDefined();

    expect(tree.divided).toEqual(true)

    expect(spySubdivide).toHaveBeenCalledTimes(1);

    spySubdivide.mockReset();
    spySubdivide.mockRestore();
  });

  test('warn on out of bounds - Tree.level === 0', () => {
    const treeZero = new Tree(bounds, 8, 0);
    const treeOne = new Tree(bounds, 8, 1);
    const warn = jest.spyOn(Diagnostics, 'warn').mockImplementation();
    expect(treeZero.insert( new Object3D().setPos(1,1,1) )).toEqual(false);
    expect(treeOne.insert( new Object3D().setPos(1,1,1) )).toEqual(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockReset();
    warn.mockRestore();
  });

  test('insert on subdivided tree', () => {
    const tree = new Tree(bounds, 8, 0);
    const obj = new Object3D();
    tree.subdivide();
    expect(() => tree.insert(obj)).not.toThrow();
    // Only contained inside one tree
    expect( (tree.points as Tree[]).filter(t => t.points.findIndex(v => v === obj) !== -1 ).length ).toEqual(1);
  });

  test('subdivided past limit', () => {
    const tree = new Tree(bounds, 8, 0);
  });
});

describe('debug utils', () => {
  test('debugVisualize', () => {
    const bounds = new Cube(new Vector(), 0.1);
    const tree = new Tree(bounds, 8, 1);
  });
});
