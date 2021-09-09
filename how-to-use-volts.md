---
description: Learn how to add Volts to your Spark AR projects
---

# How to use volts

Once you've installed `volts` and added it to your project, you are ready to use it

> [See how to install volts here](install.md)

## Set up

1. Create a new script in Spark AR Studio \(`Add Asset + > Script > Typescript`\)
2. Then open your new script in your favorite code editor

> If you don't have a code editor, Spark AR and I recommend using [Visual Studio Code](https://code.visualstudio.com)

## Import volts into your scripts

You can selectively import parts of `volts` as follows

```typescript
import { Vector } from './volts';

// You can add or remove imports
// E.g.: import Vector AND World 👇
// import { Vector, World } from './volts';

// You can use Vector as follows:
const myVec = new Vector();
```

## Using volts

There are many different parts that make up `volts`, below, you can find a list to their respective documentations

* [Vector](volts.vector/vector.md)
* [World](volts.world/volts.world.md)
* [transformAcrossSpaces](extra-utils/transformacrossspaces.md)

