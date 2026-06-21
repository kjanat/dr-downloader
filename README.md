# DaVinci Resolve Downloader

[![NPM](https://img.shields.io/npm/v/davinci-resolve-downloader?logo=npm&labelColor=CB3837&color=black)][npm]

Automated downloader for [DaVinci Resolve] (free edition).\
Uses Puppeteer to navigate BMD's AngularJS registration form, capture the CDN
download URL, and stream the file to disk. The CLI is built with
[@kjanat/dreamcli].

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

**First time? Start with `--init`.** It writes a starter config file (pre-wired
with a JSON [`$schema`](schema/config.schema.json) for editor autocompletion)
and opens it in your `$EDITOR`, so you can fill in your registration details
with context instead of being cold-prompted for them:

```bash
npx davinci-resolve-downloader --init   # alias: --init-config
```

Edit the file (name, email, country, …), save, then run a bare download:

```bash
# run directly (no install)
npx davinci-resolve-downloader

# or install globally, then run `dr-downloader`
npm install -g davinci-resolve-downloader
dr-downloader
```

The package is `davinci-resolve-downloader`; the binary it installs is
`dr-downloader`. `npx davinci-resolve-downloader` works because npx infers the
bin, but if you'd rather be explicit:
`npx --package davinci-resolve-downloader dr-downloader`.

Downloads to `~/Downloads/` by default.

> [!TIP]
> A bare interactive run will prompt for **First name / Last name / Email
> / Phone** if you haven't supplied them yet (via the config above, a flag, or a
> `DAVINCI_*` env var) — that's the info BMD's registration form requires. Set
> them once with `--init` and the prompts go away. See
> [Registration details](#registration-details) and [Config file](#config-file).

<details>
<summary>Bun, pnpm, or Deno</summary>

```bash
# Bun
bunx davinci-resolve-downloader              # or: bun install -g davinci-resolve-downloader

# pnpm
pnpm dlx davinci-resolve-downloader          # or: pnpm add -g davinci-resolve-downloader

# Deno
deno run -A npm:davinci-resolve-downloader
```

Deno doesn't run npm `postinstall`, so it won't auto-download Chrome — point
Puppeteer at an existing browser via `PUPPETEER_EXECUTABLE_PATH` when using it.

</details>

> [!NOTE]
> Installing pulls in Chrome via Puppeteer's `postinstall` hook — the
> first install does a one-time browser download.

### Prerequisites

- Node.js with `npm`/`npx` (default) — or [Bun], pnpm, or Deno
- Chrome (auto-installed by Puppeteer via `postinstall`)

## Usage

```bash
dr-downloader --init                       # set up a config file first (alias: --init-config)
dr-downloader                              # download (defaults to ~/Downloads/)
dr-downloader -o ./my-dir                  # custom output directory
dr-downloader --platform mac               # linux | mac | windows | winarm (default: autodetect)
dr-downloader --email you@example.com      # override registration fields
dr-downloader --validate-only              # validate config without downloading
dr-downloader --test                       # test mode: fill form, skip download
dr-downloader --help                       # show all options
```

### CLI flags

| Flag                 | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `--init`             | Write a starter config file (with `$schema`) and open it in `$EDITOR` (alias `--init-config`) |
| `-o, --output <dir>` | Download directory (default: `~/Downloads`)                                                   |
| `--aur`              | AUR preset: output to the paru/yay clone dir (paru preferred), platform `linux`               |
| `--platform <p>`     | `linux`, `mac`, `windows`, `winarm` (default: autodetect)                                     |
| `--region <code>`    | BMD support region, 2-letter (e.g. `gb`); default: geo                                        |
| `--config <path>`    | Load config from an explicit path (overrides auto-discovery)                                  |
| `--validate-only`    | Validate config and exit                                                                      |
| `-t, --test`         | Test mode: no actual download                                                                 |
| `--firstname <name>` | First name (BMD form)                                                                         |
| `--lastname <name>`  | Last name (BMD form)                                                                          |
| `--email <email>`    | Email address (BMD form)                                                                      |
| `--phone <phone>`    | Phone number (BMD form)                                                                       |
| `--country <code>`   | Country code or full name, e.g. `US` (BMD form)                                               |
| `--state <state>`    | State/province, required for US/CA (BMD form)                                                 |
| `--city <city>`      | City (BMD form)                                                                               |
| `--street <addr>`    | Street address (BMD form)                                                                     |
| `--zipcode <zip>`    | Postal code (BMD form)                                                                        |
| `--company <name>`   | Company, optional (BMD form)                                                                  |

### Registration details

On a plain interactive run (`dr-downloader` in a terminal), the tool prompts for
the personal-identity fields BMD's form requires — **First name**, **Last
name**, **Email**, **Phone** — when you haven't already supplied them. That's
the same info you'd type into the form by hand, so you register as yourself
instead of as the placeholder. Anything provided via a flag, `DAVINCI_*` env
var, or a config file is used as-is and skips its prompt.

Prompts are skipped when there's nothing to interactively type into:

- **non-interactive contexts** (CI, piped input, the chained AUR build) — falls
  back to the obviously-fake placeholder data (and warns you it did)
- **`--aur`** (the unattended build path), **`--init`**, **`--validate-only`**

The address fields stay at their placeholder/config/flag value; only the
identity fields are prompted.

### Environment variables

All registration fields can be set via `DAVINCI_*` env vars. CLI args take
precedence.

```bash
export DAVINCI_EMAIL="you@example.com"
export DAVINCI_COUNTRY="US"
export DAVINCI_STATE="California"
export DAVINCI_REGION="gb"                   # force BMD support region (2-letter)
export DAVINCI_OUTPUT_DIR="/custom/path"      # override download directory
export DAVINCI_TIMEOUT_MS="900000"            # download timeout (15 min default)
export DAVINCI_RETRY_ATTEMPTS="3"             # download retry attempts
export DAVINCI_PLATFORM="linux"               # override platform autodetect
```

`DAVINCI_PLATFORM` (`linux` | `mac` | `windows` | `winarm`) bypasses
autodetection. It's the escape hatch on **ARM Linux**, where there is no BMD
build: autodetect fails fast, and `DAVINCI_PLATFORM=linux` forces the x86_64
download. The `--platform` flag, when given, takes precedence over it.

Priority: CLI args -> env vars -> config file -> interactive prompt -> built-in
defaults. (The prompt only fills the identity fields on a bare interactive run;
see [Registration details](#registration-details).)

### Config file

Any flag can also be set in a JSON config file. It is discovered, in order, at:

- `./.davinci-resolve-downloader.json` (current directory)
- `./davinci-resolve-downloader.config.json` (current directory)
- the per-user config directory (platform-specific):
  - **Linux/macOS**: `$XDG_CONFIG_HOME/davinci-resolve-downloader/config.json`
    (defaults to `~/.config/davinci-resolve-downloader/config.json`)
  - **Windows**: `%APPDATA%\davinci-resolve-downloader\config.json` (defaults to
    `%USERPROFILE%\AppData\Roaming\…`)
- any path passed with `--config <path>`

> [!IMPORTANT]
> macOS uses `~/.config`, **not** `~/Library/Application Support`.

The fastest way to create one is `dr-downloader --init`: it writes a
fully-populated starter file to the per-user config path above (without
clobbering an existing one) and opens it in your editor. The file is pre-wired
with a [`$schema`](schema/config.schema.json) reference, so editors that
understand JSON Schema give you autocompletion (a dropdown of valid `country`
and `region` codes) and validate fields the same way BMD's registration form
does (email/phone format, etc.).

Keys match the flag names:

```json
{
  "$schema": "https://raw.githubusercontent.com/kjanat/dr-downloader/master/schema/config.schema.json",
  "country": "US",
  "state": "California",
  "region": "gb",
  "output": "/home/me/Downloads",
  "retryAttempts": 5
}
```

Every key is optional — a config is a partial override layer, so a file with
just `{"region":"gb"}` is valid. Whether the _fully resolved_ registration has
everything BMD requires (and the US/CA "state required" rule) is checked at run
time, not against the file alone.

A leading `~` in `output` (or in `DAVINCI_OUTPUT_DIR` / `DAVINCI_AUR_DIR`) is
expanded to your home directory — `"output": "~/Downloads"` works. On the CLI
your shell already expands `~`, but inside a config file or a quoted env var it
wouldn't, so the tool does it itself.

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

The `davinci-resolve` PKGBUILD declares a local source
(`source=("file://DaVinci_Resolve_${pkgver}_Linux.zip")`) and expects the zip to
already sit **in the clone directory** next to the PKGBUILD. Without it, makepkg
hands the relative `file://` URL to curl and fails:

```log
curl: (3) URL rejected: Bad file:// URL
==> ERROR: Failure while downloading file://DaVinci_Resolve_21.0_Linux.zip
```

The zip just needs to sit beside the PKGBUILD. The cleanest flow clones the
PKGBUILD into the current directory (that's where `-G` puts it), downloads the
zip there, then builds:

```bash
# paru
paru -G davinci-resolve              # clone the PKGBUILD into ./davinci-resolve/
dr-downloader -o davinci-resolve     # download the zip beside it
paru -Bi davinci-resolve             # build + install

# yay
yay -G davinci-resolve
dr-downloader -o davinci-resolve
yay -Bi davinci-resolve
```

One-liner shell function:

```bash
davinci-aur() {
  paru -G davinci-resolve &&
    dr-downloader -o davinci-resolve &&
    paru -Bi davinci-resolve
}
```

### Recovering a failed `paru -S`

If `paru -S davinci-resolve` already cloned the package into its own cache and
only failed on the missing zip, skip the re-clone: `--aur` drops the zip
straight into that existing clone dir (autodetecting paru's
`~/.cache/paru/clone/davinci-resolve` vs yay's `~/.cache/yay/davinci-resolve`;
override with `DAVINCI_AUR_DIR`), then build from it:

```bash
dr-downloader --aur
paru -Bi ~/.cache/paru/clone/davinci-resolve
```

> [!WARNING]
> The installer BMD serves (latest stable) must match the PKGBUILD's
> `pkgver`, or the filename/sha256 won't line up. Run `paru -G davinci-resolve`
> first so the PKGBUILD is current.

## Bot identity

This tool identifies itself honestly. Every request it makes (the page
navigation and the file download) is sent with an identifiable User-Agent:

```text
davinci-resolve-downloader/<version> (+https://github.com/kjanat/dr-downloader)
```

That is intentional. Blackmagic Design can grep their logs for
`davinci-resolve-downloader` and block it server-side if they'd prefer this tool
didn't reach them. The respectful behavior is the default, and there is no flag
in this README to turn it off.

In full honesty, the browser layer is **not** equally transparent: to keep BMD's
AngularJS form working under headless Chrome, the page disables
`AutomationControlled` and reports `navigator.webdriver = false` — standard
anti-bot-detection measures (the "anti-detection measures" in step 1 of
[How it works](#how-it-works)). So the _fingerprint_ is that of a regular
browser; the _User-Agent_ is not. The identifiable thing — the part BMD would
actually filter on — stays honest by design.

## Stability & support

This tool drives Blackmagic Design's **live website** — it clicks through their
exact current modal, form, and CDN flow. None of that is an API and none of it
is under my control. The day BMD reshuffles their markup, renames a field, or
changes how the download is served, this tool **will break**, probably without
warning.

When it does:

- **Don't bother BMD.** It's not their bug and not their tool. Pestering their
  support about a third-party scraper helps no one.
- **Complain to me**, not them: [open an issue]. A clear report (what you ran,
  what happened) is the most useful thing you can send.
- **Expect nothing.** This is provided as-is, no warranty, no SLA, no promise it
  gets fixed on any timeline — or ever. I scratch my own itch; if it works for
  you too, great. PRs that fix a breakage are far more likely to land than a bug
  report alone.

## Notes

- DaVinci Resolve is proprietary software by Blackmagic Design
- This tool only downloads the publicly available free installer
- Registration data defaults to **obviously fake** placeholder values
  (`Placeholder User <placeholder@example.com>`) so a bare run is never mistaken
  for a real lead in BMD's funnel. Supply your own via flags, `DAVINCI_*` env
  vars, or a config file to register as yourself; a bare run warns you it is
  using placeholder data

## License

[MIT][LICENSE] © 2026 Kaj Kowalski

<!--link-definitions-->

[@kjanat/dreamcli]: https://npm.im/@kjanat/dreamcli
[Bun]: https://bun.sh/
[DaVinci Resolve]: https://www.blackmagicdesign.com/products/davinciresolve
[LICENSE]: https://github.com/kjanat/dr-downloader/blob/master/LICENSE
[npm]: https://npm.im/davinci-resolve-downloader
[open an issue]: https://github.com/kjanat/dr-downloader/issues

<!-- markdownlint-disable-file MD033 -->
<!-- rumdl-disable-file MD013 -->
