import type * as vscode from 'vscode';

import {mkdirSync, rmSync, writeFileSync} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {
    ORPHAN_DIAGNOSTIC_MESSAGE,
    OrphanCodeActionProvider,
    buildInsertEdit,
    computeHref,
    detectItemIndent,
    findNearestToc,
    findRootToc,
} from './code-actions';

describe('findNearestToc / findRootToc', () => {
    const root = join(tmpdir(), `orphan-codeactions-test-${process.pid}`);

    beforeAll(() => {
        mkdirSync(join(root, 'section', 'sub'), {recursive: true});
        writeFileSync(join(root, '.yfm'), '');
        writeFileSync(join(root, 'toc.yaml'), 'items:\n  - href: page.md\n');
        writeFileSync(join(root, 'page.md'), '');
        writeFileSync(join(root, 'section', 'toc-common.yaml'), 'items:\n  - href: nested.md\n');
        writeFileSync(join(root, 'section', 'nested.md'), '');
        writeFileSync(join(root, 'section', 'sub', 'deep.md'), '');
    });

    afterAll(() => {
        rmSync(root, {recursive: true, force: true});
    });

    it('findNearestToc — returns toc.yaml from same dir', () => {
        expect(findNearestToc(join(root, 'page.md'))).toBe(join(root, 'toc.yaml'));
    });

    it('findNearestToc — returns toc in nested dir', () => {
        expect(findNearestToc(join(root, 'section', 'nested.md'))).toBe(
            join(root, 'section', 'toc-common.yaml'),
        );
    });

    it('findNearestToc — walks up when subdir has no toc', () => {
        expect(findNearestToc(join(root, 'section', 'sub', 'deep.md'))).toBe(
            join(root, 'section', 'toc-common.yaml'),
        );
    });

    it('findNearestToc — returns null for file outside yfm project', () => {
        expect(findNearestToc('/tmp/no-such-project-xyz/file.md')).toBeNull();
    });

    it('findRootToc — returns toc at yfm root', () => {
        expect(findRootToc(join(root, 'page.md'))).toBe(join(root, 'toc.yaml'));
    });

    it('findRootToc — returns root toc even when nested toc exists', () => {
        expect(findRootToc(join(root, 'section', 'nested.md'))).toBe(join(root, 'toc.yaml'));
    });

    it('findRootToc — returns null for file outside yfm project', () => {
        expect(findRootToc('/tmp/no-such-project-xyz/file.md')).toBeNull();
    });
});

describe('detectItemIndent', () => {
    it('detects 2-space indent', () => {
        expect(detectItemIndent('items:\n  - name: A\n    href: a.md\n')).toBe('  ');
    });

    it('detects 4-space indent', () => {
        expect(detectItemIndent('items:\n    - name: A\n      href: a.md\n')).toBe('    ');
    });

    it('defaults to 2 spaces when no items found', () => {
        expect(detectItemIndent('title: My docs\n')).toBe('  ');
    });
});

describe('computeHref', () => {
    it('returns filename when file is next to toc', () => {
        expect(computeHref('/docs/toc.yaml', '/docs/orphan.md')).toBe('orphan.md');
    });

    it('returns relative path when file is in subdir', () => {
        expect(computeHref('/docs/toc.yaml', '/docs/section/page.md')).toBe('section/page.md');
    });

    it('returns ../ path when file is above toc dir', () => {
        expect(computeHref('/docs/section/toc.yaml', '/docs/orphan.md')).toBe('../orphan.md');
    });
});

function makeUri(path: string) {
    return {fsPath: path} as vscode.Uri;
}

type EditEntry = {edit: {text: string}};

function getInsertText(edit: vscode.WorkspaceEdit): string {
    return (edit as unknown as {edits: EditEntry[]}).edits[0].edit.text;
}

describe('buildInsertEdit', () => {
    it('inserts entry after last href when file ends with newline', () => {
        const content = 'items:\n  - name: A\n    href: a.md\n';
        const tocUri = makeUri('/docs/toc.yaml');
        const {edit, nameLine} = buildInsertEdit(
            tocUri,
            content,
            '/docs/orphan.md',
            '/docs/toc.yaml',
        );

        expect(nameLine).toBe(3);
        expect(getInsertText(edit)).toBe("  - name: ''\n    href: orphan.md\n");
    });

    it('prepends newline when file does not end with newline', () => {
        const content = 'items:\n  - name: A\n    href: a.md';
        const tocUri = makeUri('/docs/toc.yaml');
        const {edit, nameLine} = buildInsertEdit(
            tocUri,
            content,
            '/docs/orphan.md',
            '/docs/toc.yaml',
        );

        expect(nameLine).toBe(3);
        expect(getInsertText(edit)).toMatch(/^\n\s+- name: ''/);
    });

    it('falls back to end of file when no href found', () => {
        const content = 'title: Empty toc\n';
        const tocUri = makeUri('/docs/toc.yaml');
        const {nameLine} = buildInsertEdit(tocUri, content, '/docs/orphan.md', '/docs/toc.yaml');

        expect(nameLine).toBeGreaterThanOrEqual(0);
    });

    it('uses detected indent from content', () => {
        const content = 'items:\n    - name: A\n      href: a.md\n';
        const tocUri = makeUri('/docs/toc.yaml');
        const {edit} = buildInsertEdit(tocUri, content, '/docs/orphan.md', '/docs/toc.yaml');

        expect(getInsertText(edit)).toContain('    - name:');
    });
});

