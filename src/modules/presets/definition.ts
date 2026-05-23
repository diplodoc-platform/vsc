import {readFileSync} from 'fs';
import * as vscode from 'vscode';

import {findVariableLine, getVariableAtPosition, resolveVariables} from './resolver';

export class PresetsDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Location[] | null {
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
