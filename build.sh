#!/bin/bash

version="$1"
if [ -z "$version" ]; then
	read -p "Enter new version number: " version
fi

echo "Building version ${version}"

assetname=zotero-swisscovery-ubbern-locations

## Update install.rdf and manifest.json

perl -pi -e "s/em:version=\"[^\"]*/em:version=\"$version/;" src/install.rdf
# perl -pi -e "s/\"version\": \"[^\"]*\"/\"version\": \"$version\"/" src/manifest.json

# Create build folder
rm -rf build
mkdir build

# Create build zip
zip -r build/${assetname}-${version}.xpi src/*