import { basename } from "node:path";
import { findNewestFile, getFileSize } from "../utils/filesystem.ts";
import { formatFileSize } from "../utils/formatters.ts";

export class DownloadMonitor {
  constructor(
    private outputDir: string,
    private timeoutMs: number = 15 * 60 * 1000,
  ) {}

  async waitForCompletion(filenameHint: string | null): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;
    const pollInterval = 5000;

    let lastSize = -1;
    let stabilityChecks = 0;

    while (Date.now() < deadline) {
      const targetFile = await findNewestFile(
        this.outputDir,
        this.createFileFilter(filenameHint),
      );

      if (targetFile) {
        const currentSize = await getFileSize(targetFile);

        if (currentSize > lastSize) {
          lastSize = currentSize;
          stabilityChecks = 0;
          this.logProgress(targetFile, currentSize, "downloading");
        } else if (currentSize > 0) {
          stabilityChecks++;
          this.logProgress(
            targetFile,
            currentSize,
            "verifying",
            stabilityChecks,
          );

          if (stabilityChecks >= 3) {
            console.log(
              `✅ Download completed: ${basename(targetFile)} (${formatFileSize(currentSize)})`,
            );
            return targetFile;
          }
        } else {
          stabilityChecks = 0;
          console.log("⏳ Waiting for file to grow...");
        }
      } else {
        console.log("⏳ Waiting for download to appear...");
        stabilityChecks = 0;
      }

      await this.sleep(pollInterval);
    }

    throw new Error("Download timeout reached");
  }

  private createFileFilter(hint: string | null) {
    return (filename: string): boolean => {
      if (hint && !filename.includes(hint)) return false;

      const lower = filename.toLowerCase();
      const looksLikeDavinci = /davinci|resolve|blackmagic/.test(lower);
      const hasValidExt = /\.(zip|tar\.gz|run|dmg|exe|deb|rpm)$/i.test(
        filename,
      );

      return looksLikeDavinci && hasValidExt;
    };
  }

  private logProgress(
    filename: string,
    size: number,
    status: string,
    check?: number,
  ): void {
    const sizeStr = formatFileSize(size);
    const checkStr = check ? ` - check ${check}/3` : "";
    const emoji = status === "downloading" ? "📥" : "⏳";

    console.log(
      `${emoji} ${status}: ${sizeStr} (${basename(filename)})${checkStr}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
