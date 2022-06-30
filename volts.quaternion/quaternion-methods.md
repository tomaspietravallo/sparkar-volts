# Quaternion methods

## Static methods



### Quaternion.identity

This function returns the identity quaternion. Meaning no rotation would be applied to the Object, Vector, other Quaternion, etc.

```typescript
const Q = Quaternion.identity();
Q; // Quaternion [ 1, 0, 0, 0 ]
```

### Quaternion.fromEuler

Returns a Quaternion corresponding to a euler angle rotation **in** **radians**

```typescript
const Q = Quaternion.fromEuler(0, 0, 0);
Q; // Quaternion [ 1, 0, 0, 0 ]
```

### Quaternion.lookAt

```typescript
const Q = Quaternion.lookAt(new Vector(), new Vector(1,1,1));
Q; // A quaternion with a rotation looking from a towards b
```

### Quaternion.lookAtOptimized

{% hint style="warning" %}
WARNING: This function is unstable and hard coded. This is not meant to be used for general purposes. Only use if you know what you are doing. Otherwise, please use [`Quaternion.lookAt`](quaternion-methods.md#quaternion.lookat)``
{% endhint %}

This function takes in an array for the heading it should point towards, and returns a [`Volts.Quaternion`](broken-reference)``

```typescript
const Q = Quaternion.lookAt([0,0,1])
```

## Instance methods

### Quaternion.copy

This copies the values of a Quaternion and returns a new one

```typescript
const Q = Quaternion.identity();
// The values of the original Q Quaternion remain unchained
// In spite of the operations applied to the new Quaternion
Q.copy().mul(Quaternion.fromEuler(1.57,0,0));
```
