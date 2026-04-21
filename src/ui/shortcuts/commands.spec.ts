import {beforeEach, describe, expect, it, vi} from 'vitest';

import {insertAtCursor, insertElement} from '../../utils';

import {editorShortcuts} from './commands';

vi.mock('../../utils', () => ({
    insertAtCursor: vi.fn(),
    insertElement: vi.fn(),
}));

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

        editorShortcuts[0].handler(editor as never);

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

        editorShortcuts[0].handler(editor as never);

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

        editorShortcuts[1].handler(editor as never);

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

        editorShortcuts[1].handler(editor as never);

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(insertElement).toHaveBeenCalledWith('note');
        expect(insertAtCursor).toHaveBeenCalledWith(editor, '{% note info "Title" %}');
    });
});
