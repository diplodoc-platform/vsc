import type {Diagnostic, TextDocument} from 'vscode';

import {DiagnosticSeverity} from 'vscode';

import {EVENTS} from './constants';

import {sendEvent} from './index';

type Summary = {errors: number; warnings: number; fileType: string};
type SavedDiagnostics = {
    version: number;
    reported: boolean;
    validation?: Summary;
    links?: Summary;
};

const saved = new Map<TextDocument, SavedDiagnostics>();

export function trackSavedDiagnostics(document: TextDocument): void {
    if (saved.get(document)?.version !== document.version) {
        saved.set(document, {version: document.version, reported: false});
    }
}

export function reportDiagnostics(
    document: TextDocument,
    version: number,
    source: 'validation' | 'links',
    diagnostics: readonly Diagnostic[],
    fileType = 'yaml',
): void {
    const state = saved.get(document);

    if (
        !state ||
        state.reported ||
        state.version !== version ||
        document.version !== version ||
        document.isClosed ||
        document.isDirty
    ) {
        return;
    }

    state[source] = {
        errors: diagnostics.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error)
            .length,
        warnings: diagnostics.filter(
            (diagnostic) => diagnostic.severity === DiagnosticSeverity.Warning,
        ).length,
        fileType,
    };

    if (!state.validation || !state.links) {
        return;
    }

    state.reported = true;
    sendEvent(
        EVENTS.VALIDATION_DIAGNOSTICS,
        {fileType: state.validation.fileType},
        {
            errors: state.validation.errors + state.links.errors,
            warnings: state.validation.warnings + state.links.warnings,
        },
    );
}

export function clearDiagnosticsTelemetry(document?: TextDocument): void {
    if (document) {
        saved.delete(document);
    } else {
        saved.clear();
    }
}
