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
    {
        action: 'insertCut',
        key: 'c',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.toYfmCut?.run();
            } else {
                insertAtCursor(editor, insertElement('cut'));
            }
        },
    },
    {
        action: 'insertTab',
        key: 'a',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.toYfmTabs?.run();
            } else {
                insertAtCursor(editor, insertElement('tab'));
            }
        },
    },
    {
        action: 'insertCodeBlock',
        key: 'o',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.toCodeBlock?.run();
            } else {
                insertAtCursor(editor, insertElement('codeBlock'));
            }
        },
    },
    {
        action: 'insertInclude',
        key: 'z',
        alt: true,
        handler: (editor) => {
            editor.focus();
            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.toYfmInclude?.run();
            } else {
                insertAtCursor(editor, insertElement('include'));
            }
        },
    },
    {
        action: 'insertQuote',
        key: 'q',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.quote?.run();
            } else {
                insertAtCursor(editor, insertElement('quote'));
            }
        },
    },
    {
        action: 'insertMermaid',
        key: 'm',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.createMermaid?.run();
            } else {
                insertAtCursor(editor, insertElement('mermaid'));
            }
        },
    },
    {
        action: 'insertFrontmatter',
        key: 'f',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.createFrontmatter?.run();
            } else {
                insertAtCursor(editor, insertElement('frontmatter'));
            }
        },
    },
    {
        action: 'insertPageConstructor',
        key: 'p',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.createYfmPageConstructor?.run();
            } else {
                insertAtCursor(editor, insertElement('pageConstructor'));
            }
        },
    },
    {
        action: 'insertHtmlBlock',
        key: 'h',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode === 'wysiwyg') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor as any).actions?.createYfmHtmlBlock?.run();
            } else {
                insertAtCursor(editor, insertElement('htmlBlock'));
            }
        },
    },
    {
        action: 'insertVideo',
        key: 'v',
        alt: true,
        handler: (editor) => {
            editor.focus();

            if (editor.currentMode !== 'wysiwyg') {
                insertAtCursor(editor, insertElement('video'));
            }
        },
    },
];
