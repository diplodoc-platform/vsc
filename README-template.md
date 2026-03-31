# @diplodoc/package-template

[![NPM version](https://img.shields.io/npm/v/@diplodoc/package-template.svg?style=flat)](https://www.npmjs.org/package/@diplodoc/package-template)

## Description

Package description goes here.

## Installation

```bash
npm install @diplodoc/package-template
```

## Usage

Usage examples go here.

## Development

### Setup

```bash
npm install
```

### Build

```bash
# Build the package
npm run build

# Clean build directory
npm run build:clean && npm run build
```

Build outputs to `build/` directory:
- `build/index.js` - Bundled JavaScript
- `build/index.d.ts` - TypeScript declarations

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

Linting is configured via `@diplodoc/lint`. After running `./init.sh`, linting will be automatically set up.

```bash
# Check code
npm run lint

# Fix issues automatically
npm run lint:fix
```

### Type Checking

```bash
npm run typecheck
```## LicenseMIT