# Makefile

VERSION = 0.1.5

build:
	7z a -tzip -r zotero-swissbib-bb-locations-$(VERSION).xpi chrome/* chrome.manifest install.rdf options.xul