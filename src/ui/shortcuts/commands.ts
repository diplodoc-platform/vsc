import type {EditorCommand} from './types';

import {insertAtCursor, insertElement} from '../../utils';

export const editorShortcuts: EditorCommand[] = [
    {
        action: 'insertTable',
        key: 't',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.createYfmTable?.run();
            } else {
                insertAtCursor(editor, insertElement('table'));
            }
        },
    },
    {
        action: 'insertNote',
        key: 'r',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.toYfmNote?.run();
            } else {
                insertAtCursor(editor, insertElement('note'));
            }
        },
    },
];
