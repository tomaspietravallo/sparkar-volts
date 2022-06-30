# VOLTS ⚡️

[![](https://img.shields.io/npm/v/sparkar-volts?color=informational&label=npm%20sparkar-volts)](https://www.npmjs.com/package/sparkar-volts) [![CI Test](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml) ![](coverage/badge.svg)

An extensive Typescript framework that eases the development experience in Spark AR

## Showcase ✨
[See an example of what can be built with Volts 4.0.0](https://www.facebook.com/groups/SparkARcommunity/posts/1411088659303172/)

## Highlights
- This framework takes an imperative approach, and tries to abstract away the SparkAR Reactive API as much as possible
- Typescript: You'll have a smoother and richer experience while developing. [Use VSC to take full advantage, with autocompletion and intellisense](https://sparkar.facebook.com/ar-studio/learn/scripting/scripting-basics/#scripting-fundamentals)

> Please make sure to read this list of reasons why you should prefer the ReactiveAPI over vanilla js: [Reactive programming, SparkAR](https://sparkar.facebook.com/ar-studio/learn/scripting/reactive/) before using `volts`, as it might not be the right thing for every project

## Documentation

[Check out our documentation!](https://tomaspietravallo.gitbook.io/sparkar-volts/)

### How to add VOLTS to your project

[Read this installation guide](https://tomaspietravallo.gitbook.io/sparkar-volts/install)

### How to use

[Read this guide on getting started with VOLTS](https://tomaspietravallo.gitbook.io/sparkar-volts/how-to-use-volts)

## Template

You can use this template as a quick start if you're already familiar with the library. Download using the command:

```bash
npm i sparkar-volts
```

Or using [this download link](https://github.com/tomaspietravallo/sparkar-volts/releases/latest/download/volts.ts)

```typescript
// main.ts
// using sparkar-volts@4.0.0
import Diagnostics from 'Diagnostics';
import Volts, { PublicOnly } from './volts';

const World = Volts.World.getInstance({
  mode: 'DEV',
  snapshot: {},
  assets: {},
  loadStates: undefined,
});

World.onEvent('load', function (this: PublicOnly<typeof World>, snapshot) {
  Diagnostics.log(`Loaded 🧪.\nAssets: ${Object.keys(World.assets) || 'no assets were loaded'}`);
});

World.onEvent('frameUpdate', function (this: PublicOnly<typeof World>, snapshot, data) {
  if (data.frameCount == 0) Diagnostics.log(`Running... 🚀\n`);
});
```

## Contributing ❤️

![](https://img.shields.io/github/issues-raw/tomaspietravallo/sparkar-volts?color=green) ![](https://img.shields.io/github/issues-pr-raw/tomaspietravallo/sparkar-volts?color=green)

You can contribute to the development of VOLTS.

PRs & Issues welcomed!

Check the [issues](https://github.com/tomaspietravallo/sparkar-volts/issues) to see if there's anything that requires help, or want to discuss aspects of the project — feel free to open an issue if you encounter a bug/ want to request a feature/ other

> Please check the [contributing.md](contributing.md) file if you wish to contribute to the development of the project.
>
> If you want to open a PR/Issue, please make sure to read the [code-of-conduct.md](code-of-conduct.md) before doing so.

### Donations

All proceeds will be split amongst all major contributors

[![](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate?hosted_button_id=LEXFVQET96N2Y)