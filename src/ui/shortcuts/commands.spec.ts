import {beforeEach, describe, expect, it, vi} from 'vitest';

import {insertAtCursor, insertElement} from '../../utils';

import {editorShortcuts} from './commands';

vi.mock('../../utils', () => ({
    insertAtCursor: vi.fn(),
    insertElement: vi.fn(),
}));

function findShortcut(action: string) {
    const result = editorShortcuts.find((s) => s.action === action);

    if (!result) {
        throw new Error(`Shortcut for action "${action}" not found`);
    }

    return result;
}

describe('editorShortcuts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs table action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                createYfmTable: {run},
            },
        };

        findShortcut('insertTable').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts table snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('| a | b |');

        findShortcut('insertTable').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('table');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '| a | b |');
    });

    it('runs note action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                toYfmNote: {run},
            },
        };

        findShortcut('insertNote').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts note snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('{% note info "Title" %}');

        findShortcut('insertNote').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('note');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '{% note info "Title" %}');
    });

    it('runs include action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                toYfmInclude: {run},
            },
        };

        findShortcut('insertInclude').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts include snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('{% include []() %}');

        findShortcut('insertInclude').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('include');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '{% include []() %}');
    });

    it('runs frontmatter action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                createFrontmatter: {run},
            },
        };

        findShortcut('insertFrontmatter').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts frontmatter snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('---\n\n---');

        findShortcut('insertFrontmatter').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('frontmatter');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '---\n\n---');
    });

    it('runs mermaid action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                createMermaid: {run},
            },
        };

        findShortcut('insertMermaid').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
    });

    it('runs page-constructor action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                createYfmPageConstructor: {run},
            },
        };

        findShortcut('insertPageConstructor').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts page-constructor snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('::: page-constructor\n:::');

        findShortcut('insertPageConstructor').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('pageConstructor');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '::: page-constructor\n:::');
    });

    it('runs html block action in wysiwyg mode', () => {
        const run = vi.fn();
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
            actions: {
                createYfmHtmlBlock: {run},
            },
        };

        findShortcut('insertHtmlBlock').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(run).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts html block snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('::: html\n<div>HTML content</div>\n:::');

        findShortcut('insertHtmlBlock').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('htmlBlock');
        expect(insertAtCursor).toHaveBeenCalledWith(
            editor,
            '::: html\n<div>HTML content</div>\n:::',
        );
    });

    it('does not insert video in wysiwyg mode', () => {
        const editor = {
            currentMode: 'wysiwyg',
            focus: vi.fn(),
        };

        findShortcut('insertVideo').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertAtCursor).not.toHaveBeenCalled();
    });

    it('inserts video snippet in markdown mode', () => {
        const editor = {
            currentMode: 'markup',
            focus: vi.fn(),
        };
        vi.mocked(insertElement).mockReturnValue('@[]()');

        findShortcut('insertVideo').handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('video');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '@[]()');
    });
});
