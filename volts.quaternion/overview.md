---
description: In this section you'll find everything related to the VOLTS.Cube class
---

# Overview

{% tabs %}
{% tab title="v3+" %}
```typescript
import { Quaternion, Vector } from 'volts';

// A 90º turn along the X axis
const rotation = Quaternion.fromEuler(1.57, 0, 0);

// You can rotate vectors by a quaternion
new Vector(0,0,-1).applyQuaterion(rotation)

// Or get a Reactive QuaternionSignal
// by accessing the signal component
rotation.signal;
```
{% endtab %}
{% endtabs %}
