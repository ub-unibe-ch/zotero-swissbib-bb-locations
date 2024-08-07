#!/bin/bash
set -euo pipefail

# Check for uncommitted changes (both staged and unstaged)
if ! git diff-index --quiet HEAD -- || ! git diff --quiet; then
    echo "Uncommitted changes found."
    echo "Commit all changes before continuing."
    exit 1
else
    echo "No uncommitted changes found."
fi