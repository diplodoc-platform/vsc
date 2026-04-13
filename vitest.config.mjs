import {coverageConfigDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['./src/test-setup.ts', './src/require.ts'],
        environment: 'node',
        include: [
            'src/**/*.{test,spec}.ts',
        ],
        exclude: ['node_modules'],
        coverage: {
            all: true,
            provider: 'v8',
            include: ['src/**'],
            exclude: ['assets/**', 'tests/**', ...coverageConfigDefaults.exclude],
            excludeAfterRemap: true,
            reporter: ['text', 'json', 'html', 'lcov'],
        },
        testTimeout: 60000,
    },
});
