---
description: >-
  An overview of sparkar-volts, an extensive non-reactive Typescript framework
  that eases the development experience in Spark AR
---

# Overview

## What's sparkar-volts?

`volts` is a framework that aims to ease the development experience in Spark AR by abstracting and providing a more friendly interface to it's APIs

{% hint style="warning" %}
Please make sure to read this list of reasons why you should prefer the ReactiveAPI over vanilla js: [Reactive programming, SparkAR](https://sparkar.facebook.com/ar-studio/learn/scripting/reactive/) before using `volts`, as it might not be the right thing for every project
{% endhint %}

## Template/ QuickStart

```typescript
// main.ts
// using sparkar-volts@2.0.0-beta.3
import Diagnostics from 'Diagnostics';
import VOLTS from './volts';

const World = VOLTS.World.getInstance({
  mode: 'DEV',
  snapshot: {},
  assets: {},
  loadStates: undefined
});

World.onLoad = function(snapshot){
  Diagnostics.log(`Loaded 🧪.\nAssets: ${Object.keys(World.assets) || 'no assets were loaded'}`);
}

World.onFrame = function(snapshot, data){
  if (data.frameCount == 0) Diagnostics.log(`Running... 🚀\n`);
}

```

