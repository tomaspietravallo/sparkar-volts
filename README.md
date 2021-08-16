# VOLTS ⚡️

An extensive non-reactive Typescript framework that eases the development experience in Spark AR

## WIP x BETA branch

Please don't use this on serious projects. This is a development branch.

Install the beta package

![](https://img.shields.io/npm/v/sparkar-volts/beta?color=informational&label=beta%20version%20%28npm%29)

```sh
npm install sparkar-volts@beta
```

Or clone this branch

# Notes

- Behavior in blocks:

  - Due to the use of the `Camera` object, VOLTS may not run as expected inside blocks. Some of the things that may break are listed below, note this isn't a comprehensive list, and that some of these might be used internally
    - `Vector.screenToWorld2D`

- Internal signals:
  - `__volts__internal__focalDistance`: `this.__sensitive.Camera.focalPlane.distance`
  - `__volts__internal__screen`: `Scene.unprojectToFocalPlane(Reactive.point2d(0,0))`
