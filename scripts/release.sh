#!/bin/bash
set -euo pipefail

# Get environment variables
export $(grep -v '^#' .env | xargs)

# Get the base name and version from command-line arguments
baseName=$1
VERSION=$2

# Check if updatehash is correct
echo "Checking update_hash"

calc_hash="sha256:$(shasum -a 256 "${BUILD_DIR}/${BASE_NAME}-${VERSION}.xpi" | cut -d' ' -f1)"
hash_in_json=$(jq -r --arg pluginID "$PLUGIN_ID" '.addons[$pluginID].updates[0].update_hash' "$UPDATE_JSON_FILE")

echo "Calculated update_hash: $calc_hash"
echo "update_hash in $UPDATE_JSON_FILE: $hash_in_json"

if [ "$calc_hash" != "$hash_in_json" ]
then 
    echo "Update_hash not valid"
    exit 1 
else 
    echo "Update_hash valid"
fi

# Get release notes
echo "Extract release notes from ${CHANGELOG}"
echo "## Changes" >> release-notes-${VERSION}.md
sed -n "/## v${VERSION}/,/^## /p" ${CHANGELOG} | sed '1d;$d' >> release-notes-${VERSION}.md
echo "Extracted release notes from ${CHANGELOG}"

# Create release
echo "Creating release $VERSION"
gh release create v${VERSION} ${BUILD_DIR}/${BASE_NAME}-${VERSION}.xpi -t "v${VERSION}" --notes-file release-notes-${VERSION}.md
echo "Created release $VERSION"

# Cleanup
echo "Cleaning up"
rm release-notes-${VERSION}.md
echo "Deleted release-notes-${VERSION}.md"