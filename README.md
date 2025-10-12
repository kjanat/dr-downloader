# DaVinci Resolve Downloader

A TypeScript/Bun-based tool to download DaVinci Resolve for Linux, designed to solve the file download issues with AUR packages. Uses Puppeteer for browser automation to handle the complete Blackmagic Design authentication flow.

## Problem

When installing DaVinci Resolve through AUR (e.g., `yay -Syu davinci-resolve`), the package expects the DaVinci Resolve zip file to be available locally. The PKGBUILD uses a `file://` URL which fails if the file isn't already downloaded:

```text
==> ERROR: Failure while downloading file://DaVinci_Resolve_20.2_Linux.zip
```

## Solution

This tool downloads the DaVinci Resolve zip file from the official Blackmagic Design servers and places it in the correct location for the AUR package to find.

## Features

- 🚀 **Automatic download** with progress tracking
- 🔐 **Browser automation** with Puppeteer for complete authentication flow
- ✅ **Smart validation** - mirrors Blackmagic Design's exact form requirements
- 📁 Auto-detects AUR cache directories (yay, paru, aurutils, pikaur)
- ⚙️ **Flexible configuration** - CLI args, environment variables, and validation testing
- 🔄 **Network interception** - captures download URLs automatically
- 🧪 **Test mode** with mock credentials for development
- 🎯 Direct integration with AUR workflow
- 📦 TypeScript with full type safety
- 🛡️ **Pre-flight validation** - catch errors before browser launch

## Installation

### Prerequisites

