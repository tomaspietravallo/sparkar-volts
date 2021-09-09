# transformAcrossSpaces

{% hint style="warning" %}
Keep in mind that this is an advanced function that works with coordinate spaces
{% endhint %}

## Parameters

1. `vec`: a Vector signal representing the position of the object to "follow"
2. `vecParentSpace`: The parent space in which `vec` is located
3. `targetParentSpace`: A TransformSignal representing the "target space", which in the absolute frame of reference

```typescript
function transformAcrossSpaces(
  vec: VectorSignal,
  vecParentSpace: TransformSignal,
  targetParentSpace: TransformSignal,
): VectorSignal
```

## Example

With the code example below, the two objects will be placed on top of each other no matter what happens in the rest of the scene

{% hint style="info" %}
Note: sometimes a reload is required after changing the Scene hierarchy
{% endhint %}

```typescript
import { transformAcrossSpaces } from './volts';

// define two SceneObjects
let firstObj: SceneObjectBase, secondarySceneObj: SceneObjectBase;

// make both objects be in the same position
// obj2 is placed on top of obj1
secondarySceneObj.transform.position =
  transformAcrossSpaces(
    firstObj.transform.position,
    firstObj.parentWorldTransform,
    secondarySceneObj.parentWorldTransform
  );
```

>

