import {describe, expect, it} from 'vitest';

import {LruCache} from './lru-cache';

describe('LruCache', () => {
    it('stores and retrieves values', () => {
        const cache = new LruCache<string, number>(3);

        cache.set('a', 1);

        expect(cache.get('a')).toBe(1);
        expect(cache.has('a')).toBe(true);
        expect(cache.size).toBe(1);
    });

    it('returns undefined for missing keys', () => {
        const cache = new LruCache<string, number>(3);

        expect(cache.get('missing')).toBeUndefined();
        expect(cache.has('missing')).toBe(false);
    });

    it('preserves falsy values including null', () => {
        const cache = new LruCache<string, number | null>(3);

        cache.set('zero', 0);
        cache.set('nullish', null);

        expect(cache.get('zero')).toBe(0);
        expect(cache.has('zero')).toBe(true);
        expect(cache.get('nullish')).toBeNull();
        expect(cache.has('nullish')).toBe(true);
    });

    it('evicts the least-recently-used entry beyond max size', () => {
        const cache = new LruCache<string, number>(2);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);

        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);
        expect(cache.has('c')).toBe(true);
        expect(cache.size).toBe(2);
    });

    it('marks entries as recently used on get', () => {
        const cache = new LruCache<string, number>(2);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.get('a');
        cache.set('c', 3);

        expect(cache.has('a')).toBe(true);
        expect(cache.has('b')).toBe(false);
        expect(cache.has('c')).toBe(true);
    });

    it('updating an existing key does not evict others', () => {
        const cache = new LruCache<string, number>(2);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('a', 10);

        expect(cache.get('a')).toBe(10);
        expect(cache.has('b')).toBe(true);
        expect(cache.size).toBe(2);
    });

    it('delete and clear remove entries', () => {
        const cache = new LruCache<string, number>(3);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.delete('a');

        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);

        cache.clear();

        expect(cache.size).toBe(0);
        expect(cache.has('b')).toBe(false);
    });
});
