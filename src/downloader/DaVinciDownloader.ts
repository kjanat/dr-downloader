import type { HTTPResponse, Page } from "puppeteer";
import type { ConfigManager } from "@/config/ConfigManager.ts";
import { DownloadMonitor } from "@/downloader/DownloadMonitor.ts";
import { FormHandler } from "@/downloader/FormHandler.ts";
import { createBrowser, createPage } from "@/utils/browser.ts";

export class DaVinciDownloader {
  private formHandler?: FormHandler;
  private downloadMonitor?: DownloadMonitor;

  constructor(private readonly config: ConfigManager) {}

  async run(): Promise<void> {
    console.log("🎬 DaVinci Resolve Downloader - TypeScript Edition");

    if (this.config.getDownloadConfig().testMode) {
      console.log("🧪 Running in test mode");
    }

    try {
      await this.downloadDaVinciResolve();
      console.log("🎉 Download completed successfully!");
    } catch (error) {
      console.error(
        `💥 Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  private async downloadDaVinciResolve(): Promise<void> {
    const browser = await createBrowser(this.config.getDownloadConfig());

    try {
      const page = await createPage(browser, this.config.getDownloadConfig());

      this.formHandler = new FormHandler(page);
      this.downloadMonitor = new DownloadMonitor(
        this.config.getDownloadConfig().outputDir,
        this.config.getDownloadConfig().timeout,
      );

      await page.goto(
        "https://www.blackmagicdesign.com/event/davinciresolvedownload",
        {
          waitUntil: "networkidle2",
          timeout: 45_000,
        },
      );

      await this.formHandler.fillRegistrationForm(
        this.config.getRegistrationData(),
      );

      await this.formHandler.clickPlatformDownload(
        this.config.getRegistrationData().platform,
      );

      if (!this.config.getDownloadConfig().testMode) {
        const downloadResponse = await this.waitForDownloadResponse(page);
        const filename = downloadResponse
          ? this.extractFilename(downloadResponse)
          : null;
        await this.downloadMonitor.waitForCompletion(filename);
      }
    } finally {
      await browser.close();
    }
  }

  private async waitForDownloadResponse(
    page: Page,
  ): Promise<HTTPResponse | null> {
    const timeoutMs = this.config.getDownloadConfig().timeout;
    try {
      const resp = await page.waitForResponse(
        (r) => {
          const cd = r.headers()["content-disposition"] || "";
          return (
            r.status() >= 200 && r.status() < 400 && /attachment/i.test(cd)
          );
        },
        { timeout: timeoutMs },
      );
      console.log(`📋 Download response: ${resp.status()} for ${resp.url()}`);
      return resp;
    } catch {
      console.warn(
        "⚠️ No explicit attachment response detected within timeout; watching downloads folder anyway.",
      );
      return null;
    }
  }

  private extractFilename(response: HTTPResponse): string | null {
    const cd = response.headers()["content-disposition"] || "";
    // RFC 5987 filename*=
    const star = cd.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
    if (star?.[2]) return decodeURIComponent(star[2].trim());
    // Simple filename=
    const simple = cd.match(/filename\s*=\s*("?)([^";]+)\1/i);
    if (simple?.[2]) return simple[2].trim();
    return null;
  }
}
