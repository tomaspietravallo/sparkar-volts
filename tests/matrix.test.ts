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
    test('inverse', () => {
        expect.assertions(19);

        expect(Matrix.identity(3).inverse().toString()).toEqual(Matrix.identity(3).toString());

        const Mat = new Matrix(
            [1, 0.2, 0, 8],
            [5, 0, 4, 4],
            [3, 1, 2, 0],
            [0, 2, 0.1, 7]
        ).inverse();

        expect(new Matrix([-4]).inverse().toString()).toEqual('[[-0.25]]');

        // Computed using both
        // https://matrix.reshish.com/inverCalculation.php
        // https://www.wolframalpha.com/input?i2d=true&i=Power%5B%7B%7B1%2C0.2%2C0%2C8%7D%2C%7B5%2C0%2C4%2C4%7D%2C%7B3%2C1%2C2%2C0%7D%2C%7B0%2C2%2C0.1%2C7%7D%7D%2C-1%5D
        const pre_computed = new Matrix(
            [0.56593977154724818269, -0.3686396677050882658, 0.75908618899273104869, -0.43613707165109034264],
            [-0.16614745586708203511,-0.21287642782969885789,0.41017653167185877489,0.31152647975077881606],
            [-0.76583592938733125645,0.65939771547248182757,-0.84371754932502596033,0.49844236760124610587],
            [0.058411214953271028037,0.051401869158878504672,-0.10514018691588785046,0.046728971962616822429]
        );

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                expect(Mat.values[r][c]).toBeCloseTo(pre_computed.values[r][c], 1);
            }
        }

        // Determinant is zero. Error
        expect(() => 
        new Matrix(
            [0,0,1],
            [0,1,2],
            [0,1,3]
        ).inverse()).toThrow();
    });
    test('transpose', () => {
        expect(new Matrix([1,1,1], [2,2,2], [3,3,3]).transpose().toString()).toEqual('[[1,2,3],[1,2,3],[1,2,3]]')
    })
    test('toString', () => {
        expect(new Matrix([0,0,0], [0,0,0], [0,0,0]).toString()).toEqual('[[0,0,0],[0,0,0],[0,0,0]]');
    });
})