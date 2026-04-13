import {describe, expect, it, vi} from 'vitest';

import {debounce, getFilesMap} from './utils';

describe('debounce', () => {
    it('calls the function after the delay', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a');
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('a');

        vi.useRealTimers();
    });

    it('resets the timer on subsequent calls', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a');
        vi.advanceTimersByTime(50);
        debounced('b');
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('b');

        vi.useRealTimers();
    });
});

describe('getFilesMap', () => {
    const files = ['docs/guide/intro.md', 'docs/guide/setup.md', 'docs/api/rest.md', 'readme.md'];

    it('groups files by directory', () => {
        const result = getFilesMap('', files);

        expect([...result.keys()]).toEqual(['', 'docs/api', 'docs/guide']);
        expect(result.get('')).toEqual(['readme.md']);
        expect(result.get('docs/guide')).toEqual(['docs/guide/intro.md', 'docs/guide/setup.md']);
    });

    it('filters by filename (case-insensitive)', () => {
        const result = getFilesMap('REST', files);

        expect(result.size).toBe(1);
        expect(result.get('docs/api')).toEqual(['docs/api/rest.md']);
    });

    it('returns empty map when no matches', () => {
        const result = getFilesMap('nonexistent', files);

        expect(result.size).toBe(0);
    });

    it('sorts root directory first', () => {
        const result = getFilesMap('.md', files);
        const keys = [...result.keys()];

        expect(keys[0]).toBe('');
    });
});
