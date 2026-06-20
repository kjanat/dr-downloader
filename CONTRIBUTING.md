# Contributing

## Development

```bash
bun start            # run the CLI (= bun run src/main.ts)
bun run fake         # test mode, skips the real download (--test)
bun test             # run the test suite
bun run lint         # biome lint
bun run lint:fix     # biome lint --write
bun run format       # dprint fmt
bun run typecheck    # tsgo --noEmit
bun run build        # bundle to dist/
```

## CI

A GitHub Actions workflow (`.github/workflows/download.yml`) can run the
download on `workflow_dispatch` and upload the artifact.

## Project structure

```tree
src/
  main.ts                        # entry point (wires up and runs the CLI)
  cli.ts                         # dreamcli command: flags, prompts, config resolution
  config/
    types.ts                     # RegistrationData, DownloadConfig, Platform
    defaults.ts                  # placeholder registration + default timeout/retries/output
    configFile.ts                # config-file discovery path + --init-config writer
    platform.ts                  # autodetect target platform from host arch/OS
    region.ts                    # normalize BMD support region codes
    aur.ts                       # resolve the paru/yay clone dir for --aur
  constants/
    selectors.ts                 # CSS selectors for BMD form fields
  downloader/
    DaVinciDownloader.ts         # orchestrates browse -> form -> download (+ region rotation)
    FormHandler.ts               # fills and submits the registration form
    DownloadMonitor.ts           # watches the output dir for the completed file
    StreamDownloader.ts          # streams file from CDN URL to disk
  utils/
    browser.ts                   # Puppeteer launch + anti-detection config
    userAgent.ts                 # honest default User-Agent (DAVINCI_USER_AGENT override)
    editor.ts                    # resolve + launch $EDITOR for --init-config
    filesystem.ts                # file utilities (newest file, stability, size)
    formatters.ts                # formatFileSize()
  validation/
    ValidationService.ts         # mirrors BMD's Angular validators
```