- [Bun](https://bun.sh/) runtime
- Chrome browser (automatically installed by Puppeteer)

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/dr-daVinciDownloader.git
cd dr-daVinciDownloader

# Install dependencies
bun install

# Run the tool
bun run start
```

### Quick Setup

```bash
cd /home/kjanat/projects/dr-daVinciDownloader
bun install
```

## Usage

### Basic Usage (Production Mode)

```bash
# Run with real credentials (will prompt for registration data)
bun run start

# The tool will:
# 1. Launch Chrome browser in headless mode
# 2. Navigate to Blackmagic Design download page
# 3. Fill out the registration form automatically
# 4. Handle country/state selection and policy agreement
# 5. Capture the download URL and start automatic download
# 6. Place the file in the correct AUR cache location
```

### Test Mode (Development)

```bash
# Run in test mode with mock credentials
bun run fake

# Test mode uses predefined mock data:
# - Country: United States
# - State: New York
# - All required fields filled automatically
# - No actual download (captures URL only)
```

### Why Browser Automation is Used

Blackmagic Design uses a complex Angular.js form with dynamic country/state loading and policy agreements. The browser automation approach:

1. **Handles JavaScript**: Properly loads dynamic form elements
2. **Manages Sessions**: Maintains cookies and session state
3. **Captures Downloads**: Intercepts the actual download URL
4. **Reliable Authentication**: Replicates exact browser behavior

### Command Line Options

```bash
# Run in test mode (development)
bun run fake

# Run in production mode
bun run start

# Run with development/watch mode
bun run dev

# Validate configuration without downloading
bun run start --validate-only

# Override specific registration fields
bun run start --email "your@email.com" --country "US" --state "California"

# Format code
bun run format

# Run linter
bun run lint

# Fix linting issues
bun run lint:fix
```

#### Validation and Configuration

The tool includes comprehensive validation that mirrors the exact requirements of Blackmagic Design's website:

```bash
# Test your configuration before downloading
bun run start --validate-only

# See all available options
bun run start --help
```

**Available CLI Arguments:**

- `--firstname <name>` - Your first name
- `--lastname <name>` - Your last name
- `--email <email>` - Valid email address (validated using BMD's exact regex)
- `--phone <phone>` - Phone number (optional, digits/spaces/parentheses/+-only)
- `--country <country>` - Country code (e.g., "US", "UK") or full name
- `--state <state>` - State/Province (required for US/Canada)
- `--city <city>` - City name
- `--street <address>` - Street address
- `--zipcode <zip>` - Postal/ZIP code
- `--company <name>` - Company name (optional)
- `--platform <platform>` - Target platform: linux | mac | windows
- `--validate-only` - Validate configuration and exit
- `--test` - Run in test mode (no actual download)

**Environment Variable Support:**
All registration fields can be set via environment variables:

```bash
export DAVINCI_FIRSTNAME="John"
export DAVINCI_LASTNAME="Doe"
export DAVINCI_EMAIL="john.doe@example.com"
export DAVINCI_PHONE="555-123-4567"
export DAVINCI_COUNTRY="US"
export DAVINCI_STATE="New York"
export DAVINCI_CITY="New York"
export DAVINCI_STREET="123 Main St"
export DAVINCI_ZIPCODE="10001"
export DAVINCI_COMPANY="My Company"

# Then run normally
bun run start
```

### Configuration

The tool automatically:

- Detects AUR cache directories (yay, paru, aurutils, pikaur)
- Handles the latest DaVinci Resolve version (20.2)
- Places files in the correct location for AUR packages

## Integration with AUR

### Method 1: Pre-download Before AUR Install

```bash
# Step 1: Download the file
cd /path/to/dr-daVinciDownloader
bun run start

# Step 2: Install via AUR (file will be found automatically)
yay -Syu davinci-resolve
```

### Method 2: Automated Wrapper Script

Create a wrapper script `install-davinci.sh`:

```bash
#!/bin/bash

# Navigate to dr-daVinciDownloader directory
cd /path/to/dr-daVinciDownloader

# Download DaVinci Resolve
echo "Downloading DaVinci Resolve..."
bun run start

# Check if download was successful
if [ $? -eq 0 ]; then
    echo "Download complete. Installing via AUR..."
    yay -Syu davinci-resolve
else
    echo "Download failed. Please check your connection and try again."
    exit 1
fi
```

## Available Scripts

| Script       | Description                    | Usage                |
|--------------|--------------------------------|----------------------|
| `start`      | Run production mode           | `bun run start`      |
| `fake`       | Run test mode with mock data  | `bun run fake`       |
| `dev`        | Run with file watching        | `bun run dev`        |
| `format`     | Format code with Biome        | `bun run format`     |
| `lint`       | Check code quality            | `bun run lint`       |
| `lint:fix`   | Auto-fix linting issues       | `bun run lint:fix`   |

## Supported AUR Helpers

The tool auto-detects cache directories for:

- yay
- paru  
- aurutils
- pikaur
- aura

## Troubleshooting

### Validation Errors

The tool validates all input using Blackmagic Design's exact requirements:

#### Email Validation Errors

```text
❌ Please enter a valid email address
```

**Solution:** Use a properly formatted email address (e.g., `user@domain.com`)

#### Phone Validation Errors

```text
❌ Phone number can only contain numbers, spaces, parentheses, plus and minus signs
```

**Solution:** Use format like `555-123-4567`, `(555) 123-4567`, or `+1 555 123 4567`

#### Country/State Validation

```text
❌ State/Province is required
```

**Solution:** US and Canada require state/province selection

#### Configuration Validation

If you see validation errors at startup:

1. **Check your environment variables:**

   ```bash
   # List all DAVINCI_* variables
   env | grep DAVINCI_
   ```

2. **Validate your configuration:**

   ```bash
   bun run start --validate-only
   ```

3. **Fix specific fields:**

   ```bash
   # Override problematic fields
   bun run start --email "valid@email.com" --phone "555-123-4567"
   ```

### Download Fails

1. Check your internet connection
2. Verify the URL is still valid
3. Try using a VPN (some regions may be blocked)
4. Validate your registration data first: `bun run start --validate-only`

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
   ./dr-daVinciDownloader -aur-cache ~/.cache/yay/davinci-resolve
   ```

### Checksum Mismatch

The official checksum may have changed. Update the PKGBUILD or skip verification:

```bash
yay -Syu davinci-resolve --skipinteg
```

## Development

### Tech Stack

- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Language**: TypeScript
- **Browser Automation**: Puppeteer
- **Code Quality**: Biome (formatting & linting)
- **Type Safety**: Full TypeScript with strict mode

### Development Workflow

```bash
# Install dependencies
bun install

# Run in development mode (with file watching)
bun run dev

# Run tests with mock data
bun run fake

# Format code
bun run format

# Check code quality
bun run lint

# Auto-fix linting issues
bun run lint:fix
```

### Key Files

- `daVinciDownloader.ts` - Main application logic
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `biome.jsonc` - Code quality configuration

## Architecture

### Browser Automation Flow

1. **Launch**: Puppeteer launches Chrome in headless mode
2. **Navigate**: Goes to Blackmagic Design download page
3. **Form Fill**: Automatically fills registration form with provided data
4. **Dynamic Loading**: Waits for country/state dropdowns to load
5. **Policy Agreement**: Checks required policy checkbox
6. **Download Trigger**: Clicks the download button
7. **URL Capture**: Intercepts the download URL via network monitoring
8. **File Download**: Automatically downloads the file to AUR cache
9. **Progress Tracking**: Shows download progress and completion

### Network Interception

The tool uses Puppeteer's network interception to:

- Monitor all HTTP requests
- Capture the authenticated download URL
- Start automatic download when URL is detected
- Handle redirects and authentication tokens

## Contributing

Pull requests are welcome!

### Code Quality Standards

- Use TypeScript with strict type checking
- Follow Biome formatting and linting rules
- Test all changes with `bun run fake` before submitting
- Ensure all linting passes with `bun run lint`

### Adding New Features

1. Update TypeScript types as needed
2. Add test scenarios to verify functionality
3. Update documentation
4. Ensure backward compatibility

## License

MIT License—see LICENSE file for details

## Acknowledgments

- Blackmagic Design for DaVinci Resolve
- AUR maintainers for the davinci-resolve package

## Notes

- DaVinci Resolve is proprietary software by Blackmagic Design
- This tool only downloads the publicly available installer
- You must accept Blackmagic Design's license agreement when installing
