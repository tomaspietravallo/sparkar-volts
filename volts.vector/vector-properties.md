---
description: These properties are found on all Vector instances
---

# Vector properties

## dimension

A `number` representing the dimension of the Vector. Equal to `vector.values.length`

```typescript
import { Vector } from 'volts';

const vec3 = new Vector(1,2,3);
vec3.dimension; // 3
```

### signal

{% hint style="info" %}
Only defined for Vectors with dimensions between `1` and `4`
{% endhint %}

```typescript
import { Vector } from 'volts';

const vec3 = new Vector(1,2,3);
vec3.signal; // Reactive VectorSignal(1,2,3)

new Vector(1).signal;       // Reactive scalar
new Vector(1,2).signal;     // Reactive point2d
new Vector(1,2,3).signal;   // Reactive vector
new Vector(1,2,3,4).signal; // Reactive pack4
```

### pointSignal

{% hint style="info" %}
Only defined for 3D Vectors
{% endhint %}

```typescript
import { Vector } from 'volts';

const vec3 = new Vector(1,2,3);
vec3.pointSignal; // Reactive PointSignal(1,2,3)
```

### Vector.components

{% hint style="danger" %}
This is a static property
{% endhint %}

An array containing all keys that a Vector _**might**_ contain, in order. Keys capped to 4 dimensions

```typescript
import { Vector } from 'volts';

Vector.components // [ 'x', 'y', 'z', 'w' ]
```
