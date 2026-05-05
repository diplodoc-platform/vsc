import type {WToolbarSingleItemData} from '@gravity-ui/markdown-editor';

import {FileArrowRight} from '@gravity-ui/icons';
import {ToolbarDataType} from '@gravity-ui/markdown-editor';

import {yfmIncludeAction} from './const';

export const wYfmIncludeItemData: WToolbarSingleItemData = {
    id: yfmIncludeAction,
    type: ToolbarDataType.SingleButton,
    title: 'Include',
    icon: {data: FileArrowRight},
    exec: (e) => e.actions[yfmIncludeAction].run(),
    isActive: (e) => e.actions[yfmIncludeAction].isActive(),
    isEnable: (e) => e.actions[yfmIncludeAction].isEnable(),
};
