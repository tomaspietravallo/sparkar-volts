---
description: In this section you'll find everything related to the VOLTS.Cube class
---

# Overview

{% tabs %}
{% tab title="v4" %}
```typescript
import { Cube, Vector } from 'volts';

// Creates a 3D Cube located at 0,0,0
// Extending 0.5 in each direction
const c = new Cube( new Vector(), 0.5 );

// vertex of the cube would be:
// [ 0.5, 0.5, 0.5 ]
// [ 0.5, 0.5, -0.5 ]
// [ 0.5, -0.5, 0.5 ]
// [ 0.5, -0.5, -0.5 ]
// [ -0.5, 0.5, 0.5 ]
// [ -0.5, 0.5, -0.5 ]
// [ -0.5, -0.5, 0.5 ]
// [ -0.5, -0.5, -0.5 ]
```
{% endtab %}
{% endtabs %}

### Cube.debugVisualize

When ran in Spark AR, this function dynamically instances 8 planes on the vertices, and assigns them a material with the color specified.

{% hint style="info" %}
Note: Color will be generated randomly if a hue is not provided. In this case, a hue of `0.3` will create a green planes on each vertex of the cube
{% endhint %}

```typescript
import { Cube, Vector } from 'volts';

const c = new Cube( new Vector(), 0.5 );

c.debugVisualize(0.3);
```
