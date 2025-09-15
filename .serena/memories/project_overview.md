# dr-downloader Project Overview

## Purpose

TypeScript/Bun-based downloader tool that solves the AUR DaVinci Resolve installation problem. The AUR package expects a local file but uses a `file://` URL that fails. This tool uses browser automation to handle the complete Blackmagic Design authentication flow and automatically downloads the DaVinci Resolve zip file.

## Tech Stack

- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Language**: TypeScript with strict type checking
- **Browser Automation**: Puppeteer for Chrome automation
- **Code Quality**: Biome for formatting and linting
- **Testing**: Bun test framework with TypeScript support

## Core Architecture

- **downloader.ts**: Main application with browser automation and download logic
- **package.json**: Dependencies, scripts, and project configuration
- **tsconfig.json**: TypeScript compiler configuration
- **biome.jsonc**: Code quality and formatting configuration
- **tests-examples/**: Playwright example tests for browser interaction patterns

## Key Features

- **Browser Automation**: Uses Puppeteer to handle complex Angular.js forms
- **Form Filling**: Automatically fills registration forms with country/state selection
- **Network Interception**: Captures download URLs via Puppeteer's network monitoring
- **Automatic Download**: Downloads files directly when URLs are captured
- **Progress Tracking**: Shows real-time download progress and completion
- **AUR Integration**: Places files in correct AUR cache directories
- **Test Mode**: Development mode with mock credentials for testing

## Authentication Flow

1. Launch Chrome browser in headless mode
2. Navigate to Blackmagic Design download page
3. Fill registration form with provided/mock data
4. Handle dynamic country/state dropdown loading
5. Check required policy agreement checkbox
6. Click download button to trigger authentication
7. Intercept the authenticated download URL
8. Start automatic file download to AUR cache
9. Track progress until completion

## Available Commands

- `bun run start` - Run in production mode
- `bun run fake` - Run in test mode with mock credentials
- `bun run dev` - Development mode with file watching
- `bun run lint` - Code quality checks with Biome
- `bun run lint:fix` - Auto-fix linting issues
- `bun run format` - Format code with Biome
