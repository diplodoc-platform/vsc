import {nodeTypeFactory} from '@gravity-ui/markdown-editor';

export const yfmIncludeNodeName = 'yfm-include';
export {yfmIncludeTokenName} from './plugin';
export const yfmIncludeAction = 'toYfmInclude';
export const yfmIncludeNodeType = nodeTypeFactory(yfmIncludeNodeName);
