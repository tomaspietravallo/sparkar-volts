# VOLTS ⚡️

## WIP x BETA branch

![](https://img.shields.io/npm/v/sparkar-volts/beta?color=informational&label=npm)[![CI](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml/badge.svg?branch=beta)](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml) ![](coverage/badge.svg)

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

# v3.0.0 plans

- [ ] Add Quaternions
- [ ] Add basic Object3D, basic implementation found on the cloth project
- [ ] Multipeer support (?) -- may be pushed back to v4 or 5

## CI / npm package publishing

There's no CI workflow for npm packages set up yet, so npm publishing will be carried out manually.

If you feel an update is required, please, do not hesitate to request that a major/minor/patch be released. Include as part of your commit/pr message, and tag @tomaspietravallo.

> Note: An npm token `NPM_TOKEN` is already set up as part of the repo env, to be used by future actions

However, there are actions set up to update coverage badges & test code on PRs/push

# Notes

- Behavior in blocks:

  - Due to the use of the `Camera` object, VOLTS may not run as expected inside blocks. Some of the things that may break are listed below, note this isn't a comprehensive list, and that some of these might be used internally
    - `Vector.screenToWorld2D`

- `Time.ms.monitor` vs `Time.subscribeWithSnapshot`. Even tho `Time.ms.monitor` is the standard, `subscribeWithSnapshot` provides quite a nice opportunity. In some small tests, `subscribeWithSnapshot` appeared to perform the same. **But** as of writing, both suffer from a bug [\(may be related\)](https://docs.google.com/document/d/1Dj22O5SLGfMbTU5-oqBzlU78J9V1nMUVGo9gEGxziMA/edit?usp=sharing), which slowly grinds Spark AR Studio to a crawl. `subscribeWithSnapshot` seems to perform slightly worse in this bug. But on device, both perform as expected. The only solution atm seems to downgraded to Spark AR Studio <=118, 114 appears to work the best

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
1. `VOLTS.World.getInstance()` (first call, creates an instance)
2. `VoltsWorld.init` loads all assets
3. `VoltsWorld.run` calls `onEvent('load')` function(s)
4. begins a `setTimeoutWithSnapshot` loop, calls `onEvent('frameUpdate')` function(s)
5. All subsequent VOLTS.World.getInstance calls return the instance created in step (1.)

    /// ...

6. `VoltsWorld.stop()` the loop stops recursing, this **does not** free up the memory, just pauses/freezes execution until resumed \(`VoltsWorld.run`\)