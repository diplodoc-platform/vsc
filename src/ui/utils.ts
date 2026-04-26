export function isTrustedOrigin(origin: string): boolean {
    return origin === '' || origin === window.location.origin;
}

export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
    let timer: ReturnType<typeof setTimeout>;

    return ((...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as T;
}

export function getFilesMap(fileName: string, files: string[]) {
    const filesMap = new Map();

    for (const f of files) {
        const arr = f.split('/');
        const file = arr.pop();
        const dir = arr.join('/');

        if (fileName !== '' && !file?.toLowerCase().includes(fileName.toLowerCase())) {
            continue;
        }

        if (!filesMap.has(dir)) {
            filesMap.set(dir, []);
        }

        filesMap.get(dir).push(f);
    }

    const sortedEntries = [...filesMap.entries()].sort(([a], [b]) => {
        if (a === '') {
            return -1;
        }

        if (b === '') {
            return 1;
        }

        return a.localeCompare(b);
    });

    return new Map(sortedEntries);
}
