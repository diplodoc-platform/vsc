import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel('Diplodoc');

export function logger(message: unknown) {
    output.appendLine(JSON.stringify(message));
}
