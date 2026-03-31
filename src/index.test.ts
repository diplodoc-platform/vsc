import {describe, it, expect} from 'vitest';
import {example, greet} from './index';

describe('example', () => {
    it('should return example string', () => {
        expect(example()).toBe('example');
    });
});

describe('greet', () => {
    it('should greet with name', () => {
        expect(greet('World')).toBe('Hello, World!');
    });

    it('should handle empty string', () => {
        expect(greet('')).toBe('Hello, !');
    });
});






