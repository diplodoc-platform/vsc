import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {isFileExcluded, isYfmFile, logger} from '../utils';

import {activate} from './index';

const settings = vi.hoisted(() => ({isOnlyYFM: false, excludedFiles: [] as string[]}));
const collection = vi.hoisted(() => ({set: vi.fn(), delete: vi.fn(), dispose: vi.fn()}));

vi.mock('../utils', () => ({
    findYfmRoot: () => '/docs',
    isInExcludedDir: () => false,
    getVscConfig: (name: string, fallback: unknown) => {
        if (name === 'isOnlyYFM') {
            return settings.isOnlyYFM;
        }

        return name === 'excludedFiles' ? settings.excludedFiles : fallback;
    },
    isFileExcluded: vi.fn(() => false),
    isYfmFile: vi.fn(() => true),
    logger: vi.fn(),
}));

vi.mock('vscode', () => ({
    languages: {
        createDiagnosticCollection: vi.fn(() => collection),
        registerDocumentLinkProvider: vi.fn(() => ({dispose: vi.fn()})),
        registerCompletionItemProvider: vi.fn(() => ({dispose: vi.fn()})),
    },
    workspace: {
        textDocuments: [],
        onDidOpenTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidSaveTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidChangeTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidCloseTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidChangeConfiguration: vi.fn(() => ({dispose: vi.fn()})),
    },
}));

function openDocument(text = '# Page', fileName = '/docs/page.md'): vscode.TextDocument {
    const document = {
        languageId: 'markdown',
        uri: {scheme: 'file', fsPath: fileName, toString: () => fileName},
        fileName,
        version: 1,
        getText: vi.fn(() => text),
    } as unknown as vscode.TextDocument;
    (vscode.workspace.textDocuments as vscode.TextDocument[]).push(document);
    activate({subscriptions: []} as unknown as vscode.ExtensionContext);

    return document;
}

function changeConfiguration(relevant = true) {
    const listener = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls[0]?.[0];
    expect(listener).toBeDefined();
    listener?.({affectsConfiguration: () => relevant});
}

async function flushValidation() {
    await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('code validation activation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        settings.isOnlyYFM = false;
        settings.excludedFiles = [];
        vi.mocked(isFileExcluded).mockReturnValue(false);
        vi.mocked(isYfmFile).mockReturnValue(true);
    });

    afterEach(() => {
        (vscode.workspace.textDocuments as vscode.TextDocument[]).length = 0;
    });

    it('does not validate files matched by excludedFiles', async () => {
        settings.excludedFiles = ['README.md'];
        vi.mocked(isFileExcluded).mockReturnValue(true);
        const document = openDocument('{% code missing.ts %}', '/docs/README.md');
        await flushValidation();

        expect(isFileExcluded).toHaveBeenCalledWith(document.fileName, ['README.md']);
        expect(document.getText).not.toHaveBeenCalled();
        expect(collection.delete).toHaveBeenCalledWith(document.uri);
        expect(collection.set).not.toHaveBeenCalled();
        expect(logger).not.toHaveBeenCalled();
    });

    it('does not validate outside a project when isOnlyYFM is enabled', async () => {
        settings.isOnlyYFM = true;
        vi.mocked(isYfmFile).mockReturnValue(false);
        const document = openDocument('{% code missing.ts %}', '/outside/page.md');
        await flushValidation();

        expect(isYfmFile).toHaveBeenCalledWith(document.uri.fsPath);
        expect(document.getText).not.toHaveBeenCalled();
        expect(logger).not.toHaveBeenCalled();
    });

    it('validates an included file inside a project', async () => {
        settings.isOnlyYFM = true;
        const document = openDocument();
        await flushValidation();

        expect(document.getText).toHaveBeenCalledOnce();
        expect(collection.set).toHaveBeenCalledWith(document.uri, []);
    });

    it('clears diagnostics on exclusion and validates again on inclusion', async () => {
        const document = openDocument();
        await flushValidation();
        expect(collection.set).toHaveBeenCalledWith(document.uri, []);
        collection.set.mockClear();
        vi.mocked(isFileExcluded).mockReturnValue(true);
        changeConfiguration();
        await flushValidation();

        expect(collection.delete).toHaveBeenCalledWith(document.uri);
        expect(collection.set).not.toHaveBeenCalled();

        vi.mocked(isFileExcluded).mockReturnValue(false);
        changeConfiguration();
        await flushValidation();
        expect(collection.set).toHaveBeenCalledWith(document.uri, []);
    });

    it('discards an in-flight result after settings change', async () => {
        openDocument();
        settings.isOnlyYFM = true;
        vi.mocked(isYfmFile).mockReturnValue(false);
        changeConfiguration();
        await flushValidation();

        expect(collection.set).not.toHaveBeenCalled();
    });

    it('does not revalidate for unrelated configuration changes', async () => {
        const document = openDocument();
        await flushValidation();
        vi.mocked(document.getText).mockClear();
        changeConfiguration(false);
        await flushValidation();

        expect(document.getText).not.toHaveBeenCalled();
    });

    it('handles validation failures for initially open documents', async () => {
        const document = {
            languageId: 'markdown',
            uri: {scheme: 'file', fsPath: '/docs/page.md'},
            version: 1,
            getText: () => {
                throw new Error('document unavailable');
            },
        } as unknown as vscode.TextDocument;
        const documents = vscode.workspace.textDocuments as vscode.TextDocument[];
        documents.push(document);

        try {
            activate({subscriptions: []} as unknown as vscode.ExtensionContext);
            await new Promise<void>((resolve) => setImmediate(resolve));

            expect(logger).toHaveBeenCalledWith({
                message: 'Code directive validation failed',
                error: 'Error: document unavailable',
            });
        } finally {
            documents.pop();
        }
    });
});
