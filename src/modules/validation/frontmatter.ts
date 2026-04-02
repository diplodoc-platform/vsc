import * as vscode from 'vscode';
import Ajv, { ErrorObject } from 'ajv';
import { FRONTMATTER_SCHEMA, KNOWN_FIELDS, parseFrontmatterBlock } from './schema';

// extractFrontMatter handles Liquid syntax inside YAML (e.g. `key: {{ var }}`),
// which plain js-yaml would choke on. Returns [parsedObject, strippedContent].
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractFrontMatter } = require('@diplodoc/transform/lib/frontmatter') as {
    extractFrontMatter: (text: string) => [Record<string, unknown>, string];
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(FRONTMATTER_SCHEMA);

export function validateFrontmatter(document: vscode.TextDocument): vscode.Diagnostic[] {
    const text = document.getText();
    const block = parseFrontmatterBlock(text);
    if (!block) return [];

    let parsed: Record<string, unknown>;
    try {
        const result = extractFrontMatter(text);
        parsed = result[0];
    } catch (e: unknown) {
        return [yamlParseError(e, block.bodyLine, document)];
    }

    if (!parsed || !Object.keys(parsed).length) return [];

    const diags: vscode.Diagnostic[] = [];

    // Unknown fields — ajv won't catch these because additionalProperties: true
    for (const key of Object.keys(parsed)) {
        if (!KNOWN_FIELDS.has(key)) {
            const line = findKeyLine(key, block.rawYaml, block.bodyLine);
            const lineText = document.lineAt(line).text;
            diags.push(new vscode.Diagnostic(
                new vscode.Range(line, 0, line, lineText.length),
                `Frontmatter: unknown field '${key}'`,
                vscode.DiagnosticSeverity.Warning,
            ));
        }
    }

    // Schema validation
    validateSchema(parsed);
    for (const err of validateSchema.errors ?? []) {
        const line = findErrorLine(err, block.rawYaml, block.bodyLine);
        const lineText = document.lineAt(line).text;
        diags.push(new vscode.Diagnostic(
            new vscode.Range(line, 0, line, lineText.length),
            formatAjvError(err),
            vscode.DiagnosticSeverity.Warning,
        ));
    }

    return diags;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findKeyLine(key: string, rawYaml: string, bodyStart: number): number {
    const lines = rawYaml.split('\n');
    const idx = lines.findIndex(l => {
        const t = l.trimStart();
        return t === `${key}:` || t.startsWith(`${key}: `) || t.startsWith(`${key}:`);
    });
    return idx >= 0 ? bodyStart + idx : bodyStart;
}

function findErrorLine(err: ErrorObject, rawYaml: string, bodyStart: number): number {
    // For additionalProperties, point directly to the unknown sub-field line
    if (err.keyword === 'additionalProperties') {
        const prop = (err.params as { additionalProperty?: string }).additionalProperty;
        if (prop) return findKeyLine(prop, rawYaml, bodyStart);
    }
    const topKey = err.instancePath.split('/').filter(Boolean)[0];
    return topKey ? findKeyLine(topKey, rawYaml, bodyStart) : bodyStart;
}

function formatAjvError(err: ErrorObject): string {
    const path = err.instancePath ? `'${err.instancePath.replace(/^\//, '').replace(/\//g, '.')}'` : 'Frontmatter';

    if (err.keyword === 'additionalProperties') {
        const prop = (err.params as { additionalProperty?: string }).additionalProperty ?? '';
        const parent = err.instancePath ? err.instancePath.replace(/^\//, '').replace(/\//g, '.') : '';
        return `Frontmatter: unknown field '${prop}'${parent ? ` in '${parent}'` : ''}`;
    }
    if (err.keyword === 'enum') {
        const allowed = (err.params as { allowedValues?: unknown[] }).allowedValues ?? [];
        return `Frontmatter: ${path} must be one of: ${allowed.map(v => `'${v}'`).join(', ')}`;
    }
    if (err.keyword === 'type') {
        const expected = (err.params as { type?: string }).type ?? '';
        return `Frontmatter: ${path} must be ${expected}`;
    }
    return `Frontmatter: ${path} ${err.message ?? 'invalid value'}`;
}

function yamlParseError(
    e: unknown,
    bodyStart: number,
    document: vscode.TextDocument,
): vscode.Diagnostic {
    const msg = e instanceof Error ? e.message : 'Invalid YAML syntax';
    const posMatch = /\((\d+):\d+\)/.exec(msg);
    const yamlLine = posMatch ? parseInt(posMatch[1], 10) - 1 : 0;
    const docLine = Math.min(bodyStart + yamlLine, document.lineCount - 1);
    const lineText = document.lineAt(docLine).text;
    return new vscode.Diagnostic(
        new vscode.Range(docLine, 0, docLine, lineText.length),
        `Frontmatter: ${msg.split('\n')[0]}`,
        vscode.DiagnosticSeverity.Error,
    );
}
