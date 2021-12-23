import { SceneObjectBase } from './Scene';
import { ScalarSignal } from './Reactive';

export class BlockInstance extends SceneObjectBase {
  isBlockSceneRoot: boolean;
  constructor(name: string) {
    super(name);
    this.isBlockSceneRoot = true;
  }
}

class BlockAsset {
  name: string;
  identifier: string;
  constructor(name: string) {
    this.name = name;
    this.identifier = 'a-unique-identifier';
  }
  instance(): Promise<BlockInstance> {
    return Promise.resolve(new BlockInstance(this.name));
  }
}

const Blocks = {
  instantiate: async (blockOrName) => {
    const shouldFail = blockOrName.toLowerCase().indexOf('fail') !== -1;
    if (shouldFail) throw new Error('The block was not found @ Mocks.Blocks.instantiate');
    return new BlockInstance(typeof blockOrName === 'string' ? blockOrName : blockOrName.name);
  },
  assets: {
    findFirst: (s: string): Promise<BlockAsset> => {
      return new Promise((resolve) => {
        const shouldFail = s.toLowerCase().indexOf('fail') !== -1;
        if (shouldFail) throw new Error('The object was not found');
        resolve(new BlockAsset(s));
      });
    },
  },
};

export default Blocks;

// allow the use of require()
module.exports = Blocks;
