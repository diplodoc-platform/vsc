import {nodeTypeFactory} from '@gravity-ui/markdown-editor';

export const yfmDirectiveNodeName = 'yfm-directive';
export const yfmLiquidTagNodeName = 'yfm-liquid-tag';
export {yfmDirectiveTokenName, yfmLiquidTagTokenName} from './plugin';
export const yfmDirectiveNodeType = nodeTypeFactory(yfmDirectiveNodeName);
export const yfmLiquidTagNodeType = nodeTypeFactory(yfmLiquidTagNodeName);
