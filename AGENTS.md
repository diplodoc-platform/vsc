<!-- TEMPLATE SECTION - This section will be removed after running init.sh -->
<!-- ============================================================================ -->
<!-- TEMPLATE: Package Template Documentation -->
<!-- ============================================================================ -->

# AGENTS.md - Package Template

This file is part of the `@diplodoc/package-template` package. After running `./init.sh`, the template section below will be removed, and only the package-specific section will remain.

## Template Overview

The `@diplodoc/package-template` provides a starting point for creating new packages in the Diplodoc metapackage. It includes:

- TypeScript configuration extending `@diplodoc/tsconfig`
- Build setup with esbuild
- Basic package structure
- Scripts for building and type checking

## Template Usage

1. Clone the template repository
2. Run `./init.sh <package-name>` to initialize
3. The script will:
   - Replace `package-template` with your package name
   - Initialize linting via `@diplodoc/lint init`
   - Install dependencies
   - Remove template files

<!-- END TEMPLATE SECTION -->
<!-- ============================================================================ -->

# AGENTS.md

A guide for AI coding agents working on this package.

## Common Rules and Standards

**Important**: This package follows common rules and standards defined in the Diplodoc metapackage. When working in metapackage mode, refer to:

- **`.agents/style-and-testing.md`** in the metapackage root for:
  - Code style guidelines
  - Commit message format (Conventional Commits)
  - Pre-commit hooks rules (**CRITICAL**: Never commit with `--no-verify`)
  - Testing standards
  - Documentation requirements
- **`.agents/core.md`** for core concepts
- **`.agents/monorepo.md`** for workspace and dependency management
- **`.agents/dev-infrastructure.md`** for build and CI/CD

