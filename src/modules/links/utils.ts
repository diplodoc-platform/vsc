import * as vscode from 'vscode';

import {isExternalUrl} from '../../utils';

import {FIELD_RE, LINK_FIELDS} from './constants';

export {isExternalUrl};

export function parseLinkFromLine(
    line: vscode.TextLine,
    baseUri: vscode.Uri,
): vscode.DocumentLink | null {
    const match = FIELD_RE.exec(line.text);

    if (!match) {
        return null;
    }

    const [, field, rawValue] = match;
    const value = rawValue.trim().replace(/['"]$/, '');

    if (!LINK_FIELDS.has(field) || !value) {
        return null;
    }

    const valueStart = line.text.indexOf(value, line.text.indexOf(field) + field.length);

    if (valueStart === -1) {
        return null;
    }

    const range = new vscode.Range(
        line.lineNumber,
        valueStart,
        line.lineNumber,
        valueStart + value.length,
    );

    const target = isExternalUrl(value)
        ? vscode.Uri.parse(value)
        : vscode.Uri.joinPath(baseUri, value);

    return new vscode.DocumentLink(range, target);
}