function makeDocument(path: string) {
    return {
        uri: {fsPath: path},
        languageId: 'markdown',
    } as unknown as vscode.TextDocument;
}

function makeContext(hasOrphanDiag: boolean): vscode.CodeActionContext {
    return {
        diagnostics: hasOrphanDiag
            ? ([
                  {
                      source: 'Diplodoc',
                      message: ORPHAN_DIAGNOSTIC_MESSAGE,
                  },
              ] as vscode.Diagnostic[])
            : [],
        triggerKind: 1 as vscode.CodeActionTriggerKind,
        only: undefined,
    };
}

function makeProvider(nearestToc: string | null, rootToc: string | null) {
    return new OrphanCodeActionProvider(
        () => nearestToc,
        () => rootToc,
        () => true,
    );
}

describe('OrphanCodeActionProvider.provideCodeActions', () => {
    let provider: OrphanCodeActionProvider;

    beforeEach(() => {
        provider = makeProvider('/docs/toc.yaml', '/docs/toc.yaml');
        provider.update(new Set(['/docs/page.md']), new Set());
    });

    it('returns empty array when no orphan diagnostic', () => {
        const actions = provider.provideCodeActions(
            makeDocument('/docs/orphan.md'),
            {} as vscode.Range,
            makeContext(false),
        );

        expect(actions).toHaveLength(0);
    });

    it('returns empty array for referenced file', () => {
        const actions = provider.provideCodeActions(
            makeDocument('/docs/page.md'),
            {} as vscode.Range,
            makeContext(true),
        );

        expect(actions).toHaveLength(0);
    });

    it('returns 2 actions when nearest === root toc', () => {
        const actions = provider.provideCodeActions(
            makeDocument('/docs/orphan.md'),
            {} as vscode.Range,
            makeContext(true),
        );

        expect(actions).toHaveLength(2);
        expect(actions[0].title).toBe('Open toc.yaml');
        expect(actions[1].title).toBe('Add to toc.yaml');
    });

    it('returns 4 actions when nearest !== root toc', () => {
        const p = makeProvider('/docs/section/toc-common.yaml', '/docs/toc.yaml');
        p.update(new Set(), new Set());

        const actions = p.provideCodeActions(
            makeDocument('/docs/section/orphan.md'),
            {} as vscode.Range,
            makeContext(true),
        );

        expect(actions).toHaveLength(4);
        expect(actions[0].title).toBe('Open toc-common.yaml');
        expect(actions[1].title).toBe('Add to toc-common.yaml');
        expect(actions[2].title).toBe('Open toc.yaml (root)');
        expect(actions[3].title).toBe('Add to toc.yaml (root)');
    });

    it('add action has _tocPath and _orphanPath set', () => {
        const actions = provider.provideCodeActions(
            makeDocument('/docs/orphan.md'),
            {} as vscode.Range,
            makeContext(true),
        );

        const addAction = actions[1] as unknown as {
            _tocPath: string;
            _orphanPath: string;
        };

        expect(addAction._tocPath).toBe('/docs/toc.yaml');
        expect(addAction._orphanPath).toBe('/docs/orphan.md');
    });

    it('open action has openToc command with toc path', () => {
        const actions = provider.provideCodeActions(
            makeDocument('/docs/orphan.md'),
            {} as vscode.Range,
            makeContext(true),
        );

        expect(actions[0].command?.command).toBe('diplodoc.orphan.openToc');
        expect(actions[0].command?.arguments?.[0]).toBe('/docs/toc.yaml');
    });

    it('returns empty when no toc found', () => {
        const p = makeProvider(null, null);
        p.update(new Set(), new Set());

        const actions = p.provideCodeActions(
            makeDocument('/docs/orphan.md'),
            {} as vscode.Range,
            makeContext(true),
        );

        expect(actions).toHaveLength(0);
    });
});
