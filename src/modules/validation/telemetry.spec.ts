import type {DiagnosticCollection, ExtensionContext, TextDocument} from 'vscode';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {validateLinks, validateMarkdownFileAnchors} from '../links/diagnostics';
import {sendEvent} from '../telemetry';

import {activate, deactivate} from './index';

vi.mock('../telemetry', () => ({sendEvent: vi.fn(), sendError: vi.fn(), sendException: vi.fn()}));
vi.mock('../utils', () => ({
    getVscConfig: (_key: string, fallback: unknown) => fallback,
    isFileExcluded: () => false,
    isInExcludedDir: () => false,
    isYfmFile: () => true,
    findYfmRoot: () => '/docs',
    logger: vi.fn(),
}));
vi.mock('../shared/ya-make', () => ({getYaMakeDests: () => new Map()}));
vi.mock('./markdown', () => ({
    validateMarkdown: async () => [
        new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'private lint error', 0),
    ],
}));

const saveListeners: Array<(document: TextDocument) => void> = [];
const disposable = () => ({dispose() {}});
const collection = () =>
    ({set: vi.fn(), delete: vi.fn(), dispose() {}}) as unknown as DiagnosticCollection;
let diagnostics: DiagnosticCollection;

const document = (name: string, text: string, languageId = 'yaml') =>
    ({
        uri: {...vscode.Uri.file(`/docs/${name}`), scheme: 'file'},
        fileName: `/docs/${name}`,
        languageId,
        version: 1,
        isClosed: false,
        isDirty: false,
        lineCount: text.split('\n').length,
        lineAt: (index: number) => ({text: text.split('\n')[index], lineNumber: index}),
        getText: () => text,
    }) as unknown as TextDocument;

beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    saveListeners.length = 0;
    diagnostics = collection();
    const api = await vi.importMock<typeof vscode>('vscode');

    Object.assign(api, {
        languages: {
            createDiagnosticCollection: () => diagnostics,
            registerHoverProvider: disposable,
            registerCompletionItemProvider: disposable,
        },
    });
    Object.assign(vscode.window, {onDidChangeActiveTextEditor: disposable});
    Object.assign(vscode.workspace, {
        textDocuments: [],
        createFileSystemWatcher: () => ({
            dispose() {},
            onDidChange: disposable,
            onDidCreate: disposable,
            onDidDelete: disposable,
        }),
        onDidOpenTextDocument: disposable,
        onDidSaveTextDocument: (listener: (document: TextDocument) => void) => {
            saveListeners.push(listener);

            return disposable();
        },
        onDidChangeTextDocument: disposable,
        onDidCloseTextDocument: disposable,
    });
    vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('missing'));
    activate({subscriptions: []} as unknown as ExtensionContext);
});

afterEach(() => {
    deactivate();
    vi.useRealTimers();
});

describe('validation telemetry integration', () => {
    it.each([
        ['toc.yaml', 'items: false', 'toc', 1],
        ['.yfm', '[', 'yfm', 2],
        ['toc.yaml', 'items:\n  - name: Page\n    href: missing.md', 'toc', 1],
        ['other.yaml', 'key: value', 'yaml', 0],
    ])('reports saved %s after schema and link checks', async (name, text, fileType, errors) => {
        const doc = document(String(name), String(text));

        saveListeners.forEach((listener) => listener(doc));
        await validateLinks(doc, collection());
        expect(sendEvent).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(sendEvent).toHaveBeenCalledExactlyOnceWith(
            'validation/diagnostics',
            {fileType},
            {errors, warnings: 0},
        );
    });

    it('includes Markdown lint results and anchor diagnostics in one saved event', async () => {
        const doc = document('page.md', '# Page\n\n[Missing](#absent)', 'markdown');

        saveListeners.forEach((listener) => listener(doc));
        await validateMarkdownFileAnchors(doc, collection());
        await vi.advanceTimersByTimeAsync(1000);
        expect(sendEvent).toHaveBeenCalledExactlyOnceWith(
            'validation/diagnostics',
            {fileType: 'md'},
            {errors: 1, warnings: 1},
        );
        expect(diagnostics.set).toHaveBeenCalledWith(doc.uri, [
            expect.objectContaining({severity: 0}),
        ]);
    });
});
