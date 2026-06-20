# Contributing

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

## CI

A GitHub Actions workflow (`.github/workflows/download.yml`) can run the
download on `workflow_dispatch` and upload the artifact.

## Project structure

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
