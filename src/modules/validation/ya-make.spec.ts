import type {PluginMessage, YfmLintError} from './types';

import {describe, expect, it} from 'vitest';

import {isYaMakeProvidedLink, matchesYaMakeDest} from './ya-make';

describe('matchesYaMakeDest', () => {
    it('returns true when name matches exactly', () => {
        expect(matchesYaMakeDest('extra.md', new Set(['extra.md']))).toBe(true);
    });

    it('returns true when name without extension matches with .md added', () => {
        expect(matchesYaMakeDest('extra', new Set(['extra.md']))).toBe(true);
    });

    it('returns true for path with directory prefix', () => {
        expect(matchesYaMakeDest('ru/extra.md', new Set(['extra.md']))).toBe(true);
    });

    it('returns false when name is not in dests', () => {
        expect(matchesYaMakeDest('other.md', new Set(['extra.md']))).toBe(false);
    });

    it('returns false for empty dests', () => {
        expect(matchesYaMakeDest('extra.md', new Set())).toBe(false);
    });

    it('trims whitespace from linkPath', () => {
        expect(matchesYaMakeDest('  extra.md  ', new Set(['extra.md']))).toBe(true);
    });
});

describe('isYaMakeProvidedLink', () => {
    const dests = new Set(['extra.md']);

    it('returns false when dests are empty', () => {
        const error: PluginMessage = {level: 'error', message: 'Link is unreachable: extra.md'};

        expect(isYaMakeProvidedLink(error, new Set())).toBe(false);
    });

    it('returns true for PluginMessage with matching unreachable link', () => {
        const error: PluginMessage = {level: 'error', message: 'Link is unreachable: extra.md'};

        expect(isYaMakeProvidedLink(error, dests)).toBe(true);
    });

    it('returns false for PluginMessage with non-matching link', () => {
        const error: PluginMessage = {level: 'error', message: 'Link is unreachable: missing.md'};

        expect(isYaMakeProvidedLink(error, dests)).toBe(false);
    });

    it('returns false for PluginMessage with unrelated message', () => {
        const error: PluginMessage = {level: 'error', message: 'Some other error'};

        expect(isYaMakeProvidedLink(error, dests)).toBe(false);
    });

    it('returns true for YfmLintError with unreachable-link rule and matching context', () => {
        const error = {
            ruleNames: ['YFM003', 'unreachable-link'],
            ruleDescription: 'Link is unreachable',
            errorContext: 'Unreachable link: "extra.md"; Reason: File not found',
            level: 'error',
        } as unknown as YfmLintError;

        expect(isYaMakeProvidedLink(error, dests)).toBe(true);
    });

    it('returns false for YfmLintError with unreachable-link but non-matching context', () => {
        const error = {
            ruleNames: ['YFM003', 'unreachable-link'],
            ruleDescription: 'Link is unreachable',
            errorContext: 'Unreachable link: "other.md"; Reason: File not found',
            level: 'error',
        } as unknown as YfmLintError;

        expect(isYaMakeProvidedLink(error, dests)).toBe(false);
    });

    it('returns false for YfmLintError with a different rule', () => {
        const error = {
            ruleNames: ['YFM001', 'some-other-rule'],
            ruleDescription: 'Some rule',
            errorContext: 'extra.md',
            level: 'error',
        } as unknown as YfmLintError;

        expect(isYaMakeProvidedLink(error, dests)).toBe(false);
    });

    it('returns false for YfmLintError with unreachable-link but empty context', () => {
        const error = {
            ruleNames: ['YFM003', 'unreachable-link'],
            ruleDescription: 'Link is unreachable',
            errorContext: '',
            level: 'error',
        } as unknown as YfmLintError;

        expect(isYaMakeProvidedLink(error, dests)).toBe(false);
    });
});
