# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

This is a Go-based downloader tool that solves the AUR DaVinci Resolve installation problem. The AUR package expects a local file but uses a `file://` URL that fails. This tool downloads the DaVinci Resolve zip from official Blackmagic Design servers and places it in the correct AUR cache location.

## Architecture

### Core Components

- **main.go**: Main application with HTTP download logic, progress tracking, and checksum verification
- **config.yaml**: Version definitions, URLs, checksums, and AUR cache paths
- **build.sh**: Build script with cross-platform compilation options
- **install-davinci.sh**: Complete integration script that downloads then runs AUR installation

### Key Features

- Auto-detects AUR helper cache directories (yay, paru, aurutils, pikaur, aura)
- Progress tracking with size/percentage display
- SHA256 checksum verification (optional)
- Resume support for interrupted downloads
- Multiple version support via configuration
- Direct AUR workflow integration

## Common Development Commands

```bash
# Build the application
go build -o dr-downloader main.go

# Build with script (includes cross-platform options)
./build.sh

# Test download (dry run to current directory)
./dr-downloader -output ./test-download.zip

# Test with specific version
./dr-downloader -version 19.0.3 -output ./test-v19.zip

# Run complete installation workflow
./install-davinci.sh

# Run with force redownload
./install-davinci.sh --force

# Run for specific version
./install-davinci.sh --version 20.1.1
```

## Code Structure

### Downloader struct

- Handles HTTP client, timeout management, and progress tracking
- Implements SHA256 checksum verification
- Manages temp file operations for atomic downloads

### URL Management

- Supports version-based URL generation
- Configurable via config.yaml for easy updates
- Fallback to direct URL specification via `-url` flag

### AUR Integration Logic

1. Auto-detects AUR helper type (yay, paru, etc.)
2. Locates corresponding cache directory
3. Downloads file with correct naming convention
4. Provides feedback for successful AUR package usage

## Configuration Updates

When new DaVinci Resolve versions are released:

1. Update `config.yaml` with new version entry:

   ```yaml
   versions:
     20.3:  # New version
       url: "https://swr.cloud.blackmagicdesign.com/DaVinciResolve/v20.3/DaVinci_Resolve_20.3_Linux.zip"
       filename: "DaVinci_Resolve_20.3_Linux.zip"
       sha256: "new_checksum_here"
       size_mb: 3600
   ```

2. Update `DefaultDownloadURL` and `DefaultFilename` constants in main.go

3. Test with: `./dr-downloader -version 20.3`

## Integration Points

- **AUR Cache Detection**: Checks common locations in user home directory
- **Error Handling**: Provides clear feedback for network issues, disk space, permissions
- **Progress Reporting**: Real-time download progress with MB/percentage tracking
- **Atomic Operations**: Uses temp files to prevent corrupted partial downloads

## Testing Strategy

- Test auto-detection of different AUR helpers
- Verify downloads work with various network conditions
- Test resume functionality for interrupted downloads
- Validate checksum verification works correctly
- Test version switching and URL generation

## Dependencies

- Go 1.19+ (uses standard library only)
- No external Go dependencies
- Shell scripts require bash
- Compatible with major AUR helpers (yay, paru, aurutils, pikaur, aura)

## Security Considerations

- Downloads from official Blackmagic Design CDN only
- SHA256 checksum verification available
- No credential storage or authentication required
- Uses HTTPS for all downloads
- Temp file cleanup on failures
