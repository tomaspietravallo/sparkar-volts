---
description: In this section you'll find everything related to the VOLTS.Vector class
---

# Overview

`Vector` is a very useful class, as it provides a way to represent N-Dimentional data

{% tabs %}
{% tab title="v2+" %}
```typescript
import { Vector } from 'volts';

const defaultVector = new Vector();           // Vector<3> [0,0,0]

const fromSigleArg = new Vector(1);           // Vector<3> [1,1,1]

const scalar  = new Vector<1>([1]);           // Vector<1> [1]
const vector2 = new Vector(1,2);              // Vector<2> [1, 2]
const vector3 = new Vector(1,2,3);            // Vector<3> [1, 2, 3]

const fromArray = new Vector([1,2,3, ...[]]); // Vector<number> [...]

const hardTyped = new Vector<3>(1,2,3);       // Vector<3> [1,2,3]
```
{% endtab %}

{% tab title="v1" %}
```typescript
import { Vector } from 'volts';

const myVector = new Vector(0,1,2, ...[]);
```
{% endtab %}
{% endtabs %}

## Creating a Vector

To create a `Vector` you can use

* [Rest parameters](overview.md#rest-parameters)
* [An array](overview.md#array-parameter)
* [An existing Vector](overview.md#another-vector)

### Rest parameters

To create a `Vector` from rest parameters, simply pass your values to the constructor

{% tabs %}
{% tab title="v2" %}
```typescript
import { Vector } from 'volts';

const defaultVector = new Vector(); // Vector<3> [0,0,0]

const fromSigleArg = new Vector(1); // Vector<3> [1,1,1]

const vector2 = new Vector(1,2);    // Vector<2> [1, 2]
const vector3 = new Vector(1,2,3);  // Vector<3> [1, 2, 3]

const vectorN = new Vector([0,1,2, ...[]]); // Vector<N> [1, 2, 3, ...]
```
{% endtab %}

{% tab title="v1" %}
```typescript
import { Vector } from 'volts';

const defaultVector = new Vector();

const vector1 = new Vector(1);
const vector2 = new Vector(1,2);
const vector3 = new Vector(1,2,3);

const vectorN = new Vector([0,1,2, ...[]]);
```
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
As you can see, creating a Vector with a sigle number as argument, will create a `Vector<3>`. To create a scalar, you need to force it using an array
{% endhint %}

### Array parameter

`Vector` can take in an array, and create a `Vector` with those values. The values will be assigned secuentially to the 1st, 2nd, 3rd, Nth dimension.

This array **cannot** be empty, and must be composed entirely by numbers

{% hint style="warning" %}
Although`Vector` supports taking in an Array as parameter, currently [type inference](overview.md#types-and-generics) doesn't work as expected, and falls back to the `number` type. See [Types & Generics](overview.md#types-and-generics)
{% endhint %}

```typescript
import { Vector } from 'volts';

// [0, 1, 2, 3, ... 99]
const myArr = new Array(100).fill(0).map((_, i)=>i);

const fromArray = new Vector<100>(myArr);

fromArray.x; // 0
fromArray.y; // 1
fromArray.z; // 2
fromArray.w; // 3

fromArray.values;    // myArr [0, 1, 2, 3, ... 99]
fromArray.dimension; // 100
```

### Another Vector

A `Vector` can be creating from an existing one. Changes made to either won't be reflected on the other

```typescript
import { Vector } from 'volts';

const firstVec = new Vector(1,2,3);
const secondVec = new Vector(firstVec);

firstVec.equals(secondVec); // true

firstVec.x = 100;

firstVec.equals(secondVec); // false

// This is exactly the same as calling Vector.copy();
// const secondVec = firstVec.copy();
```

## Types & Generics

The `Vector` type is [generic](https://www.typescriptlang.org/docs/handbook/2/generics.html). This generic type describes the dimension of your vector, for example `Vector<2>` represents a two dimensional vector.

This generic type will determine which methods and properties are exposed to Typescript & Intelisense/autocompletion

You can hard-type the value, or you can leave it up to Typescript to figure out for you

```typescript
import { Vector } from 'volts';
const twoD = new Vector(1,2); // Type get's infered to Vector<2>

twoD.x; // ✅
twoD.y; // ✅
twoD.z; // ❌ highlighted as a type error ('z' doesn't exist on Vector<2>)
```

Hard-typing the generic is useful when dealing with cases when inference is not possible, for example, when constructing a `Vector` from an array.

```typescript
import { Vector } from 'volts';
const arr = [1,2];

const noType = new Vector(arr); // Type get's infered to Vector<number>
// Vector<number> doesn't provide any useful type information, so instead 👇

const hardTyped = new Vector<2>(arr) // Vector<2>

// Note hard-typing to the wrong type will highlight as an error
// Here, there's a collision between Vector<3> and Vector<2>
const badHardTyping = new Vector<3>(1,2); // ❌ highlighted as a type error
```

{% hint style="info" %}
`Vector<number>` is the same as the combination of the Vector 1,2,3 & 4 types + base. Meaning you won't get any useful information based on the dimension of your Vector
{% endhint %}

&#x20;
