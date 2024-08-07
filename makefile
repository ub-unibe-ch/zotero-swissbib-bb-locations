# Makefile

.PHONY: help release check-tools version phony update-files pr clean

# Helper to source .env and get variables
GET_VAR = ./scripts/get_env_var.sh

# Define variables by sourcing .env
BASE_NAME := $(shell $(GET_VAR) BASE_NAME)
BUILD_DIR := $(shell $(GET_VAR) BUILD_DIR)
MANIFEST_JSON= $(shell $(GET_VAR) MANIFEST_JSON)
UPDATE_JSON_FILE := $(shell $(GET_VAR) UPDATE_JSON_FILE)
UPDATE_RDF_FILE := $(shell $(GET_VAR) UPDATE_RDF_FILE)

# Function to get version from manifest.json
define get_version
$(shell jq -r '.version' src/manifest.json)
endef

# Get initial version
VERSION := $(call get_version)
XPI_FILE := $(BUILD_DIR)/$(BASE_NAME)-$(VERSION).xpi

# Export environment variables to make them available in scripts
export XPI_FILE 
export VERSION

#########################
# Build targets
#########################

# Default Target
.DEFAULT_GOAL := help

# Define dependencies

release:
	./scripts/release.sh $(BASE_NAME) $(call get_version)

pr: update-files
	./scripts/manage_pr.sh

update-files: build
	./scripts/update_files.sh
	cp $(UPDATE_JSON_FILE) $(UPDATE_RDF_FILE)

build: $(BUILD_DIR)/$(BASE_NAME)-$(call get_version).xpi

# Build target, depends on manifest.json and source files
$(BUILD_DIR)/$(BASE_NAME)-$(call get_version).xpi: $(wildcard src/*) $(MANIFEST_JSON)
	./scripts/build.sh $(BASE_NAME) $(call get_version)

version: $(MANIFEST_JSON)

$(MANIFEST_JSON): check-tools
	./scripts/manage_version.sh
	$(eval VERSION := $(call get_version))
	$(eval export VERSION)	
	
check-tools:
	./scripts/check_tools.sh

clean:
	rm -f $(BUILD_DIR)/*.xpi

help:
	@echo "No target specified."
	@echo "Usage:"
	@echo "  help    - Show help"
	@echo "  pr      - PR workflow"
	@echo "  release - Release workflow"
	@echo "  clean   - Cleanup"