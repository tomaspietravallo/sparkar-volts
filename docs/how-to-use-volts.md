# How to use volts ⚡️

Once you've installed `volts` and added it to your project, you are ready to use it

> [See how to install volts here](install.md)

## Set up

1. Create a new script in Spark AR Studio \(`Add Asset + > Script > Typescript`\)
2. Then open your new script in your favorite code editor

> If you don't have a code editor, Spark AR and I, recommend using [Visual Studio Code](https://code.visualstudio.com)

## Import volts into your scripts

You can selectively import parts of `volts` as follows

```typescript
import { Vector, World } from './volts';

// You can add or remove imports 👇
// E.g.: Only import Vector
// import { Vector } from './volts';

// You can use Vector as follows:
const myVec = new Vector();
// You can use World as follows:
const myWorld = new World();
```

## Using volts

There are many different parts that make up `volts`, below, you can find a list to their respective documentations

* [Vector](vector.md)
* [World](https://github.com/tomaspietravallo/sparkar-volts/tree/b3239e897dfdc3f8160753b5bbebdcd9eb2451f1/docs/world.md)
* [transformAcrossSpaces](https://github.com/tomaspietravallo/sparkar-volts/tree/b3239e897dfdc3f8160753b5bbebdcd9eb2451f1/docs/transformAcrossSpaces.md)

