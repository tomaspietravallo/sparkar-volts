---
description: In this section you'll find everything related to the VOLTS.Object3D class
---

# Overview

{% tabs %}
{% tab title="v4" %}
```typescript
import { Object3D } from 'volts';

// Creates a 3D Object located at 0,0,0.
// Because no body argument was provided,
// this will automatically instance a 3D Plane on the scene
const Obj = new Object3D()

// Use null as the body argument
// to prevent a dynamic instance from being created
const noBodyInstanceObj = new Object3D(null)

// Chain functions! 👇
// Create a dynamic instance
new Object3D()
    .setScl(0.1)  // set the scale
    .setPos(0,0,0) // set the position
    .setRot(1,0,0,0) // set the rotation
```
{% endtab %}
{% endtabs %}

### Object3D.setPos

Sets the position of the Object3D. Takes in a [VectorArgsRest](../volts.vector/vectorargrest.md)

```typescript
import { Object3D } from 'volts';

// Creates a dynamic instance and set the position to
// x = 0
// y = 0
// z = 0.1
const Obj = new Object3D().setPos(0, 0, 0.1)
```

### Object3D.setScl

Sets the scale of the Object3D. Takes in a [VectorArgsRest](../volts.vector/vectorargrest.md)

```typescript
import { Object3D } from 'volts';

// Creates a dynamic instance and set the scale to
// x = 0.1
// y = 0.2
// z = 0.3
const Obj = new Object3D().setPos(0.1, 0.2, 0.3)
```

### Object3D.setRot

Sets the rotation of the Object3D. Takes in a QuaternionArgsRest

```typescript
import { Object3D } from 'volts';

// Creates a dynamic instance and set the rotation quaternion to
// Quaternion: [1,0,0,0]
const Obj = new Object3D().setRot(1,0,0,0)
```
