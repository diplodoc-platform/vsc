#!/usr/bin/env bash

set -e

NAME=$1

if [ -z "$NAME" ]; then
    echo "Usage: ./init.sh <package-name>"
    exit 1
fi

ORIGIN=$(git remote get-url origin)
FILES=(package.json README.md)

cp -f README-template.md README.md

for FILE in ${FILES[@]}
do
    sed -i '' "s/package-template/$NAME/g" $FILE
done

# Update release-please config with package name
if [ -f .release-please-config.json ]; then
    sed -i '' "s/@diplodoc\/package-template/@diplodoc\/$NAME/g" .release-please-config.json
fi

# Remove template section from AGENTS.md
if [ -f AGENTS.md ]; then
    # Remove everything from "<!-- TEMPLATE SECTION" to "<!-- END TEMPLATE SECTION -->"
    # Using awk to handle multiline deletion more reliably
    awk '/<!-- TEMPLATE SECTION/,/<!-- END TEMPLATE SECTION -->/ {next} {print}' AGENTS.md > AGENTS.md.tmp && mv AGENTS.md.tmp AGENTS.md
    # Clean up any leading empty lines
    sed -i '' '/./,$!d' AGENTS.md
fi

# Initialize linting
echo "Initializing linting..."
npx @diplodoc/lint init

# Install dependencies
echo "Installing dependencies..."
npm install

# Remove template files
rm init.sh README-template.md

# Note: GitHub templates and workflows will remain as examples
# Update them with package-specific information if needed

git remote set-url origin ${ORIGIN/package-template/$NAME}
git add --all
git commit --amend -m "initial"
git push

