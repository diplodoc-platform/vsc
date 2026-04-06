import {insertElement, insertAtCursor} from '../../utils';
import type {EditorCommand} from './types';

export const editorShortcuts: EditorCommand[] = [
    {
        action: 'insertTable',
        key: 't',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
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
                (editor as any).actions?.toYfmNote?.run();
            } else {
                insertAtCursor(editor, insertElement('note'));
            }
        },
    },
];
