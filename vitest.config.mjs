import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        exclude: ['node_modules', 'build'],
        coverage: {
            enabled: true,
            provider: 'v8',
            include: ['src'],
            exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        },
    },
});






