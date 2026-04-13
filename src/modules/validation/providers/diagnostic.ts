import type {Diagnostic as LspDiagnostic} from 'vscode-languageserver-types';
import type {SchemaType} from './yaml-service';
import type {Content} from '../types';

import * as vscode from 'vscode';
import {DiagnosticSeverity as LspSeverity} from 'vscode-languageserver-types';

import {createVirtualDocument, getConfiguredService} from './yaml-service';
import {toVscodeRange} from './position';

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

    return lspDiags.map((d) => {
        const range = toVscodeRange(d.range, content.startLine);
        return new vscode.Diagnostic(range, d.message, diagnosticSeverity(d));
    });
}
