import type {PluginMessage, ValidationMessage, YfmLintError} from './types';
import type * as vscode from 'vscode';

import {afterEach, describe, expect, it} from 'vitest';
import {existsSync, mkdirSync, rmSync, writeFileSync} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';

import {
    buildLintConfig,
    clearConfigCache,
    findConfig,
    formatLintMessage,
    formatPluginMessage,
    hasExplicitAnchor,
    isTermDefinition,
    parseMissingAnchor,
    processYfmlintConfig,
    toDiagnostic,
    toDiagnostics,
    toLintDiagnostic,
    toPluginDiagnostic,
} from './utils';

function mockDocument(text: string): vscode.TextDocument {
    const lines = text.split('\n');
    return {
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
    } as unknown as vscode.TextDocument;
}

function mockLintError(overrides: Record<string, unknown> = {}): YfmLintError {
    return {
        ruleNames: ['MD001'],
        ruleDescription: 'Test rule',
        lineNumber: 1,
        level: 'warn',
        ...overrides,
    } as unknown as YfmLintError;
}

function mockPluginError(overrides: Partial<PluginMessage> = {}): PluginMessage {
    return {
        level: 'warn',
        message: 'Test message',
        ...overrides,
    };
}

describe('isMd032InsideTermDefinition', () => {
    const termContent = [
        '# Index',
        '',
        '[*term1]: Определение термина',
        '* списки;',
        '* ссылки;',
        '',
        '[*term2]: Определение.',
    ].join('\n');

    it('suppresses MD032 for a list inside a term definition', () => {
        const error = mockLintError({ruleNames: ['MD032', 'blanks-around-lists'], lineNumber: 4});

        expect(isTermDefinition(error, termContent)).toBe(true);
    });

    it('does not suppress MD032 for a regular list', () => {
        const content = ['# Index', 'text', '* item', '* item'].join('\n');
        const error = mockLintError({ruleNames: ['MD032', 'blanks-around-lists'], lineNumber: 3});

        expect(isTermDefinition(error, content)).toBe(false);
    });

    it('does not suppress other rules inside a term definition', () => {
        const error = mockLintError({ruleNames: ['MD030'], lineNumber: 4});

        expect(isTermDefinition(error, termContent)).toBe(false);
    });

    it('ignores plugin messages', () => {
        expect(isTermDefinition(mockPluginError(), termContent)).toBe(false);
    });
});

describe('formatLintMessage', () => {
    it('formats basic lint error', () => {
        const error = mockLintError({
            ruleNames: ['MD001'],
            ruleDescription: 'Heading levels should increment by one',
        });

        expect(formatLintMessage(error)).toBe(
            'Diplodoc MD001: Heading levels should increment by one',
        );
    });

    it('includes errorDetail', () => {
        const error = mockLintError({
            ruleNames: ['MD013'],
            ruleDescription: 'Line length',
            errorDetail: 'Expected: 80; Actual: 120',
        });

        expect(formatLintMessage(error)).toContain('Expected: 80; Actual: 120');
    });

    it('includes errorContext', () => {
        const error = mockLintError({
            ruleNames: ['MD010'],
            ruleDescription: 'Hard tabs',
            errorContext: 'Column: 5',
        });
        expect(formatLintMessage(error)).toContain('Context: Column: 5');
    });

    it('falls back to YFM when ruleNames is empty', () => {
        const error = mockLintError({
            ruleNames: [],
            ruleDescription: 'Some error',
        });

        expect(formatLintMessage(error)).toContain('Diplodoc YFM:');
    });
});

describe('formatPluginMessage', () => {
    it('formats plugin message', () => {
        const error = mockPluginError({message: 'Link is broken'});
        expect(formatPluginMessage(error)).toBe('Diplodoc: Link is broken');
    });

    it('strips ANSI codes', () => {
        const error = mockPluginError({level: 'error', message: '\u001B[31mRed error\u001B[0m'});
        expect(formatPluginMessage(error)).toBe('Diplodoc: Red error');
    });
});

describe('toLintDiagnostic', () => {
    it('creates diagnostic with source and code', () => {
        const doc = mockDocument('hello world');
        const error = mockLintError({level: 'error'});

        const diag = toLintDiagnostic(error, doc);
        expect(diag.source).toBe('Diplodoc');
        expect(diag.code).toBe('MD001');
    });
});

