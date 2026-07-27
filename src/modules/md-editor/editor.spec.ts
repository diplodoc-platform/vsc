import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {MdEditor} from './editor';

vi.mock('../telemetry', () => ({
    sendEvent: vi.fn(),
    sendException: vi.fn(),
}));

vi.mock('../../utils', () => ({
    isBlocksYaml: () => false,
    wrapPageConstructor: (t: string) => t,
    unwrapPageConstructor: (t: string) => t,
}));

vi.mock('../utils', () => ({
    getVscConfig: (_name: string, def: unknown) => def,
}));

vi.mock('vscode', () => ({
    Range: class {
        start: unknown;
        end: unknown;
        constructor(start: unknown, end: unknown) {
            this.start = start;
            this.end = end;
        }
    },
    Uri: {
        file: (s: string) => ({toString: () => s, fsPath: s}),
        joinPath: (...parts: Array<{toString: () => string} | string>) => {
            const str = parts.map((p) => (typeof p === 'string' ? p : p.toString())).join('/');
            return {toString: () => str, fsPath: str};
        },
    },
    workspace: {
        openTextDocument: vi.fn(),
        applyEdit: vi.fn().mockResolvedValue(true),
    },
    WorkspaceEdit: class {
        replace = vi.fn();
    },
}));

interface WebviewLike {
    postMessage?(msg: unknown): void;
    asWebviewUri?(uri: {toString(): string}): {toString(): string};
}

interface EditorInternals {
    _currentDocUri: vscode.Uri | undefined;
    _pendingSync: {text: string; fileName: string; imageDirUri?: string} | undefined;
    _panel: {webview: WebviewLike} | undefined;
    _extraSetContentFields(): Record<string, unknown>;
    _onShowFileContent(content: string, fileName: string, isNewPanel: boolean): void;
    _onWebviewMessage(message: Record<string, unknown>): Promise<void>;
}

function makeEditor() {
    return new MdEditor(vscode.Uri.file('/ext') as unknown as vscode.Uri);
}

function access(editor: MdEditor): EditorInternals {
    return editor as unknown as EditorInternals;
}

describe('MdEditor._extraSetContentFields', () => {
    it('returns {} when _currentDocUri is not set', () => {
        const editor = makeEditor();

        expect(access(editor)._extraSetContentFields()).toEqual({});
    });

    it('returns {} when _panel is not set', () => {
        const editor = makeEditor();
        access(editor)._currentDocUri = vscode.Uri.file('/doc.md');

        expect(access(editor)._extraSetContentFields()).toEqual({});
    });

    it('returns imageDirUri when both _currentDocUri and _panel are set', () => {
        const editor = makeEditor();
        access(editor)._currentDocUri = vscode.Uri.file('/work/doc.md');
        access(editor)._panel = {
            webview: {
                asWebviewUri: (uri: {toString: () => string}) => ({
                    toString: () => `vscode-webview://${uri.toString()}`,
                }),
            },
        };

        const fields = access(editor)._extraSetContentFields();

        expect(fields).toHaveProperty('imageDirUri');
        expect(typeof fields.imageDirUri).toBe('string');
    });
});

describe('MdEditor._onShowFileContent', () => {
    let postMessage: (msg: unknown) => void;

    beforeEach(() => {
        vi.clearAllMocks();
        postMessage = vi.fn() as unknown as (msg: unknown) => void;
    });

    it('stores content in _pendingSync when isNewPanel=true', () => {
        const editor = makeEditor();
        access(editor)._currentDocUri = undefined;
        access(editor)._panel = {webview: {postMessage}};

        access(editor)._onShowFileContent('text', 'file.md', true);

        expect(access(editor)._pendingSync).toMatchObject({text: 'text', fileName: 'file.md'});
        expect(postMessage).not.toHaveBeenCalled();
    });

    it('posts setContent message when isNewPanel=false', () => {
        const editor = makeEditor();
        access(editor)._currentDocUri = undefined;
        access(editor)._panel = {webview: {postMessage}};

        access(editor)._onShowFileContent('text', 'file.md', false);

        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({command: 'setContent', text: 'text', fileName: 'file.md'}),
        );
    });
});

describe('MdEditor._onWebviewMessage', () => {
    let save: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        save = vi.fn().mockResolvedValue(true);
        const document = {
            getText: () => 'original content\n',
            positionAt: (offset: number) => ({line: 0, character: offset}),
            save,
        };
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(
            document as unknown as vscode.TextDocument,
        );
    });

    it('writes to the document on a change message', async () => {
        const editor = makeEditor();
        access(editor)._currentDocUri = vscode.Uri.file('/doc.md') as unknown as vscode.Uri;

        await access(editor)._onWebviewMessage({command: 'change', text: 'normalized'});

        expect(vscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
    });

    it('writes to the document and saves on a save message', async () => {
        const editor = makeEditor();
        access(editor)._currentDocUri = vscode.Uri.file('/doc.md') as unknown as vscode.Uri;

        await access(editor)._onWebviewMessage({command: 'save', text: 'normalized'});

        expect(vscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledTimes(1);
    });
});
