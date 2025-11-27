#!/bin/bash

# Create a temporary directory
BASE_DIR=$(pwd)
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Remove package directory if it exists and create a new one
if [ -d "$BASE_DIR/package" ]; then
    echo "Removing existing package directory..."
    rm -rf "$BASE_DIR/package"
fi
echo "Creating package directory..."
mkdir -p "$BASE_DIR/package"

# Navigate to the temp directory
cd $TEMP_DIR

# Download and pack the package
echo "Downloading @decleanup/contracts..."
npm pack "@decleanup/contracts"

# Get the package filename (it will be the only .tgz file in the directory)
PACKAGE_FILE=$(ls *.tgz)
echo "Downloaded package: $PACKAGE_FILE"

# Create a directory to extract the package
mkdir package
cd package

# Extract the package
echo "Extracting package..."
tar -xzf ../$PACKAGE_FILE

# Move the package contents to the correct location
echo "Moving package contents..."
cp -r package/* $BASE_DIR/package/

# Clean up temp directory
cd ../..
rm -rf $TEMP_DIR

# Clean up artifacts and typechain folders
echo "Cleaning up artifacts and typechain folders..."
if [ -d "$BASE_DIR/package/artifacts" ]; then
    rm -rf "$BASE_DIR/package/artifacts"
fi
if [ -d "$BASE_DIR/package/typechain" ]; then
    rm -rf "$BASE_DIR/package/typechain"
fi

echo "Package update complete!" 