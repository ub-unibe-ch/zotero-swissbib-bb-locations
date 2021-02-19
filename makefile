# Makefile

VERSION = 0.21

build:
	7z a -tzip -r zotero-swisscovery-ubbern-locations-$(VERSION).xpi chrome/* chrome.manifest install.rdf options.xul