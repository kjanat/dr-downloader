# DaVinci Resolve Downloader

Automated downloader for [DaVinci Resolve] (free edition).\
Uses Puppeteer to navigate BMD's AngularJS registration form, capture the CDN
download URL, and stream the file to disk.

## Why

BMD requires filling a registration form before downloading. This tool automates
that.

On Arch Linux, AUR packages like `davinci-resolve` expect the zip to already
exist locally:

```log
==> ERROR: Failure while downloading file://DaVinci_Resolve_XX.X_Linux.zip
```

This tool solves that by downloading the file first.

## Quick start

```bash
# install globally
bun install -g davinci-resolve-downloader

# or run directly
bunx davinci-resolve-downloader
```

Downloads to `~/Downloads/` by default.

### Prerequisites

- [Bun] (or Node.js with npm/npx)
- Chrome (auto-installed by Puppeteer via `postinstall`)

## Usage

```bash
dr-downloader                              # download (defaults to ~/Downloads/)
dr-downloader -o ./my-dir                  # custom output directory
dr-downloader --platform mac               # linux | mac | windows (default: autodetect)
dr-downloader --email you@example.com      # override registration fields
dr-downloader --validate-only              # validate config without downloading
dr-downloader --test                       # test mode: fill form, skip download
dr-downloader --help                       # show all options
```

### CLI flags

| Flag                 | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `-o, --output <dir>` | Download directory (default: `~/Downloads`)            |
| `--aur`              | AUR preset: output to `~/.cache/yay/davinci-resolve/`  |
| `--platform <p>`     | `linux`, `mac`, `windows` (default: autodetect)        |
| `--region <code>`    | BMD support region, 2-letter (e.g. `gb`); default: geo |
| `--firstname <name>` | First name                                             |
| `--lastname <name>`  | Last name                                              |
| `--email <email>`    | Email address                                          |
| `--phone <phone>`    | Phone number                                           |
| `--country <code>`   | Country code or full name (e.g. `US`)                  |
| `--state <state>`    | State/province (required for US/CA)                    |
| `--city <city>`      | City                                                   |
| `--street <addr>`    | Street address                                         |
| `--zipcode <zip>`    | Postal code                                            |
| `--company <name>`   | Company (optional)                                     |
| `--validate-only`    | Validate config and exit                               |
| `-t, --test`         | Test mode: no actual download                          |

### Environment variables

All registration fields can be set via `DAVINCI_*` env vars. CLI args take precedence.

```bash
export DAVINCI_EMAIL="you@example.com"
export DAVINCI_COUNTRY="US"
export DAVINCI_STATE="California"
export DAVINCI_REGION="gb"                   # force BMD support region (2-letter)
export DEFAULT_OUTPUT_PATH="/custom/path"    # override download directory
export DOWNLOAD_TIMEOUT_MS="900000"          # 15 min default
```

Priority: defaults -> env vars -> CLI args.

## How it works

1. Launches headless Chrome via Puppeteer (with anti-detection measures)
2. Navigates to the BMD product page
3. Clicks "Free Download Now" to open the OS selection modal
4. Clicks the target platform link (`ng-click="downloadLatestStable(...)"`),
   which loads the registration form
5. Fills all form fields and triggers AngularJS validation
6. Clicks "Register & Download"
7. Intercepts the CDN request (`swr.cloud.blackmagicdesign.com`) via Puppeteer
   request interception
8. Aborts the browser download, streams the file directly via `fetch` with
   progress tracking

### Region resilience

BMD's `api/support/<region>/downloads.json` endpoint (which drives the form)
intermittently returns `502`. If the form fails to load, the tool reloads and
retries, rotating through alternate regions (`gb`, `au`, `de`, `sg`, `ca`) to
dodge a region-specific outage. Force a specific region with `--region` /
`DAVINCI_REGION` if you know one is healthy.

## AUR integration

```bash
# download directly to yay cache + install
dr-downloader --aur
yay -S davinci-resolve
```

## Notes

- DaVinci Resolve is proprietary software by Blackmagic Design
- This tool only downloads the publicly available free installer
- Registration data defaults to placeholder values; override with your own

<!--link-definitions-->

[DaVinci Resolve]: https://www.blackmagicdesign.com/products/davinciresolve
[Bun]: https://bun.sh/
