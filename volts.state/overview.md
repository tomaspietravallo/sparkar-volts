---
description: The State class can be used to store & fetch data in the user's phone
---

# Overview

A State is a wrapper around the `Persistence` module in Spark AR

States can hold any number, boolean, string, and/or Vector you want to store

## Creating a State

To create a State, simply instance one, and **provide a whitelisted Persistence module key**

{% hint style="warning" %}
It's essential that the string provided corresponds to a whitelisted key. If it doesn't the State will throw an error
{% endhint %}

{% hint style="info" %}
To whitelist a key, in Spark AR Studio, go to _`Project > Capabilities > + Persistence`_ and write the key in the text field, you can whitelist many keys by leaving a space in between keys. eg: `key1 key2 keyN`
{% endhint %}

```typescript
import * as VOLTS from './volts';

const State = new State('persistenceKey');
```

## Updating data

To update the data in a State, use the setValue method

```typescript
import * as VOLTS from './volts';

const State = new State('persistenceKey');

const someValue = 100;

State.setValue('someDescriptiveName', someValue);

State.setValue('string', 'a string');
State.setValue('number', 12345);
State.setValue('vector', new VOLTS.Vector(1,2,3));
State.setValue('boolean', true);
```