describe('toPluginDiagnostic', () => {
    it('creates diagnostic with source', () => {
        const doc = mockDocument('some content');
        const error = mockPluginError({message: 'Something wrong'});

        const diag = toPluginDiagnostic(error, doc);
        expect(diag.source).toBe('Diplodoc');
        expect(diag.message).toContain('Something wrong');
    });
});

describe('toDiagnostic', () => {
    it('dispatches lint errors to toLintDiagnostic', () => {
        const doc = mockDocument('line');
        const error: ValidationMessage = mockLintError();

        const diag = toDiagnostic(error, doc);
        expect(diag.code).toBe('MD001');
    });

    it('dispatches plugin errors to toPluginDiagnostic', () => {
        const doc = mockDocument('line');
        const error: ValidationMessage = mockPluginError({
            level: 'error',
            message: 'Plugin error',
        });

        const diag = toDiagnostic(error, doc);
        expect(diag.code).toBeUndefined();
    });
});

describe('toDiagnostics', () => {
    it('converts array of errors', () => {
        const doc = mockDocument('line1\nline2');
        const errors: ValidationMessage[] = [
            mockLintError(),
            mockPluginError({level: 'error', message: 'Plugin msg'}),
        ];

        const diags = toDiagnostics(errors, doc);
        expect(diags).toHaveLength(2);
    });
});

describe('findConfig', () => {
    const testRoot = join(tmpdir(), `yfm-config-test-${Date.now()}`);
    const nestedDir = join(testRoot, 'a', 'b', 'c');

    function setup() {
        mkdirSync(nestedDir, {recursive: true});
    }

    afterEach(() => {
        clearConfigCache();
        rmSync(testRoot, {recursive: true, force: true});
    });

    it('finds .yfm in the same directory', () => {
        setup();
        writeFileSync(join(testRoot, '.yfm'), 'allowHtml: true\n');

        const config = findConfig(testRoot, '.yfm');
        expect(config).toEqual({allowHtml: true});
    });

    it('finds .yfm in a parent directory', () => {
        setup();
        writeFileSync(join(testRoot, '.yfm'), 'allowHtml: false\nlang: ru\n');

        const config = findConfig(nestedDir, '.yfm');
        expect(config).toEqual({allowHtml: false, lang: 'ru'});
    });

    it('returns null when no .yfm exists', () => {
        setup();
        const config = findConfig(nestedDir, '.yfm');
        expect(config).toBeNull();
    });

    it('returns null for invalid YAML', () => {
        setup();
        writeFileSync(join(testRoot, '.yfm'), ':\n  :\n    - [invalid');

        const config = findConfig(nestedDir, '.yfm');
        expect(config).toBeNull();
    });

    it('reads allowHtml correctly from real test mock', () => {
        const mocksDir = join(__dirname, '../../../tests/mocks');

        if (!existsSync(join(mocksDir, '.yfm'))) {
            return;
        }

        const config = findConfig(mocksDir, '.yfm');
        expect(config).not.toBeNull();
        expect(config?.allowHtml).toBe(true);
    });

    it('finds .yfmlint in the same directory', () => {
        setup();
        writeFileSync(
            join(testRoot, '.yfmlint'),
            'default: true\nYFM001:\n  level: error\n  maximum: 50\n',
        );

        const config = findConfig(testRoot, '.yfmlint');
        expect(config).toEqual({default: true, YFM001: {level: 'error', maximum: 50}});
    });

    it('finds .yfmlint with log-levels', () => {
        setup();
        writeFileSync(
            join(testRoot, '.yfmlint'),
            'log-levels:\n  MD001: disabled\n  MD041: disabled\n',
        );

        const config = findConfig(testRoot, '.yfmlint');
        expect(config).toEqual({'log-levels': {MD001: 'disabled', MD041: 'disabled'}});
    });
});

describe('processYfmlintConfig', () => {
    it('returns empty object for null config', () => {
        expect(processYfmlintConfig(null)).toEqual({});
    });

    it('passes through config without log-levels unchanged', () => {
        const config = {default: true, MD013: false, YFM001: {level: 'warn', maximum: 80}};
        expect(processYfmlintConfig(config)).toEqual(config);
    });

    it('flattens log-levels into per-rule entries', () => {
        const config = {
            'log-levels': {MD001: 'disabled', YFM003: 'error'},
        };

        expect(processYfmlintConfig(config)).toEqual({
            MD001: 'disabled',
            YFM003: 'error',
        });
    });

    it('inline rule config takes precedence over log-levels', () => {
        const config = {
            YFM001: {level: 'warn', maximum: 80},
            'log-levels': {YFM001: 'error', MD007: 'error'},
        };

        const result = processYfmlintConfig(config);
        expect(result).toEqual({
            YFM001: {level: 'warn', maximum: 80},
            MD007: 'error',
        });
    });

    it('ignores non-object log-levels value', () => {
        const config = {'log-levels': 'invalid' as unknown};
        expect(processYfmlintConfig(config as Record<string, unknown>)).toEqual({});
    });
});

