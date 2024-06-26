#!/bin/bash
set -euo pipefail

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# VERSION=$(jq -r '.version' src/manifest.json)

echo "Updating update manifests for $BASE_NAME-$VERSION"

updatelink="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}/${BASE_NAME}-${VERSION}.xpi"
update_hash="sha256:$(shasum -a 256 "${BUILD_DIR}/${BASE_NAME}-${VERSION}.xpi" | cut -d' ' -f1)"

jq --arg version "$VERSION" \
    --arg updatelink "$updatelink" \
    --arg updatehash "$update_hash" \
    --arg pluginID "$PLUGIN_ID" \
   '.addons[$pluginID].updates[0].version = $version |
    .addons[$pluginID].updates[0].update_link = $updatelink |
    .addons[$pluginID].updates[0].update_hash = $updatehash' \
   "$UPDATE_TEMPLATE_FILE" > "$UPDATE_JSON_FILE"

cp "$UPDATE_JSON_FILE" "$UPDATE_RDF_FILE"

# Commit changes if any
git add "$UPDATE_JSON_FILE" "$UPDATE_RDF_FILE"
if ! git diff-index --quiet HEAD -- "$UPDATE_JSON_FILE" "$UPDATE_RDF_FILE"; then
    git commit -m "Update $UPDATE_JSON_FILE and $UPDATE_RDF_FILE"
fi
