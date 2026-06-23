import type {VariableEntry} from './resolver';

import {describe, expect, it} from 'vitest';

import {
    findVariableInTag,
    formatEntries,
    getLiquidTagKeyword,
    getVariableFromOutput,
} from './utils';

describe('formatEntries', () => {
    it('formats single preset from single file', () => {
        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Hello', filePath: '/project/presets.yaml', line: 1},
        ];

        const result = formatEntries(entries, '/project');

        expect(result).toContain('| default | `Hello` |');
        expect(result).toContain('presets.yaml');
    });

    it('formats multiple presets from single file', () => {
        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Presets', filePath: '/project/presets.yaml', line: 1},
            {preset: 'external', value: 'Presets ext', filePath: '/project/presets.yaml', line: 4},
        ];

        const result = formatEntries(entries, '/project');

        expect(result).toContain('| default | `Presets` |');
        expect(result).toContain('| external | `Presets ext` |');
        expect(result).toContain('presets.yaml');
    });

    it('formats entries from multiple files with file headers', () => {
        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Near', filePath: '/project/pages/presets.yaml', line: 1},
            {preset: 'default', value: 'Far', filePath: '/project/presets.yaml', line: 1},
        ];

        const result = formatEntries(entries, '/project');

        expect(result).toContain('*pages/presets.yaml*');
        expect(result).toContain('*presets.yaml*');
        expect(result).toContain('| default | `Near` |');
        expect(result).toContain('| default | `Far` |');
    });

    it('uses basename when root is null', () => {
        const entries: VariableEntry[] = [
            {preset: 'default', value: 'v', filePath: '/any/path/presets.yaml', line: 0},
        ];

        const result = formatEntries(entries, null);

        expect(result).toContain('presets.yaml');
        expect(result).not.toContain('/any/path');
    });

    it('includes table headers', () => {
        const entries: VariableEntry[] = [
            {preset: 'default', value: 'v', filePath: '/p/presets.yaml', line: 0},
        ];

        const result = formatEntries(entries, '/p');

        expect(result).toContain('| Preset | Value |');
        expect(result).toContain('|--------|-------|');
    });
});

describe('getLiquidTagKeyword', () => {
    it('returns keyword when cursor is inside {% if %} tag', () => {
        const line = "{% if text == 'hello' %}";
        const result = getLiquidTagKeyword(line, 5);

        expect(result).not.toBeNull();
        expect(result?.keyword).toBe('if');
        expect(result?.start).toBe(0);
        expect(result?.end).toBe(line.length);
    });

    it('returns keyword for {% endif %}', () => {
        const line = '{% endif %}';
        const result = getLiquidTagKeyword(line, 3);

        expect(result?.keyword).toBe('endif');
    });

    it('returns keyword for {% for %} tag', () => {
        const line = '{% for product in products %}';
        const result = getLiquidTagKeyword(line, 4);

        expect(result?.keyword).toBe('for');
    });

    it('returns keyword for {% endfor %}', () => {
        const line = '{% endfor %}';
        const result = getLiquidTagKeyword(line, 5);

        expect(result?.keyword).toBe('endfor');
    });

    it('returns keyword for {% elsif %}', () => {
        const line = "{% elsif text == 'world' %}";
        const result = getLiquidTagKeyword(line, 6);

        expect(result?.keyword).toBe('elsif');
    });

    it('returns keyword for {% else %}', () => {
        const line = '{% else %}';
        const result = getLiquidTagKeyword(line, 4);

        expect(result?.keyword).toBe('else');
    });

    it('returns null when cursor is outside any tag', () => {
        const line = 'some text {% if x %} more text';
        const result = getLiquidTagKeyword(line, 0);

        expect(result).toBeNull();
    });

    it('returns null for non-control tags', () => {
        const line = '{% include file="foo.md" %}';
        const result = getLiquidTagKeyword(line, 5);

        expect(result).toBeNull();
    });
});

describe('findVariableInTag', () => {
    it('finds variable in {% if var == value %} tag', () => {
        const line = "{% if text == 'hello' %}";
        const result = findVariableInTag(line, 6);

        expect(result).not.toBeNull();
        expect(result?.name).toBe('text');
    });

    it('finds variable in {% for item in collection %} tag', () => {
        const line = '{% for product in products %}';
        const result = findVariableInTag(line, 20);

        expect(result?.name).toBe('products');
    });

    it('returns null when cursor is on a keyword', () => {
        const line = "{% if text == 'hello' %}";
        const result = findVariableInTag(line, 3);

        expect(result).toBeNull();
    });

    it('returns null when cursor is outside a tag', () => {
        const line = 'Hello {% if x %} world';
        const result = findVariableInTag(line, 0);

        expect(result).toBeNull();
    });

    it('returns null for number literals', () => {
        const line = '{% for i in (1..5) %}';
        const result = findVariableInTag(line, 16);

        expect(result).toBeNull();
    });
});

describe('getVariableFromOutput', () => {
    it('finds variable in {{ var }} at cursor inside', () => {
        const line = '{{ presets_text }}';
        const result = getVariableFromOutput(line, 5);

        expect(result?.name).toBe('presets_text');
        expect(result?.start).toBe(0);
        expect(result?.end).toBe(line.length);
    });

    it('returns null when cursor is outside {{ }}', () => {
        const line = 'some text {{ var }} more';
        const result = getVariableFromOutput(line, 0);

        expect(result).toBeNull();
    });

    it('finds second variable when cursor is on it', () => {
        const line = '{{ a }} and {{ b }}';
        const result = getVariableFromOutput(line, 14);

        expect(result?.name).toBe('b');
    });
});
