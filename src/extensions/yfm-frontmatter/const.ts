import {nodeTypeFactory} from '@gravity-ui/markdown-editor';

export const yfmFrontmatterNodeName = 'yfm-frontmatter';
export {yfmFrontmatterTokenName} from './plugin';
export const yfmFrontmatterAction = 'createFrontmatter';
export const yfmFrontmatterNodeType = nodeTypeFactory(yfmFrontmatterNodeName);
