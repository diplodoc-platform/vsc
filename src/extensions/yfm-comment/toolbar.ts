import type {WToolbarSingleItemData} from '@gravity-ui/markdown-editor';

import {Comment} from '@gravity-ui/icons';
import {ToolbarDataType} from '@gravity-ui/markdown-editor';

import {yfmCommentAction} from './const';

export const wYfmCommentItemData: WToolbarSingleItemData = {
    id: yfmCommentAction,
    type: ToolbarDataType.SingleButton,
    title: 'Comment',
    icon: {data: Comment},
    exec: (e) => e.actions[yfmCommentAction].run(),
    isActive: (e) => e.actions[yfmCommentAction].isActive(),
    isEnable: (e) => e.actions[yfmCommentAction].isEnable(),
};
