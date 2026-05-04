import type * as vscode from 'vscode';

import {describe, expect, it, vi} from 'vitest';

import {OrphanDecorationProvider, isAutoIncluded} from './decorator';

vi.mock('../utils', () => ({
    isYfmFile: (fsPath: string) => fsPath.startsWith('/docs/'),
}));

function uri(path: string) {
    return {fsPath: path} as vscode.Uri;
}

describe('isAutoIncluded', () => {
    it('returns true for files in includes directory', () => {
        expect(isAutoIncluded('/docs/includes/fragment.md')).toBe(true);
    });

    it('returns true for files in nested includes directory', () => {
        expect(isAutoIncluded('/docs/guides/includes/snippet.md')).toBe(true);
    });

    it('returns true for files in directory starting with _', () => {
        expect(isAutoIncluded('/docs/_includes/fragment.md')).toBe(true);
        expect(isAutoIncluded('/docs/_assets/image.md')).toBe(true);
        expect(isAutoIncluded('/docs/_hidden/page.md')).toBe(true);
    });

    it('returns false for regular files', () => {
        expect(isAutoIncluded('/docs/guide/intro.md')).toBe(false);
        expect(isAutoIncluded('/docs/index.md')).toBe(false);
    });

    it('does not match filename, only directories', () => {
        expect(isAutoIncluded('/docs/guide/_hidden.md')).toBe(false);
        expect(isAutoIncluded('/docs/includes.md')).toBe(false);
    });
});

describe('OrphanDecorationProvider', () => {
    it('marks unreferenced .md files in yfm project', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/orphan.md'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeDefined();
        expect(decoration?.badge).toBe('?');
        expect(decoration?.tooltip).toBe(
            'Not referenced in toc.yaml or included via {% include %}',
        );
    });

    it('returns undefined for referenced .md files', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/page.md'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('returns undefined for non-.md files', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/toc.yaml'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('returns undefined when inactive (no toc.yaml found)', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set());

        const decoration = provider.provideFileDecoration(
            uri('/docs/page.md'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('returns undefined for .md files outside yfm project', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']));

        const decoration = provider.provideFileDecoration(
            uri('/other/README.md'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('returns undefined for files in includes directory', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/includes/fragment.md'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('returns undefined for files in _-prefixed directory', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/_includes/snippet.md'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('marks unreferenced blocks-yaml files', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(
            new Set(['/docs/page.md']),
            new Set(['/docs/pc.yaml', '/docs/orphan.yaml']),
        );

        const decoration = provider.provideFileDecoration(
            uri('/docs/orphan.yaml'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeDefined();
        expect(decoration?.badge).toBe('?');
    });

    it('returns undefined for referenced blocks-yaml files', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md', '/docs/pc.yaml']), new Set(['/docs/pc.yaml']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/pc.yaml'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });

    it('returns undefined for yaml files not in blocksYaml set', () => {
        const provider = new OrphanDecorationProvider();

        provider.update(new Set(['/docs/page.md']), new Set(['/docs/pc.yaml']));

        const decoration = provider.provideFileDecoration(
            uri('/docs/config.yaml'),
            {} as vscode.CancellationToken,
        );

        expect(decoration).toBeUndefined();
    });
});
