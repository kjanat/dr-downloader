#!/bin/bash

# DaVinci Resolve Installation Helper
# This script downloads the DaVinci Resolve installer and then runs the AUR installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     DaVinci Resolve AUR Installation Helper${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Function to detect AUR helper
detect_aur_helper() {
	if command -v yay &>/dev/null; then
		echo "yay"
	elif command -v paru &>/dev/null; then
		echo "paru"
	elif command -v aurutils &>/dev/null; then
		echo "aur"
	elif command -v pikaur &>/dev/null; then
		echo "pikaur"
	else
		echo ""
	fi
}

# Check for AUR helper
AUR_HELPER=$(detect_aur_helper)

if [ -z "$AUR_HELPER" ]; then
	echo -e "${RED}Error: No AUR helper found${NC}"
	echo "Please install one of: yay, paru, aurutils, or pikaur"
	exit 1
fi

echo -e "${GREEN}✓ Found AUR helper: ${AUR_HELPER}${NC}"

# Check if dr-downloader exists
DOWNLOADER=""
if [ -f "./dr-downloader" ]; then
	DOWNLOADER="./dr-downloader"
elif command -v dr-downloader &>/dev/null; then
	DOWNLOADER="dr-downloader"
else
	echo -e "${YELLOW}Building dr-downloader...${NC}"
	if [ -f "./main.go" ]; then
		go build -o dr-downloader main.go
		DOWNLOADER="./dr-downloader"
	else
		echo -e "${RED}Error: dr-downloader not found and cannot build${NC}"
		echo "Please build it first with: go build -o dr-downloader main.go"
		exit 1
	fi
fi

# Parse command line arguments
VERSION="20.2"
FORCE=""
SKIP_DOWNLOAD=""

while [[ $# -gt 0 ]]; do
	case $1 in
	--version)
		VERSION="$2"
		shift 2
		;;
	--force)
		FORCE="-force"
		shift
		;;
	--skip-download)
		SKIP_DOWNLOAD="yes"
		shift
		;;
	--help)
		echo "Usage: $0 [options]"
		echo "Options:"
		echo "  --version VERSION    DaVinci Resolve version (default: 20.2)"
		echo "  --force             Force redownload even if file exists"
		echo "  --skip-download     Skip download step (use existing file)"
		echo "  --help              Show this help message"
		exit 0
		;;
	*)
		echo -e "${RED}Unknown option: $1${NC}"
		exit 1
		;;
	esac
done

# Download DaVinci Resolve
if [ "$SKIP_DOWNLOAD" != "yes" ]; then
	echo -e "\n${YELLOW}Step 1: Downloading DaVinci Resolve ${VERSION}...${NC}"
	if ! $DOWNLOADER -version "$VERSION" $FORCE; then
		echo -e "${RED}✗ Download failed${NC}"
		echo "Please check your internet connection and try again"
		exit 1
	fi

	echo -e "${GREEN}✓ Download complete${NC}"
else
	echo -e "\n${YELLOW}Skipping download step${NC}"
fi

# Clean existing builds (optional)
echo -e "\n${YELLOW}Step 2: Cleaning previous build files...${NC}"
case $AUR_HELPER in
yay)
	yay -Scc --noconfirm davinci-resolve 2>/dev/null || true
	;;
paru)
	paru -Scc --noconfirm davinci-resolve 2>/dev/null || true
	;;
esac

# Install via AUR
echo -e "\n${YELLOW}Step 3: Installing DaVinci Resolve via AUR...${NC}"
echo -e "${BLUE}This may take a while as it extracts and installs the large package${NC}\n"

install_success=false
case $AUR_HELPER in
yay)
	if yay -S davinci-resolve --noconfirm; then
		install_success=true
	fi
	;;
paru)
	if paru -S davinci-resolve --noconfirm; then
		install_success=true
	fi
	;;
aurutils)
	if aur sync davinci-resolve && sudo pacman -S davinci-resolve; then
		install_success=true
	fi
	;;
pikaur)
	if pikaur -S davinci-resolve --noconfirm; then
		install_success=true
	fi
	;;
esac

if [ "$install_success" = true ]; then
	echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
	echo -e "${GREEN}✓ DaVinci Resolve installation complete!${NC}"
	echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"

	echo -e "${BLUE}You can now run DaVinci Resolve with:${NC}"
	echo -e "  ${YELLOW}davinci-resolve${NC}"
	echo -e "\n${BLUE}Or find it in your application menu${NC}"

	# Check for common issues
	echo -e "\n${YELLOW}Post-installation notes:${NC}"
	echo "• If DaVinci Resolve doesn't start, check GPU drivers"
	echo "• For NVIDIA: ensure you have proprietary drivers installed"
	echo "• For AMD: ensure you have AMDGPU-PRO or ROCm installed"
	echo "• You may need to add your user to the 'video' group:"
	echo -e "  ${YELLOW}sudo usermod -a -G video \$USER${NC}"
	echo "  Then log out and back in"
else
	echo -e "\n${RED}✗ Installation failed${NC}"
	echo "Please check the error messages above"
	echo "Common issues:"
	echo "• Missing dependencies"
	echo "• Insufficient disk space"
	echo "• Package conflicts"
	exit 1
fi
