import type {VariableEntry} from './resolver';

import {describe, expect, it} from 'vitest';

import {formatEntries} from './utils';

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
