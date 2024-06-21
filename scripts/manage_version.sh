#!/bin/bash
set -euo pipefail

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Get the last tag
last_tag=$(git describe --tags --abbrev=0 || echo "No tags found")
echo "Last tag: $last_tag"

# Get the current version number from manifest.json
current=$(jq -r '.version' "$MANIFEST_JSON")
echo "Current version in manifest.json: $current"

# Ask for the new version number
read -r -p "Enter new version number (without v), or press enter to use current version [$current]: " version
version="${version:-$current}"
echo "Next version set to: $version"

# Update files only if the version number has changed
if [ "$current" != "$version" ]; then
    # Update manifest.json
    jq --arg ver "$version" '.version = $ver' "$MANIFEST_JSON" > temp.json && mv temp.json "$MANIFEST_JSON"
    
    # Update install.rdf
    perl -pi -e "s/em:version=\"[^\"]*\"/em:version=\"$version\"/" "$INSTALL_RDF"
    
    # Commit changes if any
    git add "$MANIFEST_JSON" #"$INSTALL_RDF"
    git commit -m "bump version to $version"

else
    echo "Version number has not changed. No updates made."
fi