**Note**: In standalone mode (when this package is used independently), these rules still apply. If you need to reference the full documentation, check the [Diplodoc metapackage repository](https://github.com/diplodoc-platform/diplodoc).

## Package Overview

<!-- TODO: Add package description after initialization -->

This package is part of the Diplodoc metapackage. It provides [describe functionality].

## Setup Commands

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Type check
npm run typecheck
```

## Development Commands

```bash
# Build in watch mode (if configured)
npm run watch

# Run tests (if configured)
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Package Structure

```
package-name/
├── src/
│   ├── index.ts          # Main source file
│   └── index.test.ts     # Example test file
├── build/                # Build output directory (generated)
│   ├── index.js         # Bundled JavaScript
│   └── index.d.ts       # TypeScript declarations
├── esbuild/
│   └── build.mjs        # Build configuration (ESM)
├── .github/
│   ├── ISSUE_TEMPLATE/  # Issue templates
│   ├── workflows/       # CI/CD workflows
│   ├── dependabot.yml   # Dependency updates
│   └── pull_request_template.md
├── tsconfig.json        # TypeScript config (extends @diplodoc/tsconfig)
├── tsconfig.publish.json # TypeScript config for publishing
├── vitest.config.mjs    # Vitest configuration
├── .release-please-config.json # Release-please configuration
├── .release-please-manifest.json # Release-please manifest
├── package.json         # Package configuration
├── SECURITY.md          # Security policy
├── CONTRIBUTING.md      # Contribution guidelines
└── README.md            # Package documentation
```

## Build System

The package uses **esbuild** for fast builds:

- Entry point: `src/index.ts`
- Output directory: `build/`
- Output files:
  - `build/index.js` - Bundled JavaScript (with sourcemaps)
  - `build/index.d.ts` - TypeScript declarations (generated via `tsc`)

Build process:
1. `build:js` - Bundles JavaScript using esbuild (ESM module)
2. `build:declarations` - Generates TypeScript declarations using `tsconfig.publish.json`
3. `build:clean` - Removes build directory (optional, run before build if needed)

The build script uses ESM (`build.mjs`) and outputs to `build/` directory for cleaner project structure.

## TypeScript Configuration

Extends `@diplodoc/tsconfig` with:
- Target: ES2022
- Module: ES2022
- Declaration files enabled

## Linting and Code Quality

Linting is configured via `@diplodoc/lint`:

- ESLint for JavaScript/TypeScript
- Prettier for code formatting
- Stylelint for CSS/SCSS (if applicable)
- Git hooks via Husky
- Pre-commit checks via lint-staged

Configuration files are automatically managed by `@diplodoc/lint`:
- `.eslintrc.js`
- `.prettierrc.js`
- `.stylelintrc.js` (if CSS/SCSS files exist)
- `.editorconfig`
- `.lintstagedrc.js`
- `.husky/pre-commit`

## Testing

The package uses **Vitest** for testing (recommended framework for Diplodoc platform):

- Configuration: `vitest.config.mjs`
- Test files: `src/**/*.test.ts` or `src/**/*.spec.ts`
- Coverage: Enabled via `@vitest/coverage-v8`

**Test Commands**:
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

**Example Test**: See `src/index.test.ts` for a basic test example.

For E2E tests, consider using Playwright (see `devops/testpack` for examples).

## Important Notes

1. **Metapackage vs Standalone**: This package can be used both as part of the metapackage (workspace mode) and as a standalone npm package. All scripts must work in both contexts.

2. **Linting**: Linting infrastructure is managed by `@diplodoc/lint`. Run `npx @diplodoc/lint update` to sync configurations.

3. **Build Output**: The build outputs files to the `build/` directory. Update `package.json` `files` field if adding more output files.

4. **Type Exports**: Ensure `package.json` has correct `types` field pointing to declaration files in `build/` directory.

5. **Documentation**: Update this file and `README.md` with package-specific information after initialization.

6. **package.json Maintenance**: Periodically check that `package.json` fields (description, repository URL, bugs URL, etc.) are accurate and up-to-date. Verify that dependency versions are current and compatible with the project standards.

## CI/CD

The package includes GitHub Actions workflows:

- **tests.yml**: Runs tests, type checking, linting, and build on multiple platforms
- **security.yml**: Weekly security audits via npm audit
- **release-please.yml**: Automated versioning and changelog generation based on conventional commits
- **release.yaml**: Publishes package to npm when a release is created

### Release Process

The package uses **release-please** for automated versioning and publishing:

1. **Release-please workflow** (`.github/workflows/release-please.yml`):
   - Runs on push to `master`
   - Analyzes conventional commits to determine version bumps
   - Creates release PRs with updated version and CHANGELOG.md
   - When release PR is merged, creates a GitHub release with tag `v1.0.0`

2. **Publish workflow** (`.github/workflows/release.yaml`):
   - Triggers automatically when a release is created
   - Runs tests, type checking, and build
   - Verifies package contents and version matching
   - Publishes to npm with provenance

**Workflow**:
1. Developer makes conventional commits (e.g., `feat: add new feature`)
2. Release-please creates/updates release PR with version bump and changelog
3. Release PR is reviewed and merged
4. Release-please creates GitHub release
5. Publish workflow automatically publishes to npm

**Version Bump Rules**:
- `feat`: Minor version bump
- `fix`: Patch version bump
- Breaking changes (e.g., `feat!: breaking change`): Major version bump
- `chore`, `docs`, `refactor`: No version bump (unless breaking)

**Required Secrets**:
- `NPM_TOKEN`: npm authentication token for publishing

## GitHub Integration

- **Issue templates**: Bug reports and feature requests (`.github/ISSUE_TEMPLATE/`)
- **Pull request template**: Standardized PR format (`.github/pull_request_template.md`)
- **Dependabot**: Automated dependency updates (`.github/dependabot.yml`)

## Documentation Files

- **SECURITY.md**: Security policy and vulnerability reporting
- **CONTRIBUTING.md**: Contribution guidelines and development workflow
- **AGENTS.md**: This file - guide for AI coding agents

## Additional Resources

- Metapackage `.agents/` - Platform-wide agent documentation
- `@diplodoc/lint` documentation - Linting and formatting setup
- `@diplodoc/tsconfig` - TypeScript configuration reference

