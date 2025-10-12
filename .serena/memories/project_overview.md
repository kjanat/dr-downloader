# dr-downloader Project Overview

## Purpose

Go-based downloader tool that solves the AUR DaVinci Resolve installation problem. The AUR package expects a local file but uses a `file://` URL that fails. This tool downloads the DaVinci Resolve zip from official Blackmagic Design servers and places it in the correct AUR cache location.

## Tech Stack

- **Language**: Go (1.19+)
- **Dependencies**: Standard library only
- **Platform**: Linux (primary), cross-platform support
- **Build Tool**: Go build + Make + shell scripts
- **Testing**: Go test with comprehensive test suite

## Core Architecture

- **main.go**: Main application with HTTP download logic, progress tracking, and checksum verification
- **auth.go**: Authentication system for Blackmagic Design servers
- **config.yaml**: Version definitions, URLs, checksums, and AUR cache paths
- **Makefile**: Build automation and testing commands
- **Shell scripts**: Integration and installation helpers

## Key Features

- Auto-detects AUR helper cache directories (yay, paru, aurutils, pikaur, aura)
- Progress tracking with a size / percentage display
- SHA256 checksum verification (optional)
- Resume support for interrupted downloads
- Multiple version support via configuration
- Direct AUR workflow integration
- Authentication with Blackmagic Design for legitimate downloads
