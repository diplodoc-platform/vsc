import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('i18n', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'document');
    });

    it('uses russian locale when document language is russian', async () => {
        globalThis.document = {
            documentElement: {
                lang: 'ru-RU',
            },
        } as never;

        const {t} = await import('./index');

        expect(t('sidebar.welcome')).toBe('Добро пожаловать в Diplodoc');
        expect(t('yes')).toBe('Да');
    });

    it('falls back to english for unknown locale', async () => {
        globalThis.document = {
            documentElement: {
                lang: 'fr-FR',
            },
        } as never;

        const {t} = await import('./index');

        expect(t('sidebar.welcome')).toBe('Welcome to Diplodoc');
    });

    it('returns key when translation is missing', async () => {
        globalThis.document = {
            documentElement: {
                lang: 'en',
            },
        } as never;

        const {t} = await import('./index');

        expect(t('missing.key' as never)).toBe('missing.key');
    });
});
