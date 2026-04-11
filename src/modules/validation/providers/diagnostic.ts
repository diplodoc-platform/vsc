import * as vscode from 'vscode';
import {Diagnostic as LspDiagnostic, DiagnosticSeverity as LspSeverity} from 'vscode-languageserver-types';
import {getConfiguredService, createVirtualDocument, SchemaType} from './yaml-service';
import {toVscodeRange} from './position';
import {Content} from '../../types';

const TYPE_MISMATCH_RE = /^Incorrect type\./;
const MISSING_PROPERTY_RE = /^Missing property/;

function diagnosticSeverity(d: LspDiagnostic): vscode.DiagnosticSeverity {
    if (TYPE_MISMATCH_RE.test(d.message) || MISSING_PROPERTY_RE.test(d.message)) {
        return vscode.DiagnosticSeverity.Error;
    }

    switch (d.severity) {
        case LspSeverity.Error:
            return vscode.DiagnosticSeverity.Error;
        case LspSeverity.Warning:
            return vscode.DiagnosticSeverity.Warning;
        case LspSeverity.Information:
            return vscode.DiagnosticSeverity.Information;
        case LspSeverity.Hint:
            return vscode.DiagnosticSeverity.Hint;
        default:
            return vscode.DiagnosticSeverity.Warning;
    }
}

export async function getDiagnostics(
    content: Content,
    schemaType: SchemaType,
): Promise<vscode.Diagnostic[]> {
    if (!content.content.trim()) {
        return [];
    }

    const ls = getConfiguredService();
    const doc = createVirtualDocument(content.content, schemaType);
    const lspDiags = await ls.doValidation(doc, false);

    return lspDiags.map(d => {
        const range = toVscodeRange(d.range, content.startLine);
        return new vscode.Diagnostic(range, d.message, diagnosticSeverity(d));
    });
}
