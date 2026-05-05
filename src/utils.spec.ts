import {describe, expect, it, vi} from 'vitest';

import {
    insertAtCursor,
    insertElement,
    isBlocksYaml,
    isExternalUrl,
    isInternalPath,
    unwrapPageConstructor,
    wrapPageConstructor,
} from './utils';

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

    it('returns video', () => {
        const result = insertElement('video');

        expect(result).toBe('@[]()');
    });

    it('returns mermaid block', () => {
        const result = insertElement('mermaid');

        expect(result).toContain('```mermaid');
        expect(result).toContain('sequenceDiagram');
    });
});

describe('isBlocksYaml', () => {
    const makeDoc = (languageId: string, text: string) =>
        ({languageId, getText: () => text}) as never;

    it('returns true for yaml with top-level blocks key', () => {
        expect(isBlocksYaml(makeDoc('yaml', 'blocks:\n  - type: header-block'))).toBe(true);
    });

    it('returns true for yaml with indented blocks key', () => {
        expect(isBlocksYaml(makeDoc('yaml', '  blocks:\n  - type: header-block'))).toBe(true);
    });

    it('returns false for non-yaml language', () => {
        expect(isBlocksYaml(makeDoc('markdown', 'blocks:\n  - type: header-block'))).toBe(false);
    });

    it('returns false for yaml without blocks key', () => {
        expect(isBlocksYaml(makeDoc('yaml', 'items:\n  - name: page1'))).toBe(false);
    });

    it('returns false for yaml with blocks in a string value', () => {
        expect(isBlocksYaml(makeDoc('yaml', 'title: "blocks: yes"'))).toBe(false);
    });

    it('returns false for empty yaml', () => {
        expect(isBlocksYaml(makeDoc('yaml', ''))).toBe(false);
    });
});

describe('wrapPageConstructor', () => {
    it('wraps yaml text in page-constructor directive', () => {
        const yaml = 'blocks:\n  - type: header-block';
        const result = wrapPageConstructor(yaml);

        expect(result).toBe('::: page-constructor\nblocks:\n  - type: header-block\n:::');
    });

    it('handles empty string', () => {
        expect(wrapPageConstructor('')).toBe('::: page-constructor\n\n:::');
    });
});

describe('unwrapPageConstructor', () => {
    it('removes page-constructor directive wrapper', () => {
        const wrapped = '::: page-constructor\nblocks:\n  - type: header-block\n:::';
        const result = unwrapPageConstructor(wrapped);

        expect(result).toBe('blocks:\n  - type: header-block');
    });

    it('handles extra whitespace in directive', () => {
        const wrapped = '::: page-constructor  \nblocks:\n  - type: header-block\n:::  ';
        const result = unwrapPageConstructor(wrapped);

        expect(result).toBe('blocks:\n  - type: header-block');
    });

    it('returns text unchanged when no directive present', () => {
        const text = 'blocks:\n  - type: header-block';

        expect(unwrapPageConstructor(text)).toBe(text);
    });

    it('is inverse of wrapPageConstructor', () => {
        const original = 'blocks:\n  - type: header-block\n    title: Test';
        const roundTripped = unwrapPageConstructor(wrapPageConstructor(original));

        expect(roundTripped).toBe(original);
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

describe('isExternalUrl', () => {
    it('returns true for http URLs', () => {
        expect(isExternalUrl('http://example.com')).toBe(true);
        expect(isExternalUrl('http://example.com/page')).toBe(true);
    });

    it('returns true for https URLs', () => {
        expect(isExternalUrl('https://example.com')).toBe(true);
        expect(isExternalUrl('https://example.com/docs/guide')).toBe(true);
    });

    it('returns false for relative paths', () => {
        expect(isExternalUrl('guide/intro.md')).toBe(false);
        expect(isExternalUrl('./page.md')).toBe(false);
        expect(isExternalUrl('../other/page.md')).toBe(false);
    });

    it('returns false for bare filenames', () => {
        expect(isExternalUrl('index.md')).toBe(false);
        expect(isExternalUrl('toc.yaml')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isExternalUrl('')).toBe(false);
    });

    it('returns false for non-http protocols', () => {
        expect(isExternalUrl('ftp://files.example.com')).toBe(false);
        expect(isExternalUrl('file:///local/path')).toBe(false);
        expect(isExternalUrl('mailto:user@example.com')).toBe(false);
    });

    it('returns false for strings containing http mid-text', () => {
        expect(isExternalUrl('page-https://example.com')).toBe(false);
        expect(isExternalUrl('text http://example.com')).toBe(false);
    });
});

describe('isInternalPath', () => {
    it('returns true for bare filenames with extension', () => {
        expect(isInternalPath('index.md')).toBe(true);
        expect(isInternalPath('toc.yaml')).toBe(true);
    });

    it('returns true for relative paths', () => {
        expect(isInternalPath('./page.md')).toBe(true);
        expect(isInternalPath('../docs/guide.md')).toBe(true);
        expect(isInternalPath('guide/intro.md')).toBe(true);
    });

    it('returns true for absolute unix-like paths', () => {
        expect(isInternalPath('/page.md')).toBe(true);
        expect(isInternalPath('/docs/guide.md')).toBe(true);
    });

    it('returns true for anchor links', () => {
        expect(isInternalPath('#section')).toBe(true);
    });

    it('returns false for plain words without extension', () => {
        expect(isInternalPath('dark')).toBe(false);
        expect(isInternalPath('some-theme')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isInternalPath('')).toBe(false);
    });

    it('returns false for external http/https URLs', () => {
        expect(isInternalPath('http://example.com')).toBe(false);
        expect(isInternalPath('https://example.com/docs')).toBe(false);
    });
});
