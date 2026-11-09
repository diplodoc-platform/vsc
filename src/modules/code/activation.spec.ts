import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {logger} from '../utils';

import {activate} from './index';

vi.mock('../utils', () => ({
    findYfmRoot: () => '/docs',
    isInExcludedDir: () => false,
    logger: vi.fn(),
}));

vi.mock('vscode', () => ({
    languages: {
        createDiagnosticCollection: vi.fn(() => ({
            set: vi.fn(),
            delete: vi.fn(),
            dispose: vi.fn(),
        })),
        registerDocumentLinkProvider: vi.fn(() => ({dispose: vi.fn()})),
        registerCompletionItemProvider: vi.fn(() => ({dispose: vi.fn()})),
    },
    workspace: {
        textDocuments: [],
        onDidOpenTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidSaveTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidChangeTextDocument: vi.fn(() => ({dispose: vi.fn()})),
        onDidCloseTextDocument: vi.fn(() => ({dispose: vi.fn()})),
    },
}));

describe('code validation activation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
