#!/bin/bash

# DaVinci Resolve Downloader Build Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building DaVinci Resolve Downloader...${NC}"

# Check if Go is installed
if ! command -v go &>/dev/null; then
	echo -e "${RED}Error: Go is not installed${NC}"
	echo "Please install Go: https://golang.org/dl/"
	exit 1
fi

# Clean previous builds
echo "Cleaning previous builds..."
rm -f dr-downloader dr-downloader-*

# Build for current platform
echo "Building for current platform..."
if go build -o dr-downloader main.go; then
	echo -e "${GREEN}✓ Build successful!${NC}"
	echo -e "Binary created: ${YELLOW}dr-downloader${NC}"
else
	echo -e "${RED}✗ Build failed${NC}"
	exit 1
fi

# Make executable
chmod +x dr-downloader

# Optional: Build for other platforms
read -p "Build for other platforms? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
	echo "Building for Linux AMD64..."
	GOOS=linux GOARCH=amd64 go build -o dr-downloader-linux-amd64 main.go

	echo "Building for Linux ARM64..."
	GOOS=linux GOARCH=arm64 go build -o dr-downloader-linux-arm64 main.go

	echo -e "${GREEN}✓ Cross-platform builds complete!${NC}"
fi

# Optional: Install to system
read -p "Install to /usr/local/bin? (requires sudo) (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
	sudo cp dr-downloader /usr/local/bin/
	echo -e "${GREEN}✓ Installed to /usr/local/bin/dr-downloader${NC}"
fi

echo -e "\n${GREEN}Build complete!${NC}"
echo -e "Run with: ${YELLOW}./dr-downloader${NC}"
echo -e "Or if installed: ${YELLOW}dr-downloader${NC}"
