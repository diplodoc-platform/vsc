import {readFileSync} from 'fs';
import {basename} from 'path';
import * as vscode from 'vscode';

import {
    findPresetsFiles,
    findVariableLine,
    getVariableAtPosition,
    parsePresetsFile,
    resolveVariables,
} from './resolver';
import {PRESETS_FILENAME} from './constants';

function findCurrentPreset(document: vscode.TextDocument, line: number): string | null {
    for (let i = line; i >= 0; i--) {
        const match = /^(\w+):/.exec(document.lineAt(i).text);

        if (match) {
            return match[1];
        }
    }

    return null;
}

function getYamlKeyAtPosition(lineText: string, character: number): string | null {
    const match = /^\s+([\w.]+)\s*:/.exec(lineText);

    if (match && character < match[0].length) {
        return match[1];
    }

    return null;
}

function providePresetsFileDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
): vscode.Location[] | null {
    const lineText = document.lineAt(position.line).text;
    const varName = getYamlKeyAtPosition(lineText, position.character);

    if (!varName) {
        return null;
    }

    const currentPreset = findCurrentPreset(document, position.line);

    if (!currentPreset) {
        return null;
    }

    const content = document.getText();

    if (currentPreset !== 'default') {
        const line = findVariableLine(content, 'default', varName);

        if (line > 0) {
            const range = new vscode.Range(line, 0, line, 0);

            return [new vscode.Location(document.uri, range)];
        }
    }

    const files = findPresetsFiles(document.uri.fsPath);

    for (const filePath of files) {
        let fileContent: string;

        try {
            fileContent = readFileSync(filePath, 'utf-8');
        } catch {
            continue;
        }

        const data = parsePresetsFile(filePath);

        if (!data) {
            continue;
        }

        const line = findVariableLine(fileContent, 'default', varName);

        if (line > 0) {
            const uri = vscode.Uri.file(filePath);
            const range = new vscode.Range(line, 0, line, 0);

            return [new vscode.Location(uri, range)];
        }
    }

    return null;
}

export class PresetsDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Location[] | null {
        if (basename(document.fileName) === PRESETS_FILENAME) {
            return providePresetsFileDefinition(document, position);
        }

        const lineText = document.lineAt(position.line).text;
        const variable = getVariableAtPosition(lineText, position.character);

        if (!variable) {
            return null;
        }

        const allVariables = resolveVariables(document.uri.fsPath);
        const entries = allVariables.get(variable.name);

        if (!entries || entries.length === 0) {
            return null;
        }

        const seen = new Set<string>();
        const locations: vscode.Location[] = [];

        for (const entry of entries) {
            if (seen.has(entry.filePath)) {
                continue;
            }

            seen.add(entry.filePath);

            let content: string;

            try {
                content = readFileSync(entry.filePath, 'utf-8');
            } catch {
                continue;
            }

            const line = findVariableLine(content, 'default', variable.name);
            const uri = vscode.Uri.file(entry.filePath);
            const range = new vscode.Range(line, 0, line, 0);

            locations.push(new vscode.Location(uri, range));
        }

        return locations.length > 0 ? locations : null;
    }
}
