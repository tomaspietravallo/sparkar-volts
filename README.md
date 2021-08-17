# VOLTS ⚡️

An extensive non-reactive Typescript framework that eases the development experience in Spark AR

## WIP x BETA branch

Please don't use this on serious projects. This is a development branch.

Install the beta package

![](https://img.shields.io/npm/v/sparkar-volts/beta?color=informational&label=beta%20version%20%28npm%29)

```bash
npm install sparkar-volts@beta
```

Or checkout into this branch

```bash
git clone https://github.com/tomaspietravallo/sparkar-volts.git
```

```bash
git checkout beta
```

## CI / NPM package publishing

There's no CI workflow set up yet, so npm publishing will be carried out manually.

If you feel an update is required, please, do not hesitate to request that a major/minor/patch be released. Include as part of your commit/pr message, and tag @tomaspietravallo.

```sh
npm version major|minor|patch -m "Optional message"
```

```sh
npm publish --access public --tag latest|beta
```

> An NPM token `NPM_TOKEN` is already set up as part of the repo env, to be used by future actions

# Notes

- Behavior in blocks:

  - Due to the use of the `Camera` object, VOLTS may not run as expected inside blocks. Some of the things that may break are listed below, note this isn't a comprehensive list, and that some of these might be used internally
    - `Vector.screenToWorld2D`

- Internal signals:
  - `__volts__internal__focalDistance`: `this.__sensitive.Camera.focalPlane.distance`
  - `__volts__internal__screen`: `Scene.unprojectToFocalPlane(Reactive.point2d(0,0))`
