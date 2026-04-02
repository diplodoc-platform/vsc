import * as path from 'path';
import * as vscode from 'vscode';
import { LogLevels, yfmlint } from '@diplodoc/yfmlint';

// Transform plugins enable the full rule set (YFM002-YFM011):
// without them, only YFM001 (inline code length) fires because the other
// rules depend on token attributes set by transform plugins in isLintRun mode.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const transformPlugins: unknown[] = require('@diplodoc/transform/lib/plugins');

export async function validateMarkdown(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    const content = document.getText();
    const filePath = document.fileName;
    const root = resolveRoot(filePath);

    const errors = await yfmlint(content, filePath, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plugins: transformPlugins as any[],
        pluginOptions: {
            path: filePath,
            root,
        },
    });

    if (!errors?.length) {
        return [];
    }

    return errors.map((err) => {
        const line = Math.max(0, (err.lineNumber ?? 1) - 1);
        const col = err.errorRange ? err.errorRange[0] - 1 : 0;
        const len = err.errorRange?.[1] ?? 0;
        const lineText = document.lineAt(line).text;
        const endCol = len > 0 ? col + len : lineText.length;

        const severity =
            err.level === LogLevels.ERROR
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning;

        const parts: string[] = [err.ruleDescription];
        if (err.errorDetail) parts.push(`[${err.errorDetail}]`);
        if (err.errorContext) parts.push(`[Context: "${err.errorContext}"]`);

        const diag = new vscode.Diagnostic(
            new vscode.Range(line, col, line, endCol),
            parts.join(' '),
            severity,
        );
        diag.code = err.ruleNames[0];
        diag.source = 'diplodoc';
        return diag;
    });
}

/**
 * Find the workspace root for the given file path.
 * Used by transform plugins to resolve relative links (YFM003).
 * Falls back to the file's own directory if no workspace folder contains it.
 */
function resolveRoot(filePath: string): string {
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    return folder?.uri.fsPath ?? path.dirname(filePath);
}
