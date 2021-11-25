# Makefile

VERSION = 0.2.5

build:
	7z a -tzip -r zotero-swisscovery-ubbern-locations-$(VERSION).xpi chrome/* defaults/* chrome.manifest install.rdf options.xul