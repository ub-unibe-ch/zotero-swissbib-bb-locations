#!/bin/bash
set -euo pipefail

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Get the current date and time in the format "YYYYMMDDHHMM"
timestamp=$(date +"%Y%m%d%H%M")

# Get the base name and version from command-line arguments
baseName=${1:-$BASE_NAME}
version=${2:-$timestamp}

echo "Building ${baseName}-${version}"

# Create build folder
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Create build zip
cd src
zip -r "../${BUILD_DIR}/${baseName}-${version}.xpi" *
cd ..

# Check if the build output file exists
if [ ! -f "${BUILD_DIR}/${baseName}-${version}.xpi" ]; then
    echo "Error: Build output file not found!"
    exit 1
fi

echo "Build successful: ${BUILD_DIR}/${baseName}-${version}.xpi"
