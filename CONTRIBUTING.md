# Contributing to @diplodoc/package-template

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js**: Version 22.x
- **npm**: >= 11.5.1
- **Git**: For version control

### Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/diplodoc-platform/package-template.git
   cd package-template
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify the setup**:
   ```bash
   npm run build
   npm test
   ```

## Development Workflow

### Project Structure

```
package-name/
├── src/                    # Source code
├── build/                  # Compiled output (generated)
├── esbuild/               # Build configuration
├── .github/               # GitHub workflows and templates
└── test/                  # Test files (if separate)
```

### Making Changes

1. **Create a branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following the [Code Style](#code-style) guidelines.

3. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

4. **Run linting** to check code quality:
   ```bash
   npm run lint
   ```

5. **Format your code** (if needed):
   ```bash
   npm run lint:fix
   ```

6. **Commit your changes** following [Commit Guidelines](#commit-guidelines).

## Code Style

### TypeScript

- **Strict mode**: All code must pass TypeScript strict mode checks.
- **ES2022 target**: Code is compiled to ES2022 with ES modules.
- **Functional patterns**: Prefer functional programming patterns where possible.

### Import Organization

Imports should be organized according to the project's style guidelines. See `.agents/style-and-testing.md` in the metapackage for detailed import organization rules.

### Comments and Documentation

- **All comments must be in English** (including test comments and inline documentation).
- **JSDoc**: All public APIs must be documented with JSDoc comments.
- **Internal functions**: Use concise comments without redundant `@param` and `@returns` tags.

### Code Formatting

The project uses **Prettier** for code formatting, configured via `@diplodoc/lint`. Run `npm run lint:fix` before committing.

## Testing

### Test Structure

- Test files use `.test.ts` or `.spec.ts` extension.
- Tests are located next to the code they test or in a `test/` directory.
- Use Vitest framework for unit tests.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

Focus areas:
- Core functionality
- Error handling
- Edge cases

## Documentation

### User Documentation

- **README.md**: Main project documentation
- **AGENTS.md**: Documentation for AI coding agents

### Developer Documentation

- **CONTRIBUTING.md**: This file
- **SECURITY.md**: Security policy

### Updating Documentation

- Update relevant README files when adding features
- Keep examples up to date with API changes

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>
```

### Commit Types

- `feat`: New feature for end users
- `fix`: Bug fix for end users
- `perf`: Performance improvement
- `refactor`: Code refactoring (no functional changes)
- `docs`: Documentation changes only
- `chore`: Maintenance tasks and infrastructure changes
- `revert`: Reverting a previous commit

**Key distinction**: `feat` is for **user-facing functionality**, while `chore` is for **development infrastructure**.

**Examples**:
- ✅ `feat(cache): add CacheFirst strategy` – new caching feature
- ✅ `chore(lint): add module import restrictions` – ESLint configuration
- ❌ `feat(lint): add module import restrictions` – incorrect (infrastructure, not user feature)

### Commit Message Rules

- **All commit messages must be in English**
- **Subject**: Brief description in imperative mood (e.g., "add", "fix", not "added", "fixed")
- **Scope** (optional): Area of codebase (e.g., `cache`, `models`, `telemetry`)
- **Body** (optional): Detailed explanation of what and why

## Pull Request Process

1. **Update your branch**:
   ```bash
   git checkout master
   git pull origin master
   git checkout your-branch
   git rebase master
   ```

2. **Ensure all checks pass**:
   - Tests pass: `npm test`
   - Linting passes: `npm run lint`
   - Type checking passes: `npm run typecheck`
   - Build succeeds: `npm run build`

3. **Create a Pull Request**:
   - Use the PR template provided
   - Provide a clear description of changes
   - Link related issues if applicable
   - Ensure CI checks pass

4. **Code Review**:
   - Address review comments
   - Keep commits focused and logical
   - Squash commits if requested

### PR Checklist

- [ ] Tests pass locally
- [ ] Added/updated tests for new functionality
- [ ] Type check passes (`npm run typecheck`)
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated (if needed)
- [ ] No new warnings generated
- [ ] CHANGELOG will be updated by release-please (if applicable)

## CLA (Contributor License Agreement)

In order for us (YANDEX LLC) to accept patches and other contributions from you, you will have to adopt our Yandex Contributor License Agreement (the "**CLA**"). The current version of the CLA can be found here:
1) https://yandex.ru/legal/cla/?lang=en (in English) and 
2) https://yandex.ru/legal/cla/?lang=ru (in Russian).

By adopting the CLA, you state the following:

* You obviously wish and are willingly licensing your contributions to us for our open source projects under the terms of the CLA,
* You have read the terms and conditions of the CLA and agree with them in full,
* You are legally able to provide and license your contributions as stated,
* We may use your contributions for our open source projects and for any other our project too,
* We rely on your assurances concerning the rights of third parties in relation to your contributions.

If you agree with these principles, please read and adopt our CLA. By providing us your contributions, you hereby declare that you have already read and adopt our CLA, and we may freely merge your contributions with our corresponding open source project and use it in further in accordance with terms and conditions of the CLA.

### Provide contributions 

If you have already adopted terms and conditions of the CLA, you are able to provide your contributions. When you submit your pull request, please add the following information into it:

```
I hereby agree to the terms of the CLA available at: [link].
```

Replace the bracketed text as follows:
* [link] is the link to the current version of the CLA: https://yandex.ru/legal/cla/?lang=en (in English) or https://yandex.ru/legal/cla/?lang=ru (in Russian).

It is enough to provide us such notification once. 

## Questions?

If you have questions or need help, please:
- Open an issue for bugs or feature requests
- Check existing documentation
- Review examples in the codebase

Thank you for contributing! 🎉
