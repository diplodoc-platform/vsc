export type ImageMatch = {index: number; length: number; alt: string; src: string};

const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export function findImageMatches(text: string, failed: ReadonlySet<string>): ImageMatch[] {
    const result: ImageMatch[] = [];

    IMAGE_MD_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMAGE_MD_RE.exec(text)) !== null) {
        const src = m[2];
        if (failed.has(src)) {
            continue;
        }
        result.push({index: m.index, length: m[0].length, alt: m[1], src});
    }

    return result;
}
