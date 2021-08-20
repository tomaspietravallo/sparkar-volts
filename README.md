# VOLTS ⚡️

[![CI Test](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml)
[![](https://img.shields.io/npm/v/sparkar-volts?color=informational&label=npm%20sparkar-volts)](https://www.npmjs.com/package/sparkar-volts)


> Work in progress 🚧 🚧 🚧

An extensive non-reactive Typescript framework that eases the development experience in Spark AR

### Highlights

- Non-reactive: This framework takes an imperative approach, and tries to abstract away the SparkAR Reactive API as much as possible

- Typescript: You'll have a smoother and richer experience while developing. [Use VSC to take full advantage, with autocompletions and intellisense](https://sparkar.facebook.com/ar-studio/learn/scripting/scripting-basics/#scripting-fundamentals)

> Please make sure to read this list of reasons why you should prefer the ReactiveAPI over vanilla js: [Reactive programming, SparkAR](https://sparkar.facebook.com/ar-studio/learn/scripting/reactive/) before using `volts`, as it might not be the right thing for every project

---

## How to add VOLTS to your project

[Read this installation guide](docs/install.md)

## How to use?

[Read this guide on getting started with VOLTS](docs/how-to-use-volts.md)

## Fast paced doc
If you are more familiar with Javascript and don't want to read the longer doc linked above:

```bash
npm i sparkar-volts
```

Or use [this download link](https://github.com/tomaspietravallo/sparkar-volts/releases/latest/download/volts.ts)

> Note: the example below doesn't make much sense as a general use case, it just tries to quickly demonstrate the framework as quickly as possible

```ts
// import * as VOLTS from './volts';
import { Vector, World, PublicOnly } from './volts';

const myVec = new Vector();

const face = FaceTracking.face(0);

const myWorld = new World({
    mode: 'DEV' // DEV, PRODUCTION, NO_AUTO
    objects: { // an object composed of Promises
        myMeshes: Scene.root.findByPath('**/path/*') as Promise<FaceMesh[]>
    },
    snapshot: { // an object composed of Scalar/String/Boolean/Vector(2/3/4) signals
        Face0: face.cameraTransform.applyToPoint(face.nose.tip)
    }
})

// myWorld.onLoad = undefined

// snapshot & onFrameData automatically get typed out for you
myWorld.onFrame = function(this: PublicOnly<typeof myWorld>, snapshot, onFrameData){
    this.objects.myMeshes; // FaceMesh[], type is maintained
    myVec.values = this.snapshot.face0 // the vec values are now == to the Face0 signal

    myVec.div(2);
    // (myVec is a 3D vector, so 3D arguments)
    myVec.mul(2,2,2);
    myVec.mul([1,1,1]);

    this.objects.myMeshes.forEach((mesh)=>{
        mesh.transform.x = myVec.values[0]
    });
}
```

## Contributing ❤️

![](https://img.shields.io/github/issues-raw/tomaspietravallo/sparkar-volts?color=green)
![](https://img.shields.io/github/issues-pr-raw/tomaspietravallo/sparkar-volts?color=green)

You can contribute to the development of VOLTS.

PRs & Issues welcomed!

Check the [issues](https://github.com/tomaspietravallo/sparkar-volts/issues) to see if there's anything that requires help, or want to discuss aspects of the project

> Please check the [contributing.md](contributing.md) file if you wish to contribute to the development of the project.

> If you want to open a PR/Issue, please make sure to read the [code-of-conduct.md](code-of-conduct.md) before doing so.
