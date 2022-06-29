let instanced = 0;
import { MaterialClassNames } from '../../volts';

const newMat = (type) => ({ type, setTextureSlot: () => {} });

export default {
    create: async (className: string, initialState) => {
        instanced++;
        if (!MaterialClassNames[className]) throw `${className} is not a dynamic object class (Scene mock)`;
        return newMat(className);
    },
}