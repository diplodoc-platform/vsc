import {nodeTypeFactory} from '@gravity-ui/markdown-editor';

export const yfmCommentNodeName = 'yfm-comment';
export {yfmCommentTokenName} from './plugin';
export const yfmCommentAction = 'createYfmComment';
export const yfmCommentNodeType = nodeTypeFactory(yfmCommentNodeName);
