import * as vscode from 'vscode';
import {PluginMessage, ValidationMessage, YfmLintError} from '../types';

export function toDiagnostics(errors: ValidationMessage[], document: vscode.TextDocument): vscode.Diagnostic[] {
    return errors.map((error) => toDiagnostic(error, document));
}

export function toDiagnostic(error: ValidationMessage, document: vscode.TextDocument): vscode.Diagnostic {
    return isYfmLintError(error) ? toLintDiagnostic(error, document) : toPluginDiagnostic(error, document);
}

export function toLintDiagnostic(error: YfmLintError, document: vscode.TextDocument): vscode.Diagnostic {
    const range = getLintRange(error, document);
    const diagnostic = new vscode.Diagnostic(range, formatLintMessage(error), getSeverity(error));

    diagnostic.source = 'Diplodoc';
    diagnostic.code = error.ruleNames?.[0];

    return diagnostic;
}

export function toPluginDiagnostic(error: PluginMessage, document: vscode.TextDocument): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(
        getPluginRange(error, document),
        formatPluginMessage(error),
        getSeverity(error),
    );

    diagnostic.source = 'Diplodoc';

    return diagnostic;
}

export function formatLintMessage(error: YfmLintError): string {
    const rule = error.ruleNames?.[0] ?? 'YFM';
    const parts = [`Diplodoc ${rule}: ${error.ruleDescription}`];

    if (error.errorDetail) {
        parts.push(error.errorDetail);
    }

    if (error.errorContext) {
        parts.push(`Context: ${error.errorContext}`);
    }

    return parts.join('\n');
}

export function formatPluginMessage(error: PluginMessage): string {
    return `Diplodoc: ${stripAnsi(error.message)}`;
}

function getSeverity(error: YfmLintError | PluginMessage): vscode.DiagnosticSeverity {
    switch (error.level) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        case 'warn':
        default:
            return vscode.DiagnosticSeverity.Warning;
    }
}

function getLintRange(error: YfmLintError, document: vscode.TextDocument): vscode.Range {
    const line = Math.max(0, Math.min((error.lineNumber ?? 1) - 1, document.lineCount - 1));
    const lineText = document.lineAt(line).text;
    const start = Math.max(0, (error.errorRange?.[0] ?? 1) - 1);
    const fallbackEnd = lineText.length > start ? lineText.length : start + 1;
    const end = error.errorRange?.[1] ? start + error.errorRange[1] : fallbackEnd;

    return new vscode.Range(line, start, line, Math.max(start + 1, end));
}

function getPluginRange(error: PluginMessage, document: vscode.TextDocument): vscode.Range {
    const message = stripAnsi(error.message);

    if (message.startsWith('Link is unreachable: ')) {
        return findLinkRange(message, document);
    }

    if (message.startsWith('Title not found: ')) {
        return findLinkRange(message, document);
    }

    if (message.startsWith('Asset not found: ') || message.startsWith('SVG ')) {
        return findAssetRange(message, document);
    }

    if (message.startsWith('No such file or has no access to ')) {
        return findIncludeRange(message, document);
    }

    if (message.startsWith('Note must be closed')) {
        return findDirectiveRange(document, /^\s*{%\s*note\b/, /^\s*{%\s*endnote\s*%}/);
    }

    if (message.startsWith('Cut must be closed')) {
        return findDirectiveRange(document, /^\s*{%\s*cut\b/, /^\s*{%\s*endcut\s*%}/);
    }

    if (message.startsWith('Changelog block must be closed') || message.startsWith('Changelog close tag in not found')) {
        return findDirectiveRange(document, /^\s*{%\s*changelog\b/, /^\s*{%\s*endchangelog\s*%}/);
    }

    if (message.startsWith('Empty link in ')) {
        return findRegexRange(document, /\[[^\]]*]\(\)/);
    }

    if (message.startsWith('Circular includes: ')) {
        return findDirectiveRange(document, /^\s*{%\s*include\b/, /^$/);
    }

    return fullLineRange(0, document);
}

function findLinkRange(message: string, document: vscode.TextDocument): vscode.Range {
    const match = /^(?:Link is unreachable|Title not found): (.+?) in /.exec(message);

    if (!match) {
        return fullLineRange(0, document);
    }

    const href = stripAnsi(match[1]);

    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;
        const hrefIndex = lineText.indexOf(href);

        if (hrefIndex >= 0) {
            return new vscode.Range(line, hrefIndex, line, hrefIndex + href.length);
        }
    }

    return fullLineRange(0, document);
}

function findAssetRange(message: string, document: vscode.TextDocument): vscode.Range {
    const assetMatch = /^Asset not found: (.+?) in /.exec(message);
    const svgMatch = /^SVG (.+?) from (.+?) not found$/.exec(message);
    const assetPath = assetMatch?.[1] ?? svgMatch?.[1];
    const fromPath = svgMatch?.[2];

    if (assetPath) {
        const range = findTextRange(document, assetPath);

        if (range) {
            return range;
        }
    }

    if (fromPath) {
        const range = findTextRange(document, fromPath);

        if (range) {
            return range;
        }
    }

    return fullLineRange(0, document);
}

function findIncludeRange(message: string, document: vscode.TextDocument): vscode.Range {
    const match = /^No such file or has no access to (.+?) in /.exec(message);

    if (!match) {
        return fullLineRange(0, document);
    }

    return findTextRange(document, match[1]) ?? findDirectiveRange(document, /^\s*{%\s*include\b/, /^$/);
}

function findDirectiveRange(
    document: vscode.TextDocument,
    openPattern: RegExp,
    closePattern: RegExp,
): vscode.Range {
    const stack: number[] = [];

    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;

        if (openPattern.test(lineText)) {
            stack.push(line);
            continue;
        }

        if (closePattern.test(lineText)) {
            stack.pop();
        }
    }

    if (stack.length > 0) {
        return fullLineRange(stack[stack.length - 1], document);
    }

    for (let line = 0; line < document.lineCount; line++) {
        if (openPattern.test(document.lineAt(line).text)) {
            return fullLineRange(line, document);
        }
    }

    return fullLineRange(0, document);
}

function findTextRange(document: vscode.TextDocument, text: string): vscode.Range | undefined {
    const needle = stripAnsi(text);

    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;
        const start = lineText.indexOf(needle);

        if (start >= 0) {
            return new vscode.Range(line, start, line, start + needle.length);
        }
    }

    return undefined;
}

function findRegexRange(document: vscode.TextDocument, pattern: RegExp): vscode.Range {
    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;
        const match = pattern.exec(lineText);

        if (match) {
            return new vscode.Range(line, match.index, line, match.index + match[0].length);
        }
    }

    return fullLineRange(0, document);
}

function fullLineRange(line: number, document: vscode.TextDocument): vscode.Range {
    const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
    const lineText = document.lineAt(safeLine).text;
    const end = lineText.length > 0 ? lineText.length : 1;

    return new vscode.Range(safeLine, 0, safeLine, end);
}

function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function isYfmLintError(error: ValidationMessage): error is YfmLintError {
    return 'ruleDescription' in error;
}
