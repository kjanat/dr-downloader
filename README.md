# DaVinci Resolve Downloader

A Go-based tool to download DaVinci Resolve for Linux, designed to solve the file download issues with AUR packages.

## Problem

When installing DaVinci Resolve through AUR (e.g., `yay -Syu davinci-resolve`), the package expects the DaVinci Resolve zip file to be available locally. The PKGBUILD uses a `file://` URL which fails if the file isn't already downloaded:

```
==> ERROR: Failure while downloading file://DaVinci_Resolve_20.2_Linux.zip
```

## Solution

This tool downloads the DaVinci Resolve zip file from the official Blackmagic Design servers and places it in the correct location for the AUR package to find.

## Features

- 🚀 Fast downloads with progress tracking
- 📁 Auto-detects AUR cache directories (yay, paru, aurutils)
- ✅ Optional SHA256 checksum verification
- 🔄 Resume support for interrupted downloads
- 📦 Multiple version support
- 🎯 Direct integration with AUR workflow

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/dr-downloader.git
cd dr-downloader

# Build the binary
go build -o dr-downloader main.go

# Optional: Install to PATH
sudo cp dr-downloader /usr/local/bin/
```

### Quick Build

```bash
cd /home/kjanat/projects/dr-downloader
go build
```

## Usage

### Basic Usage (Auto-detect AUR cache)

```bash
# Download to auto-detected AUR cache directory
./dr-downloader

# The tool will automatically find your AUR helper's cache directory
# (e.g., ~/.cache/yay/davinci-resolve/)
```

### Specify Output Location

```bash
# Download to specific directory
./dr-downloader -output ~/Downloads/DaVinci_Resolve_20.2_Linux.zip

# Download to specific AUR cache
./dr-downloader -aur-cache ~/.cache/yay/davinci-resolve
```

### Download Different Version

```bash
# Download version 20.1.1
./dr-downloader -version 20.1.1

# Download version 19.0.3
./dr-downloader -version 19.0.3
```

### Verify Download

```bash
# Verify with checksum (if known)
./dr-downloader -verify -checksum "sha256_hash_here"
```

### Force Redownload

```bash
# Redownload even if file exists
./dr-downloader -force
```

## Integration with AUR

### Method 1: Pre-download Before AUR Install

```bash
# Step 1: Download the file
./dr-downloader

# Step 2: Install via AUR (file will be found automatically)
yay -Syu davinci-resolve
```

### Method 2: Automated Wrapper Script

Create a wrapper script `install-davinci.sh`:

```bash
#!/bin/bash

# Download DaVinci Resolve
echo "Downloading DaVinci Resolve..."
/usr/local/bin/dr-downloader

# Check if download was successful
if [ $? -eq 0 ]; then
    echo "Download complete. Installing via AUR..."
    yay -Syu davinci-resolve
else
    echo "Download failed. Please check your connection and try again."
    exit 1
fi
```

### Method 3: Modified PKGBUILD

You can modify the PKGBUILD to use this downloader:

```bash
# In prepare() function of PKGBUILD, add:
if [ ! -f "DaVinci_Resolve_${pkgver}_Linux.zip" ]; then
    /usr/local/bin/dr-downloader -version ${pkgver}
fi
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-url` | Custom download URL | Official Blackmagic URL |
| `-output` | Output file path | Auto-detect AUR cache |
| `-verify` | Verify SHA256 checksum | false |
| `-checksum` | Expected SHA256 hash | (empty) |
| `-aur-cache` | AUR cache directory | Auto-detect |
| `-force` | Force redownload | false |
| `-version` | DaVinci Resolve version | 20.2 |

## Supported AUR Helpers

The tool auto-detects cache directories for:

- yay
- paru  
- aurutils
- pikaur
- aura

## Troubleshooting

### Download Fails

1. Check your internet connection
2. Verify the URL is still valid
3. Try using a VPN (some regions may be blocked)
4. Use `-force` flag to retry

### File Not Found by AUR

1. Verify the file was downloaded to the correct location:

   ```bash
   ls ~/.cache/yay/davinci-resolve/
   ```

2. Check the PKGBUILD expects the same filename:

   ```bash
   grep "source=" ~/.cache/yay/davinci-resolve/PKGBUILD
   ```

3. Manually specify the AUR cache directory:

   ```bash
   ./dr-downloader -aur-cache ~/.cache/yay/davinci-resolve
   ```

### Checksum Mismatch

The official checksum may have changed. Update the PKGBUILD or skip verification:

```bash
yay -Syu davinci-resolve --skipinteg
```

## Development

### Building

```bash
go build -o dr-downloader main.go
```

### Testing

```bash
go test ./...
```

### Cross-compiling

```bash
# For Windows
GOOS=windows GOARCH=amd64 go build -o dr-downloader.exe

# For macOS
GOOS=darwin GOARCH=amd64 go build -o dr-downloader-mac
```

## Configuration

The `config.yaml` file contains:

- Download URLs for different versions
- Expected checksums
- Mirror URLs
- AUR cache directory paths

## Contributing

Pull requests are welcome! Please update the config.yaml when new DaVinci Resolve versions are released.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Blackmagic Design for DaVinci Resolve
- AUR maintainers for the davinci-resolve package

## Notes

- DaVinci Resolve is proprietary software by Blackmagic Design
- This tool only downloads the publicly available installer
- You must accept Blackmagic Design's license agreement when installing
