import {existsSync, readFileSync} from 'fs';
import {join} from 'path';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {findYfmRoot} from '../utils';

import {
    findPresetsFiles,
    findVariableLine,
    getVariable,
    parsePresetsFile,
    resolveVariables,
} from './resolver';

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

vi.mock('../utils', () => ({
    findYfmRoot: vi.fn(),
}));

const p = (...parts: string[]) => join(...parts);

describe('findPresetsFiles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array when no yfm root', () => {
        vi.mocked(findYfmRoot).mockReturnValue(null);

        expect(findPresetsFiles('/project/docs/page.md')).toEqual([]);
    });

    it('finds single presets.yaml at root', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation((f) => f === p('/project', 'presets.yaml'));

        expect(findPresetsFiles('/project/page.md')).toEqual([p('/project', 'presets.yaml')]);
    });

    it('finds multiple presets.yaml files ordered closest first', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation(
            (f) => f === p('/project/pages', 'presets.yaml') || f === p('/project', 'presets.yaml'),
        );

        const result = findPresetsFiles('/project/pages/faq.md');

        expect(result).toEqual([
            p('/project/pages', 'presets.yaml'),
            p('/project', 'presets.yaml'),
        ]);
    });

    it('returns empty array when no presets.yaml exists', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockReturnValue(false);

        expect(findPresetsFiles('/project/page.md')).toEqual([]);
    });

    it('skips own presets.yaml when document is presets.yaml', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation((f) => f === p('/project', 'presets.yaml'));

        const result = findPresetsFiles('/project/sub/presets.yaml');

        expect(result).toEqual([p('/project', 'presets.yaml')]);
    });
});

describe('parsePresetsFile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses valid presets yaml', () => {
        vi.mocked(readFileSync).mockReturnValue(
            'default:\n  text: Hello\nexternal:\n  text: World',
        );

        const result = parsePresetsFile('/project/presets.yaml');

        expect(result).toEqual({
            default: {text: 'Hello'},
            external: {text: 'World'},
        });
    });

    it('returns null for invalid yaml', () => {
        vi.mocked(readFileSync).mockReturnValue('{{invalid');

        expect(parsePresetsFile('/project/presets.yaml')).toBeNull();
    });

    it('returns null for non-object yaml', () => {
        vi.mocked(readFileSync).mockReturnValue('just a string');

        expect(parsePresetsFile('/project/presets.yaml')).toBeNull();
    });

    it('returns null when file read fails', () => {
        vi.mocked(readFileSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });

        expect(parsePresetsFile('/missing/presets.yaml')).toBeNull();
    });
});

describe('resolveVariables', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty map when no presets files', () => {
        vi.mocked(findYfmRoot).mockReturnValue(null);

        const result = resolveVariables('/project/page.md');

        expect(result.size).toBe(0);
    });

    it('collects variables from single file', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation((f) => f === p('/project', 'presets.yaml'));

        const content = 'default:\n  text: Hello\n  user: Alice\nexternal:\n  text: World';
        vi.mocked(readFileSync).mockReturnValue(content);

        const result = resolveVariables('/project/page.md');

        expect(result.has('text')).toBe(true);
        expect(result.has('user')).toBe(true);

        const textEntries = result.get('text') ?? [];
        expect(textEntries).toHaveLength(2);
        expect(textEntries[0]).toMatchObject({preset: 'default', value: 'Hello'});
        expect(textEntries[1]).toMatchObject({preset: 'external', value: 'World'});
    });

    it('collects variables from multiple files', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation(
            (f) => f === p('/project/pages', 'presets.yaml') || f === p('/project', 'presets.yaml'),
        );

        const nearContent = 'default:\n  text: Near';
        const farContent = 'default:\n  text: Far\n  extra: Value';
        const nearPath = p('/project/pages', 'presets.yaml');
        const farPath = p('/project', 'presets.yaml');

        vi.mocked(readFileSync).mockImplementation((f) => {
            if (f === nearPath) return nearContent;
            return farContent;
        });

        const result = resolveVariables('/project/pages/faq.md');

        const textEntries = result.get('text') ?? [];
        expect(textEntries).toHaveLength(2);
        expect(textEntries[0].filePath).toBe(nearPath);
        expect(textEntries[1].filePath).toBe(farPath);

        expect(result.has('extra')).toBe(true);
    });

    it('flattens nested objects with dot notation', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation((f) => f === p('/project', 'presets.yaml'));

        const content = 'default:\n  aaa:\n    b: 1\n    c: x';
        vi.mocked(readFileSync).mockReturnValue(content);

        const result = resolveVariables('/project/page.md');

        expect(result.has('aaa.b')).toBe(true);
        expect(result.has('aaa.c')).toBe(true);
        expect(result.has('aaa')).toBe(false);

        const bEntries = result.get('aaa.b') ?? [];
        expect(bEntries[0]).toMatchObject({value: '1'});
    });

    it('processes i18n variables', () => {
        vi.mocked(findYfmRoot).mockReturnValue('/project');
        vi.mocked(existsSync).mockImplementation((f) => f === p('/project', 'presets.yaml'));

        const content = 'default:\n  greeting: Hello\n  i18n:\n    ru:\n      greeting: Привет';
        vi.mocked(readFileSync).mockReturnValue(content);

        const result = resolveVariables('/project/page.md');

        expect(result.has('greeting')).toBe(true);

        const entries = result.get('greeting') ?? [];
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({preset: 'default', value: 'Hello'});
        expect(entries[1]).toMatchObject({preset: 'default/i18n/ru', value: 'Привет'});
    });
});

describe('getVariable', () => {
    it('returns variable when cursor is on it', () => {
        const result = getVariable('Hello {{text}} world', 9);

        expect(result).toEqual({name: 'text', start: 6, end: 14});
    });

    it('returns variable with spaces inside braces', () => {
        const result = getVariable('{{ text }}', 5);

        expect(result).toEqual({name: 'text', start: 0, end: 10});
    });

    it('returns null when cursor is outside variable', () => {
        expect(getVariable('Hello {{text}} world', 2)).toBeNull();
    });

    it('returns null when no variables in line', () => {
        expect(getVariable('Hello world', 5)).toBeNull();
    });

    it('finds correct variable among multiple', () => {
        const result = getVariable('{{a}} and {{b}}', 12);

        expect(result).toEqual({name: 'b', start: 10, end: 15});
    });

    it('returns variable in yaml context', () => {
        const result = getVariable("  name: '{{presets_text}}'", 15);

        expect(result).toEqual({name: 'presets_text', start: 9, end: 25});
    });

    it('returns dot-notation variable', () => {
        const result = getVariable('{{aaa.b}}', 5);

        expect(result).toEqual({name: 'aaa.b', start: 0, end: 9});
    });
});

describe('findVariableLine', () => {
    const content = [
        'default:',
        '  presets_text: Presets',
        '  user: Alice',
        'external:',
        '  presets_text: Presets external',
    ].join('\n');

    it('finds variable in default preset', () => {
        expect(findVariableLine(content, 'default', 'presets_text')).toBe(1);
    });

    it('finds variable in named preset', () => {
        expect(findVariableLine(content, 'external', 'presets_text')).toBe(4);
    });

    it('finds second variable in preset', () => {
        expect(findVariableLine(content, 'default', 'user')).toBe(2);
    });

    it('returns 0 when variable not found', () => {
        expect(findVariableLine(content, 'default', 'missing')).toBe(0);
    });

    it('returns 0 when preset not found', () => {
        expect(findVariableLine(content, 'internal', 'presets_text')).toBe(0);
    });
});
