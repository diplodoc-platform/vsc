import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {insertNote, insertTable, openMdEditor, openTocEditor} from './commands';
import {insertElement} from './utils';

vi.mock('vscode', () => ({
    window: {
        activeTextEditor: undefined,
    },
}));

vi.mock('./utils', () => ({
    insertElement: vi.fn(),
}));

type MockEditor = {
    document: {
        languageId: string;
        fileName: string;
    };
    selection: {
        active: {line: number; character: number};
    };
    edit: ReturnType<typeof vi.fn>;
};

describe('commands', () => {
    let activeEditor: MockEditor;

    beforeEach(() => {
        vi.clearAllMocks();

        activeEditor = {
            document: {
                languageId: 'markdown',
                fileName: 'test.md',
            },
            selection: {
                active: {line: 0, character: 0},
            },
            edit: vi.fn(),
        };

        vscode.window.activeTextEditor = activeEditor as never;
    });

    describe('openMdEditor', () => {
        it('opens markdown editor for markdown files', () => {
            const mdEditor = {
                show: vi.fn(),
                syncFromEditor: vi.fn(),
            };

            openMdEditor(mdEditor as never);

            expect(mdEditor.show).toHaveBeenCalledOnce();
            expect(mdEditor.syncFromEditor).toHaveBeenCalledWith(activeEditor);
        });

        it('does nothing without active editor', () => {
            vscode.window.activeTextEditor = undefined;
            const mdEditor = {
                show: vi.fn(),
                syncFromEditor: vi.fn(),
            };

            openMdEditor(mdEditor as never);

            expect(mdEditor.show).not.toHaveBeenCalled();
            expect(mdEditor.syncFromEditor).not.toHaveBeenCalled();
        });

        it('does nothing for non-markdown files', () => {
            activeEditor.document.languageId = 'plaintext';
            const mdEditor = {
                show: vi.fn(),
                syncFromEditor: vi.fn(),
            };

            openMdEditor(mdEditor as never);

            expect(mdEditor.show).not.toHaveBeenCalled();
            expect(mdEditor.syncFromEditor).not.toHaveBeenCalled();
        });
    });

    describe('openTocEditor', () => {
        it('opens toc editor for non-toc files', () => {
            const tocEditor = {
                show: vi.fn(),
                syncFromEditor: vi.fn(),
            };

            openTocEditor(tocEditor as never);

            expect(tocEditor.show).toHaveBeenCalledOnce();
            expect(tocEditor.syncFromEditor).toHaveBeenCalledWith(activeEditor);
        });

        it('does nothing without active editor', () => {
            vscode.window.activeTextEditor = undefined;
            const tocEditor = {
                show: vi.fn(),
                syncFromEditor: vi.fn(),
            };

            openTocEditor(tocEditor as never);

            expect(tocEditor.show).not.toHaveBeenCalled();
            expect(tocEditor.syncFromEditor).not.toHaveBeenCalled();
        });

        it('does nothing for toc.yaml', () => {
            activeEditor.document.fileName = 'toc.yaml';
            const tocEditor = {
                show: vi.fn(),
                syncFromEditor: vi.fn(),
            };

            openTocEditor(tocEditor as never);

            expect(tocEditor.show).not.toHaveBeenCalled();
            expect(tocEditor.syncFromEditor).not.toHaveBeenCalled();
        });
    });

    describe('insertTable', () => {
        it('inserts table snippet into markdown files', () => {
            const snippet = '| a | b |';
            vi.mocked(insertElement).mockReturnValue(snippet);

            insertTable();

            expect(activeEditor.edit).toHaveBeenCalledOnce();

            const editBuilder = {insert: vi.fn()};
            const callback = vi.mocked(activeEditor.edit).mock.calls[0][0];
            callback(editBuilder);

            expect(insertElement).toHaveBeenCalledWith('table');
            expect(editBuilder.insert).toHaveBeenCalledWith(activeEditor.selection.active, snippet);
        });

        it('does nothing for non-markdown files', () => {
            activeEditor.document.languageId = 'plaintext';

            insertTable();

            expect(insertElement).not.toHaveBeenCalled();
            expect(activeEditor.edit).not.toHaveBeenCalled();
        });
    });

    describe('insertNote', () => {
        it('inserts note snippet into markdown files', () => {
            const snippet = '{% note info "Title" %}';
            vi.mocked(insertElement).mockReturnValue(snippet);

            insertNote();

            expect(activeEditor.edit).toHaveBeenCalledOnce();

            const editBuilder = {insert: vi.fn()};
            const callback = vi.mocked(activeEditor.edit).mock.calls[0][0];
            callback(editBuilder);

            expect(insertElement).toHaveBeenCalledWith('note');
            expect(editBuilder.insert).toHaveBeenCalledWith(activeEditor.selection.active, snippet);
        });

        it('does nothing for non-markdown files', () => {
            activeEditor.document.languageId = 'plaintext';

            insertNote();

            expect(insertElement).not.toHaveBeenCalled();
            expect(activeEditor.edit).not.toHaveBeenCalled();
        });
    });
});
