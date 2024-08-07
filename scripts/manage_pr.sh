#!/bin/bash
set -euo pipefail

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Run pre-commit checks
./scripts/pre_commit_checks.sh

# Normalize line endings to LF
git rm -rf --cached .
git reset --hard HEAD

# Add all changes to the staging area
git add -A

# Check if there are any changes to be committed
if ! git diff-index --quiet HEAD --; then
    git commit -m "Committing all changes"
fi

# Automatically determine the branch name
branch=$(git rev-parse --abbrev-ref HEAD)

# Check if a pull request already exists for the branch
#existing_pr=$(gh pr list --search "head:${REPO_OWNER}:${branch}" --json number --jq '.[] | .number')
existing_pr=$(gh pr list --search "${branch}" --json number --jq '.[] | .number')

git push --set-upstream origin $branch

if [ -z "$existing_pr" ]; then
  gh pr create
else
  echo "A pull request already exists for branch ${branch}. Skipping pull request creation."
fi
