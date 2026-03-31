## How to start

```bash
# Clone this repo to new folder
git clone git@github.com:diplodoc-platform/package-template.git new-package
cd new-package

# Init repo with new package name
./init.sh new-package
```

The `init.sh` script will:
- Replace `package-template` with your package name in `package.json` and `README.md`
- Initialize linting with `@diplodoc/lint init` (adds lint scripts, configs, and Git hooks)
- Install dependencies
- Update git remote URL
- Remove template files (`init.sh`, `README-template.md`)After initialization, you'll have a fully configured package with:
- TypeScript configuration extending `@diplodoc/tsconfig`
- ESLint, Prettier, and Stylelint configured via `@diplodoc/lint` (added automatically)
- Git hooks via Husky (configured automatically)
- Build scripts using esbuild
- Type declarations generation
- Vitest testing setup with example test
- GitHub Actions workflows (tests, security, publish, release-please)
- GitHub templates (issue templates, PR template)
- Dependabot configuration for automated dependency updates
- Release-please for automated versioning and changelog generation
- SECURITY.md and CONTRIBUTING.md documentation

## Next Steps

1. Update `README.md` with your package description
2. Update `package.json` description and repository URL
3. Add your code to `src/index.ts`
4. Configure exports in `package.json` if needed
5. Add tests (Vitest is already configured with example test)
6. Update GitHub templates (`.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`) if needed
7. Update `SECURITY.md` with your contact email if different
8. Review and customize `.github/workflows/` if needed
9. Update release-please configuration:
   - `.release-please-config.json`: Update `package-name` field
   - `.release-please-manifest.json`: Set initial version
10. Set up GitHub Secrets for publishing (if applicable):
   - `NPM_TOKEN`: Required for npm publishing (get from npmjs.com)
   - `RELEASE_PLEASE_TOKEN`: Optional, for release-please (uses `GITHUB_TOKEN` by default)

## Release Process

The package uses **release-please** for automated releases:

1. Make conventional commits (e.g., `feat: add feature`, `fix: bug fix`)
2. Release-please automatically creates/updates a release PR
3. Review and merge the release PR
4. Release-please creates a GitHub release
5. The publish workflow automatically publishes to npm

**Note**: Ensure `NPM_TOKEN` secret is configured in GitHub repository settings for automatic publishing.

## Package Structure```
package-name/
├── src/
│   ├── index.ts          # Main source file
│   └── index.test.ts     # Example test file
├── build/                # Build output (generated)
│   ├── index.js
│   └── index.d.ts
├── .github/
│   ├── ISSUE_TEMPLATE/   # Issue templates
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── workflows/        # CI/CD workflows
│   │   ├── tests.yml     # Test workflow
│   │   ├── security.yml  # Security audit
│   │   └── release.yaml  # Publish to npm
│   ├── dependabot.yml    # Dependency updates
│   └── pull_request_template.md
├── esbuild/
│   └── build.mjs         # Build configuration
├── tsconfig.json         # TypeScript config
├── tsconfig.publish.json # TypeScript config for publishing
├── vitest.config.mjs     # Vitest configuration
├── package.json          # Package configuration
├── SECURITY.md           # Security policy
├── CONTRIBUTING.md       # Contribution guidelines
└── README.md             # Package documentation
```

## Development Workflow

1. Make changes in `src/`
2. Run `npm test` to run tests
3. Run `npm run build` to build
4. Run `npm run lint` to check code quality
5. Run `npm run typecheck` to verify types
6. Commit changes (pre-commit hook will run linting automatically)

## CI/CD

The package includes a GitHub Actions workflow (`.github/workflows/tests.yml`) that:
- Runs tests on multiple platforms (Linux, macOS, Windows)
- Runs type checking
- Runs linting
- Builds the package

The workflow runs on push to `master` and on pull requests.