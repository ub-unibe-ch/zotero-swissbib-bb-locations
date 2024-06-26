#!/bin/bash
set -euo pipefail

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Ensure required tools are installed
if ! command -v jq &>/dev/null; then
    echo "jq is not installed. Please install jq to proceed."
    exit 1
fi

if ! command -v gh &>/dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install gh to proceed."
    exit 1
fi

echo "All required tools are installed."
