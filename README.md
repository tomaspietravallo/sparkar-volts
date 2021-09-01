# VOLTS ⚡️

An extensive non-reactive Typescript framework that eases the development experience in Spark AR

## WIP x BETA branch

[![CI](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml/badge.svg?branch=beta)](https://github.com/tomaspietravallo/sparkar-volts/actions/workflows/test.yml)

Please don't use this on serious projects. This is a development branch.

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

There's no CI workflow set up yet, so npm publishing will be carried out manually.

If you feel an update is required, please, do not hesitate to request that a major/minor/patch be released. Include as part of your commit/pr message, and tag @tomaspietravallo.

> Note: An npm token `NPM_TOKEN` is already set up as part of the repo env, to be used by future actions

# v2.0.0 plans

- [ ] Major rewrite
- [x] Change the structure of some classes (notably `World`)
- [ ] Better types for the Vector class accessors (still not clear on the implementation)
- [ ] ~~`State` might be formatted as a function, to provide better type support~~
- [ ] Provide a template, ideally one using a non-trivial use case, in which the advantages of vanilla > reactive can be noticed

# Notes

- Behavior in blocks:

  - Due to the use of the `Camera` object, VOLTS may not run as expected inside blocks. Some of the things that may break are listed below, note this isn't a comprehensive list, and that some of these might be used internally
    - `Vector.screenToWorld2D`
  - `Time.ms.monitor` vs `Time.subscribeWithSnapshot`

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
