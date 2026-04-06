interface ShortcutKeys {
    key: string;
    cmdOrCtrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutKeys): boolean {
    const cmdOrCtrl = event.metaKey || event.ctrlKey;

    const keyMatch =
        event.key.toLowerCase() === shortcut.key.toLowerCase() ||
        event.code === `Key${shortcut.key.toUpperCase()}`;

    return (
        keyMatch &&
        !!shortcut.cmdOrCtrl === cmdOrCtrl &&
        !!shortcut.shift === event.shiftKey &&
        !!shortcut.alt === event.altKey
    );
}
