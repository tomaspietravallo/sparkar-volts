# VOLTS ⚡️

An extensive non-reactive Typescript framework that eases the development experience in Spark AR

## WIP x BETA branch

[![CI](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml/badge.svg?branch=beta)](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml) ![](coverage/badge.svg)

Needless to say, use at your own risk

## Install

Install the beta package

![](https://img.shields.io/npm/v/sparkar-volts/beta?color=informational&label=npm)

```bash
npm install sparkar-volts@beta
```

Or clone into this branch

```bash
git clone https://github.com/tomaspietravallo/sparkar-volts.git
```

```bash
git checkout beta
```

```bash
npm i
```

## CI / npm package publishing

There's no CI workflow for npm packages set up yet, so npm publishing will be carried out manually.

If you feel an update is required, please, do not hesitate to request that a major/minor/patch be released. Include as part of your commit/pr message, and tag @tomaspietravallo.

> Note: An npm token `NPM_TOKEN` is already set up as part of the repo env, to be used by future actions

However, there are actions set up to update coverage badges & test code on PRs/push

# v2.0.0 plans

- [x] Major rewrite
- [x] Change the structure of some classes (notably `World`)
- [x] Better types for the Vector class accessors (still not clear on the implementation)
- [ ] ~~`State` might be formatted as a function, to provide better type support~~ (dropped)
- [ ] Provide a template, ideally one using a non-trivial use case, in which the advantages of vanilla > reactive can be noticed

# Notes

- Behavior in blocks:

  - Due to the use of the `Camera` object, VOLTS may not run as expected inside blocks. Some of the things that may break are listed below, note this isn't a comprehensive list, and that some of these might be used internally
    - `Vector.screenToWorld2D`

- `Time.ms.monitor` vs `Time.subscribeWithSnapshot`. Even tho `Time.ms.monitor` is the standard, `subscribeWithSnapshot` provides quite a nice opportunity. In some small tests, `subscribeWithSnapshot` appeared to perform the same. **But** as of writing, both suffer from a bug [\(may be related\)](https://docs.google.com/document/d/1Dj22O5SLGfMbTU5-oqBzlU78J9V1nMUVGo9gEGxziMA/edit?usp=sharing), which slowly grinds Spark AR Studio to a crawl. `subscribeWithSnapshot` seems to perform slightly worse in this bug. But on device, both perform as expected. The only solution atm seems to downgraded to Spark AR Studio 118

- Internal signals:
  Documented as part of the `InternalSignals` interface (after v2.0.0-beta.3)

```ts
interface InternalSignals {
  __volts__internal__time: number;
  __volts__internal__focalDistance: number;
  __volts__internal__screen: Vector;
}
```

> Note, as of v2.0.0-beta.2, addToSnapshot and removeFromSnapshot will prevent you from overwriting/ removing these signals

# Lifecycle

0. Code starts executing...
1. `VOLTS.World.getInstance()` (first call)

   - Checks for the config argument, validates, and...
   - Creates a `VoltsWorld` instance
     - `mode` is set
     - `internalData` is created
     <!-- ```ts
     this.internalData = {
         initPromise: this.init.bind(this, VoltsWorld.userConfig.assets, VoltsWorld.userConfig.loadStates),
         running: false,
         loaded: false,
         events: {},
         elapsedTime: 0,
         frameCount: 0,
         timedEvents: [],
         // @ts-ignore missing props are assigned at runtime
         userFriendlySnapshot: {},
         formattedValuesToSnapshot: this.signalsToSnapshot_able(VoltsWorld.userConfig.snapshot),
         FLAGS: {
             stopTimeout: false,
             lockInternalSnapshotOverride: false,
         },
         onLoad: null,
         onFrame: null,
         Camera: null,
     };
     ```-->
     - `VoltsWorld.internalData.initPromise()` (calls VoltsWorld.init)
     ```

2. `VoltsWorld.init`
   - `VoltsWorld.internalData.Camera = (await Scene.root.findFirst('Camera')) as Camera;`
   - Adds internal signals to the snapshot
     - \_\_volts\_\_internal\_\_focalDistance
     - \_\_volts\_\_internal\_\_time
     - \_\_volts\_\_internal\_\_screen
     - `VoltsWorld.internalData.FLAGS.lockInternalSnapshotOverride = true;`
   - Loads all States ( `Promise.all(states.map((s: State<any>) => s.loadState()));` )
   - Loads all Scene Objects ( `await Promise.all([...keys.map((n) => assets[n])]);` )
   - `VoltsWorld.internalData.loaded = true;`
   - `if (VoltsWorld.mode !== PRODUCTION_MODES.NO_AUTO) VoltsWorld.run();`
3. `VoltsWorld.run`
   - `VoltsWorld.internalData.running = true;`
   - Starts the recursive `setTimeoutWithSnapshot` loop
4. `setTimeoutWithSnapshot` loop
   - Formats and stores the snapshot
   - Calculates the FPS and stores the new `elapsedTime`
   - (Only in DEV mode): skips if it detects the Studio is paused
   - (Only on the first frame): `onLoad` function gets called
   - `VoltsWorld.runTimedEvents`
   - `onFrame` function gets called
   - `frameCount += 1;`
   - loop() `if (!this.internalData.FLAGS.stopTimeout) return loop();`
5. All subsequent VOLTS.World.getInstance calls return the instance created in step (1.)
