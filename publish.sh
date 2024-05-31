#!/bin/bash

version="$1"
if [ -z "$version" ]; then
	read -p "Enter new version number: " version
fi

assetname=zotero-swisscovery-ubbern-locations
updatelink=https://github.com/ub-unibe-ch/zotero-swissbib-bb-locations/releases/download/${version}/${assetname}-${version}.xpi


jq ".addons[\"zoteroswisscoveryubbernlocations@ubbe.org\"].updates[0].update_hash = \"sha256:`shasum -a 256 build/${assetname}-${version}.xpi | cut -d' ' -f1`\"" updates.json.tmpl |
jq --arg version "$version" '.addons["zoteroswisscoveryubbernlocations@ubbe.org"].updates[0].version = $version' |
jq --arg updatelink "$updatelink" '.addons["zoteroswisscoveryubbernlocations@ubbe.org"].updates[0].update_link = $updatelink' > updates.json
cp updates.json update.rdf


git add src/install.rdf update.rdf updates.json # src/manifest.json
git commit -m "Release $version" 1>&2
git tag -a -m "Release $version" "$version"

