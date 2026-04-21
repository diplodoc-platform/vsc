import {beforeEach, describe, expect, it, vi} from 'vitest';

const getLanguageService = vi.fn();

vi.mock('yaml-language-server', () => ({
    getLanguageService,
}));

describe('yaml-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('configures language service only once', async () => {
        const service = {
            configure: vi.fn(),
        };
        getLanguageService.mockReturnValue(service);

        const {getConfiguredService} = await import('./yaml-service');

        expect(getConfiguredService()).toBe(service);
        expect(getConfiguredService()).toBe(service);
        expect(getLanguageService).toHaveBeenCalledTimes(1);
        expect(service.configure).toHaveBeenCalledTimes(1);
    });

    it('registers schemas for all supported schema types', async () => {
        const service = {
            configure: vi.fn(),
        };
        getLanguageService.mockReturnValue(service);

        const {getConfiguredService, SCHEMA_NAMES} = await import('./yaml-service');

        getConfiguredService();

        const settings = vi.mocked(service.configure).mock.calls[0][0];

        expect(Object.keys(SCHEMA_NAMES)).toEqual([
            'pc',
            'fm',
            'leading',
            'toc',
            'yfm',
            'yfmlint',
            'presets',
            'redirects',
            'theme',
        ]);
        expect(settings.validate).toBe(true);
        expect(settings.completion).toBe(true);
        expect(settings.hover).toBe(true);
        expect(settings.schemas).toHaveLength(9);
        expect(settings.schemas[0]).toMatchObject({
            uri: 'diplodoc://pc-schema',
            fileMatch: ['diplodoc://pc.yaml'],
        });
        expect(settings.schemas[1]).toMatchObject({
            uri: 'diplodoc://fm-schema',
            fileMatch: ['diplodoc://fm.yaml'],
        });
    });

    it('creates virtual documents with incrementing versions', async () => {
        const {createVirtualDocument} = await import('./yaml-service');

        const first = createVirtualDocument('title: One', 'fm');
        const second = createVirtualDocument('title: Two', 'fm');

        expect(first.uri).toBe('diplodoc://fm.yaml');
        expect(first.languageId).toBe('yaml');
        expect(first.getText()).toBe('title: One');
        expect(second.version).toBe(first.version + 1);
    });
});