describe('buildLintConfig', () => {
    it('returns base defaults when no .yfmlint config', () => {
        const config = buildLintConfig(null, false);
        expect(config.default).toBe(true);
        expect(config.MD013).toBe(false);
        expect(config.MD033).toBe(true);
    });

    it('disables MD033 when allowHtml is true', () => {
        const config = buildLintConfig(null, true);
        expect(config.MD033).toBe(false);
    });

    it('allows user to override default', () => {
        const config = buildLintConfig({default: false}, false);
        expect(config.default).toBe(false);
    });

    it('allows user to re-enable MD013', () => {
        const config = buildLintConfig({MD013: true}, false);
        expect(config.MD013).toBe(true);
    });

    it('MD033 cannot be overridden by user config', () => {
        const config = buildLintConfig({MD033: true}, true);
        expect(config.MD033).toBe(true);
    });

    it('merges user rules with defaults', () => {
        const config = buildLintConfig(
            {YFM001: {level: 'error', maximum: 50}, YFM003: 'disabled'},
            false,
        );

        expect(config.default).toBe(true);
        expect(config.MD013).toBe(false);
        expect(config.YFM001).toEqual({level: 'error', maximum: 50});
        expect(config.YFM003).toBe('disabled');
    });

    it('processes log-levels from .yfmlint config', () => {
        const config = buildLintConfig(
            {'log-levels': {MD001: 'disabled', MD041: 'disabled'}},
            false,
        );

        expect(config.MD001).toBe('disabled');
        expect(config.MD041).toBe('disabled');
    });

    it('applies vscLintRules over extension defaults', () => {
        const config = buildLintConfig(null, false, false, {MD013: true});
        expect(config.MD013).toBe(true);
    });

    it('lets .yfmlint override vscLintRules', () => {
        const config = buildLintConfig({MD013: false}, false, false, {MD013: true});
        expect(config.MD013).toBe(false);
    });

    it('empty vscLintRules keeps default behavior', () => {
        const config = buildLintConfig(null, false, false, {});
        expect(config.default).toBe(true);
        expect(config.MD013).toBe(false);
        expect(config.MD033).toBe(true);
    });
});

describe('parseMissingAnchor', () => {
    it('parses link, anchor and source from a Title not found message', () => {
        const result = parseMissingAnchor(
            'Title not found: ./console/settings.md#cloud-cash-register in /docs/ru/fiscalization.md',
        );

        expect(result).toEqual({
            link: './console/settings.md',
            anchor: 'cloud-cash-register',
            source: '/docs/ru/fiscalization.md',
        });
    });

    it('parses a same-file anchor with empty link', () => {
        const result = parseMissingAnchor('Title not found: #section in /docs/ru/page.md');

        expect(result).toEqual({link: '', anchor: 'section', source: '/docs/ru/page.md'});
    });

    it('strips ANSI codes before parsing', () => {
        const result = parseMissingAnchor(
            'Title not found: \u001B[35ma.md\u001B[0m#anchor in /docs/page.md',
        );

        expect(result).toEqual({link: 'a.md', anchor: 'anchor', source: '/docs/page.md'});
    });

    it('returns null for unrelated messages', () => {
        expect(parseMissingAnchor('Link is unreachable: a.md in /docs/page.md')).toBeNull();
    });
});

describe('hasExplicitAnchor', () => {
    it('finds an explicit {#anchor} even inside a liquid condition', () => {
        const content = [
            '{% if tld == "ru" %}',
            '## Настройка облачной кассы {#cloud-cash-register}',
            '{% endif %}',
        ].join('\n');

        expect(hasExplicitAnchor(content, 'cloud-cash-register')).toBe(true);
    });

    it('returns false when the anchor is absent', () => {
        expect(hasExplicitAnchor('# Title {#intro}', 'cloud-cash-register')).toBe(false);
    });

    it('does not match a partial anchor', () => {
        expect(
            hasExplicitAnchor('# Title {#cloud-cash-register-extra}', 'cloud-cash-register'),
        ).toBe(false);
    });
});
