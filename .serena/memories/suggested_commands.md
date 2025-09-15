# Suggested Commands for dr-downloader (TypeScript/Bun)

## Development Commands

```bash
# Install dependencies
bun install

# Run in production mode
bun run start

# Run in test mode (with mock credentials)
bun run fake

# Development mode with file watching
bun run dev
```

## Code Quality Commands

```bash
# Format code with Biome
bun run format

# Run linting checks
bun run lint

# Auto-fix linting issues
bun run lint:fix

# Type checking (if configured)
bunx tsc --noEmit
```

## Testing Commands

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test tests/downloader.test.ts

# Run tests with verbose output
bun test --verbose

# Run tests with timeout for long operations
bun test --timeout 60000
```

## Application Usage

```bash
# Basic usage - production mode with real credentials
bun run start

# Test mode - uses mock credentials (US, New York)
bun run fake

# Development mode - watches for file changes
bun run dev
```

## Browser Automation Features

The application handles:

- Automatic form filling with provided registration data
- Dynamic country/state dropdown selection
- Policy agreement checkbox automation
- Download URL capture via network interception
- Automatic file download to AUR cache directories

## AUR Integration Commands

```bash
# Step 1: Download DaVinci Resolve
cd /path/to/dr-downloader
bun run start

# Step 2: Install via AUR (file will be found automatically)
yay -Syu davinci-resolve

# Alternative: Use test mode for development
bun run fake  # Captures URL without downloading
```

## Debugging Commands

```bash
# Run with debug output
DEBUG=true bun run fake

# Show browser interactions (non-headless)
HEADLESS=false bun run fake

# Detailed browser operations
DEBUG=puppeteer:* bun run fake
```
