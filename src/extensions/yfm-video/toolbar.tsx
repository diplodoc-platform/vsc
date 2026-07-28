import type {ActionStorage, ToolbarButtonPopupData} from '@gravity-ui/markdown-editor';

import {Video} from '@gravity-ui/icons';
import {ToolbarDataType} from '@gravity-ui/markdown-editor';

import {VideoForm} from './VideoForm';

export const wYfmVideoItemData: ToolbarButtonPopupData<ActionStorage> = {
    id: 'video',
    type: ToolbarDataType.ButtonPopup,
    title: 'Video',
    icon: {data: Video},
    exec: () => {},
    isActive: (e) => e.actions.video.isActive(),
    isEnable: (e) => e.actions.video.isEnable(),
    renderPopup: ({editor, anchorElement, hide}) => (
        <VideoForm editor={editor} anchorElement={anchorElement} hide={hide} />
    ),
};
