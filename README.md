# DaVinci Resolve Downloader

Automated downloader for [DaVinci Resolve] (free edition).\
Uses Puppeteer to navigate BMD's AngularJS registration form, capture the CDN download URL, and stream the file to disk.

## Why

BMD requires filling a registration form before downloading. This tool automates that.

On Arch Linux, AUR packages like `davinci-resolve` expect the zip to already exist locally:

```log
==> ERROR: Failure while downloading file://DaVinci_Resolve_XX.X_Linux.zip
```

This tool solves that by downloading the file first.

## Quick start

```bash
git clone https://github.com/kjanat/dr-downloader.git
cd dr-downloader
bun install
bun run start
```

Downloads to `~/Downloads/` by default.

### Prerequisites

- [Bun]
- Chrome (auto-installed by Puppeteer via `postinstall`)

## Usage

```bash
bun run start                              # download (defaults to ~/Downloads/)
bun run start -o ./my-dir                  # custom output directory
bun run start --platform mac               # linux | mac | windows (default: autodetect)
bun run start --email you@example.com      # override registration fields
bun run start --validate-only              # validate config without downloading
bun run start --test                       # test mode: fill form, skip download
bun run start --help                       # show all options
```

### CLI flags

| Flag                 | Description                                     |
| -------------------- | ----------------------------------------------- |
| `-o, --output <dir>` | Download directory (default: `~/Downloads`)     |
| `--platform <p>`     | `linux`, `mac`, `windows` (default: autodetect) |
| `--firstname <name>` | First name                                      |
| `--lastname <name>`  | Last name                                       |
| `--email <email>`    | Email address                                   |
| `--phone <phone>`    | Phone number                                    |
| `--country <code>`   | Country code or full name (e.g. `US`)           |
| `--state <state>`    | State/province (required for US/CA)             |
| `--city <city>`      | City                                            |
| `--street <addr>`    | Street address                                  |
| `--zipcode <zip>`    | Postal code                                     |
| `--company <name>`   | Company (optional)                              |
| `--validate-only`    | Validate config and exit                        |
| `-t, --test`         | Test mode: no actual download                   |

### Environment variables

All registration fields can be set via `DAVINCI_*` env vars. CLI args take precedence.

```bash
export DAVINCI_EMAIL="you@example.com"
export DAVINCI_COUNTRY="US"
export DAVINCI_STATE="California"
export DEFAULT_OUTPUT_PATH="/custom/path"    # override download directory
export DOWNLOAD_TIMEOUT_MS="900000"          # 15 min default
```

Priority: defaults -> env vars -> CLI args.

## How it works

1. Launches headless Chrome via Puppeteer (with anti-detection measures)
2. Navigates to the BMD product page
3. Clicks "Free Download Now" to open the OS selection modal
4. Clicks the target platform link (`ng-click="downloadLatestStable(...)"`), which loads the registration form
5. Fills all form fields and triggers AngularJS validation
6. Clicks "Register & Download"
7. Intercepts the CDN request (`swr.cloud.blackmagicdesign.com`) via Puppeteer request interception
8. Aborts the browser download, streams the file directly via `fetch` with progress tracking

## AUR integration

```bash
# 1. Download
bun run start -o ~/.cache/yay/davinci-resolve/

# 2. Install
yay -S davinci-resolve
```

## CI

A GitHub Actions workflow (`.github/workflows/download.yml`) can run the download on `workflow_dispatch` and upload the artifact.

## Development

```bash
bun run dev          # watch mode
bun run fake         # test mode with mock data
bun run lint         # biome lint
bun run lint:fix     # biome lint --write
bun run format       # dprint fmt
bun run typecheck    # tsgo --noEmit
bun run build        # bundle to dist/
```

### Project structure

```tree
src/
  main.ts                        # entry point
  config/
    types.ts                     # RegistrationData, DownloadConfig, Platform
    ConfigManager.ts             # env + CLI arg loading, validation, defaults
  constants/
    selectors.ts                 # CSS selectors for BMD form fields
  downloader/
    DaVinciDownloader.ts         # orchestrates browse -> form -> download
    FormHandler.ts               # fills and submits the registration form
    StreamDownloader.ts          # streams file from CDN URL to disk
  utils/
    browser.ts                   # Puppeteer launch + anti-detection config
    filesystem.ts                # file utilities
    formatters.ts                # formatFileSize()
  validation/
    ValidationService.ts         # mirrors BMD's Angular validators
```

## Notes

- DaVinci Resolve is proprietary software by Blackmagic Design
- This tool only downloads the publicly available free installer
- Registration data defaults to placeholder values; override with your own

<!--link definitions-->

[DaVinci Resolve]: https://www.blackmagicdesign.com/products/davinciresolve
[Bun]: https://bun.sh/
