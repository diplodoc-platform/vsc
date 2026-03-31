#!/usr/bin/env node

import {build} from 'esbuild';

import tsConfig from '../tsconfig.json' with {type: 'json'};

const outDir = 'build';

/** @type {import('esbuild').BuildOptions}*/
const common = {
    bundle: true,
    sourcemap: true,
    target: tsConfig.compilerOptions.target,
    tsconfig: './tsconfig.publish.json',
    platform: 'node',
    packages: 'external',
};

build({
    ...common,
    entryPoints: ['src/index.ts'],
    outfile: outDir + '/index.js',
});






