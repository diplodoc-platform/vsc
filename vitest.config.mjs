import {coverageConfigDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['./src/test-setup.ts'],
        environment: 'node',
        include: [
            'src/**/*.{test,spec}.ts',
        ],
        exclude: ['node_modules'],
        coverage: {
            all: true,
            provider: 'v8',
            include: ['src/**'],
            exclude: [
                'assets/**',
                'tests/**',
                'src/ui/**/*.tsx',
                'src/ui/html.ts',
                'src/ui/useVscodeTheme.ts',
                'src/ui/hooks/**',
                'src/ui/error/**',
                'src/ui/header/**',
                ...coverageConfigDefaults.exclude,
            ],
            excludeAfterRemap: true,
            reporter: ['text', 'json', 'html', 'lcov'],
        },
        testTimeout: 60000,
    },
});
