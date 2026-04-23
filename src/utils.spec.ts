import {describe, expect, it, vi} from 'vitest';

import {insertAtCursor, insertElement} from './utils';

describe('insertElement', () => {
    it('returns markdown table', () => {
        const result = insertElement('table');

        expect(result).toContain('| --- | --- |');
        expect(result.split('\n')).toHaveLength(3);
    });

    it('returns note block', () => {
        const result = insertElement('note');

        expect(result).toContain('{% note info');
        expect(result).toContain('{% endnote %}');
    });

    it('returns include directive', () => {
        const result = insertElement('include');

        expect(result).toBe('{% include []() %}');
    });

    it('returns frontmatter block', () => {
        const result = insertElement('frontmatter');

        expect(result).toContain('---');
        expect(result.startsWith('---')).toBe(true);
        expect(result.endsWith('---')).toBe(true);
    });

    it('returns cut block', () => {
        const result = insertElement('cut');

        expect(result).toContain('{% cut');
        expect(result).toContain('{% endcut %}');
    });

    it('returns checkbox', () => {
        const result = insertElement('checkbox');

        expect(result).toBe('[ ] ');
    });

    it('returns mermaid block', () => {
        const result = insertElement('mermaid');

        expect(result).toContain('```mermaid');
        expect(result).toContain('sequenceDiagram');
    });
});

describe('insertAtCursor', () => {
    it('appends text when markup editor is unavailable', () => {
        const editor = {
            append: vi.fn(),
        };

        insertAtCursor(editor as never, 'content');

        expect(editor.append).toHaveBeenCalledWith('\ncontent');
    });

    it('inserts text into an empty line', () => {
        const dispatch = vi.fn();
        const focus = vi.fn();
        const editor = {
            markupEditor: {
                cm: {
                    state: {
                        selection: {
                            main: {
                                from: 0,
                            },
                        },
                        doc: {
                            lineAt: () => ({
                                from: 0,
                                to: 0,
                                length: 0,
                            }),
                        },
                    },
                    dispatch,
                    focus,
                },
            },
            append: vi.fn(),
        };

        insertAtCursor(editor as never, 'content');

        expect(dispatch).toHaveBeenCalledWith({
            changes: {from: 0, insert: 'content\n'},
            selection: {anchor: 8},
        });
        expect(focus).toHaveBeenCalledOnce();
    });

    it('adds blank lines before inserting into a non-empty line', () => {
        const dispatch = vi.fn();
        const editor = {
            markupEditor: {
                cm: {
                    state: {
                        selection: {
                            main: {
                                from: 2,
                            },
                        },
                        doc: {
                            lineAt: () => ({
                                from: 0,
                                to: 5,
                                length: 5,
                            }),
                        },
                    },
                    dispatch,
                    focus: vi.fn(),
                },
            },
            append: vi.fn(),
        };

        insertAtCursor(editor as never, 'note');

        expect(dispatch).toHaveBeenCalledWith({
            changes: {from: 5, insert: '\n\nnote\n'},
            selection: {anchor: 12},
        });
    });
});
