---
description: Documentation for the VectorArgRest type
---

# VectorArgRest

The `VectorArgRest` type represents all valid [rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Rest_parameters) types that can be used to construct a Vector

This is the exact definition of `VectorArgRest`:

```typescript
type VectorArgRest<D extends number = any> = [number] | number[] | [number[]] | [Vector<D>];
```

Which can be read as follows:

> Anywhere VectorArgRest is required, you can use either:
>
> * a number
> * an array of numbers
> * a tuple composed by a single array of numbers
> * a Vector

Which in practice means:

```typescript
// ...
function myFunction(...param: VectorArgRest){
  // ...
};

myFunction(1);            // a number
myFunction(1,2,3);        // an array of numbers (spread as rest parameters)
myFunction([1,2,3]);      // a tuple composed by an array of numbers
myFunction(new Vector()); // a Vector
```

{% hint style="info" %}
You can use the static `convertToSameDimVector` method to turn `VectorArgRest` into a Vector of a desired dimension
{% endhint %}

```typescript
// Vector.convertToSameDimVector(dim: number, ...args: VectorArgRest);

// number
Vector.convertToSameDimVector(3, 1); // Vector<3> [1,1,1]
Vector.convertToSameDimVector(2, 1); // Vector<2> [1,1]

// rest array
Vector.convertToSameDimVector(3, 1,2,3); // Vector<3> [1,2,3]
Vector.convertToSameDimVector(2, 1,2,3); // Vector<2> [1,2]

// tuple of a single array
Vector.convertToSameDimVector(3, [1,2,3]); // Vector<3> [1,2,3]
Vector.convertToSameDimVector(2, [1,2,3]); // Vector<2> [1,2]

// from another Vector
Vector.convertToSameDimVector(3, new Vector(1,2,3)); // Vector<3> [1,2,3]
Vector.convertToSameDimVector(2, new Vector(1,2,3)); // Vector<2> [1,2]

```

