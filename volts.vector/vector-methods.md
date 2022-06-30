# Vector methods

{% hint style="info" %}
Before jumping into the methods, it's highly recommened that you read through the[`VectorArgRest` documentation](vectorargrest.md), as it's used by all methods in the `Vector` class
{% endhint %}

## Instance methods

{% hint style="danger" %}
Methods called on an instance **WILL** overwrite the instance
{% endhint %}

```typescript
import { Vector } from 'volts';

const a = new Vector(1,2,3);
const b = a.add(1); // calls .add(1) on 'a', and assigns 'a' to 'const b'

a.values; // [2,3,4]
b.values; // [2,3,4]

b.add(1); // also calls .add(1) on 'a'
```

The "correct" way to prevent the case above, is to copy the vector, then do the operation

```typescript
import { Vector } from 'volts';

const a = new Vector(1,2,3);
const b = a.copy().add(1); // creates a new Vector and adds 1 to it

a.values; // [1,2,3] - not modified
b.values; // [2,3,4] - modified

b.add(1); // only modifies the 'b' Vecto
```



## add

Adds two `VectorArgRest` together

```typescript
import { Vector } from 'volts';

const a = new Vector(1,1,1);
const b = new Vector(0,0,1);

a.add(b); // adds 'b' to the 'a' Vector
a.values; // [1,1,2]

new Vector();              // Vector<3> [0,0,0]
new Vector().add(1)        // Vector<3> [1,1,1]
new Vector().add(1,2,3);   // Vector<3> [1,2,3]
new Vector().add([1,2,3]); // Vector<3> [1,2,3]
```

## sub

Subtracts one `VectorArgRest` from another `VectorArgRest`

```typescript
import { Vector } from 'volts';

const a = new Vector(1,1,1);
const b = new Vector(0,0,1);

a.sub(b); // subtracts 'b' from the 'a' Vector
a.values; // [1,1,0]

new Vector(1);              // Vector<3> [1,1,1]
new Vector(1).sub(1)        // Vector<3> [0,0,0]
new Vector(1).sub(1,2,3);   // Vector<3> [0,-1,-2]
new Vector(1).sub([1,2,3]); // Vector<3> [0,-1,-2]
```

## mul

Multiples two `VectorArgRest` together

```typescript
import { Vector } from 'volts';

const a = new Vector(2,2,2);
const b = new Vector(1,2,3);

a.mul(b); // multiples 'a' and 'b' together, assigns the result to 'a'
a.values; // [2,4,6]

new Vector(2);              // Vector<3> [2,2,2]
new Vector(2).mul(1)        // Vector<3> [2,2,2]
new Vector(2).mul(1,2,3);   // Vector<3> [2,4,6]
new Vector(2).mul([1,2,3]); // Vector<3> [2,4,6]
```

## Vector.random2D

This static method returns a random _unit-length_ 2D Vector

{% tabs %}
{% tab title="v4+" %}
```typescript
import { Vector } from 'volts';

// Create with a predefined magnitude
const rand2d = Vector.random2D(0.25);
// Or a default of 1.0
const randDefault = Vector.random2D();

rand3d.mag(); // 0.25
rand3d.dimension; // 2

randDefault.mag() // 1
```
{% endtab %}

{% tab title="v2" %}
```typescript
import { Vector } from 'volts';

const rand2d = Vector.random2D();

rand2d.mag(); // ~1
rand2d.dimension; // 2
```
{% endtab %}
{% endtabs %}

## Vector.random3D

This static method returns a random unit-length 3D Vector

{% tabs %}
{% tab title="v4+" %}
```typescript
import { Vector } from 'volts';

// Create with a predefined magnitude
const rand3d = Vector.random3D(0.25);
// Or a default of 1.0
const randDefault = Vector.random3D();

rand3d.mag(); // 0.25
rand3d.dimension; // 3

randDefault.mag() // 1
```
{% endtab %}

{% tab title="v2" %}
```typescript
import { Vector } from 'volts';

const rand3d = Vector.random3D();

rand3d.mag(); // ~1
rand3d.dimension; // 3
```
{% endtab %}
{% endtabs %}
