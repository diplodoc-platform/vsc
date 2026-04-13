import type {Content} from './types';

export function parseContent(content: string) {
    const {fmContent, bodyContent, fmLineCount} = extractFrontmatter(content);
    const pcContent = extractPcBlocks(bodyContent, fmLineCount);

    return {
        pcContent,
        fmContent,
    };
}

function extractFrontmatter(content: string) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);

    if (!match) {
        return {
            fmContent: null,
            bodyContent: content,
            fmLineCount: 0,
        };
    }

    const inner = match[1];
    const startLine = 1;
    const endLine = inner.split('\n').length;

    const fmContent: Content = {
        type: 'fm',
        startLine,
        endLine,
        content: inner,
    };

    return {
        fmContent,
        bodyContent: content.slice(match[0].length),
        fmLineCount: endLine + 2,
    };
}

function extractPcBlocks(content: string, lineOffset: number) {
    const pcContent: Content[] = [];
    const lines = content.split('\n');

    let blockStart: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed === '::: page-constructor') {
            blockStart = i;
            continue;
        }

        if (trimmed === ':::' && blockStart !== null) {
            const innerLines = lines.slice(blockStart + 1, i);

            let first = 0;
            let last = innerLines.length - 1;

            while (first <= last && innerLines[first].trim() === '') {
                first++;
            }

            while (last >= first && innerLines[last].trim() === '') {
                last--;
            }

            const trimmedLines = innerLines.slice(first, last + 1);

            pcContent.push({
                type: 'pc',
                startLine: lineOffset + blockStart + 1 + first,
                endLine: lineOffset + blockStart + 1 + last,
                content: trimmedLines.join('\n'),
            });

            blockStart = null;
        }
    }

    return pcContent;
}
