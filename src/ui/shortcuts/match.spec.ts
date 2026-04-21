import {describe, expect, it} from 'vitest';

import {matchesShortcut} from './match';

describe('matchesShortcut', () => {
    it('matches keyboard event by key', () => {
        expect(
            matchesShortcut(
                {
                    key: 't',
                    code: 'KeyT',
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: true,
                } as KeyboardEvent,
                {key: 't', alt: true},
            ),
        ).toBe(true);
    });

    it('matches keyboard event by code', () => {
        expect(
            matchesShortcut(
                {
                    key: 'е',
                    code: 'KeyT',
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: true,
                } as KeyboardEvent,
                {key: 't', alt: true},
            ),
        ).toBe(true);
    });

    it('matches cmdOrCtrl when ctrl is pressed', () => {
        expect(
            matchesShortcut(
                {
                    key: 'k',
                    code: 'KeyK',
                    metaKey: false,
                    ctrlKey: true,
                    shiftKey: false,
                    altKey: false,
                } as KeyboardEvent,
                {key: 'k', cmdOrCtrl: true},
            ),
        ).toBe(true);
    });

    it('returns false when modifier flags do not match', () => {
        expect(
            matchesShortcut(
                {
                    key: 'r',
                    code: 'KeyR',
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: true,
                    altKey: true,
                } as KeyboardEvent,
                {key: 'r', alt: true},
            ),
        ).toBe(false);
    });
});
