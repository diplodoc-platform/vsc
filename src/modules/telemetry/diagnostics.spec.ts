import type {TextDocument} from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {clearDiagnosticsTelemetry, reportDiagnostics, trackSavedDiagnostics} from './diagnostics';

import {sendEvent} from './index';

vi.mock('./index', () => ({sendEvent: vi.fn()}));

const document = () => ({version: 1, isClosed: false, isDirty: false}) as TextDocument;
const diagnostic = (severity: number) =>
    new vscode.Diagnostic(new vscode.Range(0, 0, 0, 5), 'private document text', severity);
const errors = [diagnostic(vscode.DiagnosticSeverity.Error)];

beforeEach(() => {
    clearDiagnosticsTelemetry();
    vi.clearAllMocks();
});

describe('saved document diagnostics telemetry', () => {
    it.each(['validation', 'links'] as const)(
        'waits for both sources when %s finishes first',
        (first) => {
            const doc = document();
            const second = first === 'validation' ? 'links' : 'validation';

            trackSavedDiagnostics(doc);
            reportDiagnostics(doc, 1, first, errors, 'toc');
            expect(sendEvent).not.toHaveBeenCalled();
            reportDiagnostics(
                doc,
                1,
                second,
                [
                    diagnostic(vscode.DiagnosticSeverity.Warning),
                    diagnostic(vscode.DiagnosticSeverity.Information),
                ],
                'toc',
            );
            expect(sendEvent).toHaveBeenCalledExactlyOnceWith(
                'validation/diagnostics',
                {fileType: 'toc'},
                {errors: 1, warnings: 1},
            );
        },
    );

    it('counts before display truncation and sends no diagnostic messages or locations', () => {
        const doc = document();

        trackSavedDiagnostics(doc);
        reportDiagnostics(
            doc,
            1,
            'validation',
            Array.from({length: 1200}, () => errors[0]),
            'yfm',
        );
        reportDiagnostics(doc, 1, 'links', []);
        expect(sendEvent).toHaveBeenCalledExactlyOnceWith(
            'validation/diagnostics',
            {fileType: 'yfm'},
            {errors: 1200, warnings: 0},
        );
    });

    it('does not report opening or editing and reports each saved version once, including clean files', () => {
        const doc = document();

        reportDiagnostics(doc, 1, 'validation', errors, 'md');
        reportDiagnostics(doc, 1, 'links', []);
        expect(sendEvent).not.toHaveBeenCalled();

        trackSavedDiagnostics(doc);
        reportDiagnostics(doc, 1, 'validation', errors, 'md');
        reportDiagnostics(doc, 1, 'links', []);
        trackSavedDiagnostics(doc);
        reportDiagnostics(doc, 1, 'validation', errors, 'md');
        reportDiagnostics(doc, 1, 'links', []);
        expect(sendEvent).toHaveBeenCalledTimes(1);

        Object.assign(doc, {version: 2});
        trackSavedDiagnostics(doc);
        reportDiagnostics(doc, 2, 'links', []);
        reportDiagnostics(doc, 2, 'validation', [], 'md');
        expect(sendEvent).toHaveBeenCalledTimes(2);
        expect(sendEvent).toHaveBeenLastCalledWith(
            'validation/diagnostics',
            {fileType: 'md'},
            {errors: 0, warnings: 0},
        );
    });

    it('does not mix late results with a newer saved version', () => {
        const doc = document();

        trackSavedDiagnostics(doc);
        reportDiagnostics(doc, 1, 'validation', errors, 'toc');
        Object.assign(doc, {version: 2});
        reportDiagnostics(doc, 1, 'links', errors);
        trackSavedDiagnostics(doc);
        reportDiagnostics(doc, 2, 'validation', [], 'toc');
        reportDiagnostics(doc, 1, 'links', errors);
        expect(sendEvent).not.toHaveBeenCalled();
        reportDiagnostics(doc, 2, 'links', []);
        expect(sendEvent).toHaveBeenCalledExactlyOnceWith(
            'validation/diagnostics',
            {fileType: 'toc'},
            {errors: 0, warnings: 0},
        );
    });

    it.each(['isClosed', 'isDirty'] as const)(
        'drops results when the saved document becomes %s',
        (flag) => {
            const doc = document();

            trackSavedDiagnostics(doc);
            reportDiagnostics(doc, 1, 'validation', errors, 'toc');
            Object.assign(doc, {[flag]: true});
            reportDiagnostics(doc, 1, 'links', []);
            expect(sendEvent).not.toHaveBeenCalled();
        },
    );

    it('discards pending results on document close and extension disposal', () => {
        for (const all of [false, true]) {
            const doc = document();

            trackSavedDiagnostics(doc);
            reportDiagnostics(doc, 1, 'validation', errors, 'toc');
            clearDiagnosticsTelemetry(all ? undefined : doc);
            reportDiagnostics(doc, 1, 'links', []);
        }

        expect(sendEvent).not.toHaveBeenCalled();
    });
});
