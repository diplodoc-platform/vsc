import {describe, expect, it, vi} from 'vitest';

import {
    debounce,
    debounceByKey,
    insertAtCursor,
    insertElement,
    isBlocksYaml,
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

describe('debounce', () => {
    it('delays execution', async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });

    it('resets timer on repeated calls', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced();
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });

    it('passes arguments to the original function', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a', 'b');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('a', 'b');

        vi.useRealTimers();
    });
});

describe('debounceByKey', () => {
    it('debounces per key independently', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounceByKey(fn, 100, (key: string) => key);

        debounced('a');
        debounced('b');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenCalledWith('a');
        expect(fn).toHaveBeenCalledWith('b');

        vi.useRealTimers();
    });

    it('resets only the matching key', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounceByKey(fn, 100, (key: string) => key);

        debounced('a');
        vi.advanceTimersByTime(50);
        debounced('a');
        vi.advanceTimersByTime(50);

        expect(fn).not.toHaveBeenCalledWith('a');

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledWith('a');

        vi.useRealTimers();
    });

    it('clear cancels pending timer for key', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounceByKey(fn, 100, (key: string) => key);

        debounced('a');
        debounced.clear('a');
        vi.advanceTimersByTime(200);

        expect(fn).not.toHaveBeenCalled();

        vi.useRealTimers();
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
