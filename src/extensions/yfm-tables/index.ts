import type {ExtensionAuto, SerializerNodeToken} from '@gravity-ui/markdown-editor';

type State = Parameters<SerializerNodeToken>[0];
type PMNode = Parameters<SerializerNodeToken>[1];

export const YfmTables: ExtensionAuto = (builder) => {
    builder.overrideNodeSerializerSpec('yfm_tbody', (prev) => (state, node, parent, index) => {
        if (!isSimpleTable(node)) {
            prev(state, node, parent, index);
            return;
        }

        serializeCompactBody(state, node);
    });

    builder.overrideNodeSerializerSpec('table', (prev) => (state, node, parent, index) => {
        const before = state.out.length;

        prev(state, node, parent, index);

        const raw = state.out.slice(before);

        state.out = state.out.slice(0, before) + padGfmBlock(raw);
    });

    builder.overrideNodeSerializerSpec('doc', (prev) => (state, node, parent, index) => {
        prev(state, node, parent, index);

        state.out = state.out.replace(/\n{3,}/g, '\n\n');
    });
};

function serializeCompactBody(state: State, tbody: PMNode) {
    tbody.forEach((trow) => {
        state.write('||');

        let colIdx = 0;

        trow.forEach((td) => {
            if (colIdx > 0) {
                state.write('|');
            }

            const hasContent = td.textContent.trim().length > 0;

            if (hasContent && td.firstChild) {
                state.write(' ');
                state.renderInline(td.firstChild);
                state.write(' ');
            } else {
                state.write(' ');
            }

            colIdx++;
        });

        state.write('||');
        state.ensureNewLine();
    });
}

function isSimpleTable(tbody: PMNode): boolean {
    let simple = true;

    tbody.forEach((row) => {
        row.forEach((cell) => {
            const colspan = Number(cell.attrs?.colspan ?? 1);
            const rowspan = Number(cell.attrs?.rowspan ?? 1);

            if (colspan > 1 || rowspan > 1) {
                simple = false;
            }

            if (cell.childCount > 1) {
                simple = false;
            }

            if (cell.childCount === 1 && !cell.firstChild?.isTextblock) {
                simple = false;
            }
        });
    });

    return simple;
}

function padGfmBlock(block: string): string {
    const lines = block.split('\n').filter((l) => l.startsWith('|'));

    if (lines.length < 2 || !/^\|[\s:]*-+/.test(lines[1])) {
        return block;
    }

    const rows = lines.map((line) =>
        line
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim()),
    );

    const colCount = rows[0].length;
    const widths: number[] = [];

    for (let col = 0; col < colCount; col++) {
        let max = 3;

        for (let row = 0; row < rows.length; row++) {
            if (row === 1) {
                continue;
            }

            const len = (rows[row][col] ?? '').length;

            if (len > max) {
                max = len;
            }
        }

        widths.push(max);
    }

    const padded = rows.map(
        (cells, rowIdx) =>
            '| ' +
            cells
                .map((cell, colIdx) => {
                    const w = widths[colIdx];

                    if (rowIdx === 1) {
                        const hasCenter = cell.startsWith(':') && cell.endsWith(':');
                        const hasRight = !cell.startsWith(':') && cell.endsWith(':');

                        if (hasCenter) {
                            return ':' + '-'.repeat(w - 2) + ':';
                        }

                        if (hasRight) {
                            return '-'.repeat(w - 1) + ':';
                        }

                        return '-'.repeat(w);
                    }

                    return cell.padEnd(w);
                })
                .join(' | ') +
            ' |',
    );

    const prefix = block.slice(0, block.indexOf(lines[0]));
    const suffix = block.slice(
        block.lastIndexOf(lines[lines.length - 1]) + lines[lines.length - 1].length,
    );

    return prefix + padded.join('\n') + suffix;
}
