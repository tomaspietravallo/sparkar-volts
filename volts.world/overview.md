# Overview

VOLTS provides you with a helper class that can manage events, snapshot signals, update SceneObjects, and do many more things!

{% hint style="warning" %}
You can only create ONE instance of this class across all your scripts, which you can access though the `getInstance` function
{% endhint %}

## World.getInstance

The getInstance function returns the current instance, or creates a new instance if none has been created before

{% tabs %}
{% tab title="v2" %}
```typescript
import { World } from './volts';

// this'd throw an error, as it needs some parameters the first time
// World.getInstance();

const Instance = World.getInstance({
  mode: 'PRODUCTION',
});

// now you can getIntance() without parameters
// to get access to the one and only instance
Instance === World.getInstance(); // true
```
{% endtab %}

{% tab title="v1" %}
```typescript
import { World } from './volts';

const Instance = new World({
  mode: 'PRODUCTION',
});
```
{% endtab %}
{% endtabs %}

If you are calling `getInstance` for the first time, meaning you intend to create a new instance, you need to supply some parameters. After the first instance has been created, you can call `getInstance` without any parameters

### Parameters:

* `mode`: **This parameter is required**. It represents which 'mode' or behavior you want your code to follow, there are 3 modes to choose from. It's recommended that `DEV` is used while developing and iterating, and later switched to `PRODUCTION` once you want to export/push to a device.
  * `DEV`: this mode has some additional checks and procedures, which are used to make Volts play nicer \(_around its bugs_\) with Spark AR Studio
  * `PRODUCTION`: this mode just runs your code as it is, no additional checks or workarounds, which don't matter on device
  * `NO_AUTO`: this mode is more **advanced** and is only recommended for scripts which try to extend the `VoltsWorld` class
* `assets`: This parameter is optional. An object composed of key-value pairs, with the values being a Promise that resolves to some asseet in Spark AR Studio
* `snapshot`: This parameter is optional. An object composed of key-value pairs, with the values being a Signal of type `ScalarSignal`, `Vec2Signal`, `VectorSignal`, `Vec4Signal`, `StringSignal`, or `BoolSignal`. Which get snapshot-ed to `number`, [`Vector`](../volts.vector/overview.md), `string`, and `boolean` \(s\)
* `loadStates`: a State \(or array of States\) which are to be loaded by the time the World has loaded

#### Example using all parameters:

{% tabs %}
{% tab title="v2" %}
```typescript
import * as VOLTS from './volts';
import { PublicOnly } from './volts';

import Scene from 'Scene';
import Time from 'Time';
import Reactive from 'Reactive';
import Diagnostics from 'Diagnostics';

const Storage = new VOLTS.State('persistence-key');
// in practice, this value would be set at a later point in the experience
// and would be fetched from previous sessions
Storage.setValue('some-important-value', 'myValueAsStringBooleanNumberOrVector');

const Instance = VOLTS.World.getInstance({
    mode: 'DEV',
    assets: {
        camObj: Scene.root.findFirst('Camera')
    },
    snapshot: {
        timeMsValue: Time.ms,
        vec2Signal: Reactive.point2d(1,2)
    },
    loadStates: Storage,
});

Instance.onEvent('load', function(this: PublicOnly<typeof Instance>){
    this.mode; // DEV
    this.assets.camObj; // Camera SceneObject
    this.snapshot.timeMsValue; // the Time.ms signal value at the time 'load' was called
    this.snapshot.vec2Signal; // Vector<2>
    Storage.data['some-important-value']; // 'myValueAsStringBooleanNumberOrVector'
    Diagnostics.log('loaded');
});

Instance.onEvent('frameUpdate', function(this: PublicOnly<typeof Instance>){
    // The value of this signal is updated on every frame, and VOLTS snapshots it every time
    // meaning `this.snapshot.timeMsValue` will always keep up with Time.ms
    this.snapshot.timeMsValue;
})
```
{% endtab %}
{% endtabs %}

