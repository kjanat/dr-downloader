#!/usr/bin/env bun
// daVinciDownloader.ts — Puppeteer 24.21.0 compatible
//
// Changes vs your last version:
// - Configure downloads via BrowserContext/Launch `downloadBehavior` (no Page.setDownloadBehavior).
// - Replace deprecated/removed page.waitForTimeout with sleep().
// - Fix CLI typing (no undefined args), make platform flag explicit.
// - Remove unused RequestMeta/ResponseMeta to satisfy Biome.
// - Keep robust “newest file grows then stabilizes” detection and label/ID selectors.

import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import puppeteer, {
  type BrowserContext,
  type HTTPResponse,
  type Page,
} from "puppeteer";

type Platform = "linux" | "mac" | "windows";

interface RegistrationData {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  street: string;
  zipcode: string;
  company: string;
  platform: Platform;
}

class DaVinciDownloader {
  private outputDir: string;
  private testMode: boolean;
  private readonly registrationData: RegistrationData;

  private verbose = true;

  constructor(outputDir?: string, testMode: boolean = false) {
    this.outputDir = outputDir || this.getDefaultOutputDir();
    this.testMode = testMode;
    this.registrationData = {
      ...this.getTestRegistrationData(),
      ...this.loadFromEnvironment(),
    } as RegistrationData;
  }

  async run(): Promise<void> {
    this.parseCommandLineArgs();

    this.log("🎬 DaVinci Resolve Downloader - TypeScript Edition");
    this.log("================================================");

    if (this.testMode) {
      this.log("🧪 Running in test mode with mock credentials");
      this.log("⚠️  Not for production use!");
    }

    try {
      await this.downloadDaVinciResolve();
      this.log(
        this.testMode
          ? "🧪 Test mode completed! ✅ Flow exercised."
          : "🎉 Done! DaVinci Resolve downloaded and ready.",
      );
    } catch (error) {
      console.error(
        `💥 Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  private async downloadDaVinciResolve(): Promise<void> {
    this.log("🚀 Launching browser...");

    // Ensure output directory exists
    try {
      await mkdir(this.outputDir, { recursive: true });
    } catch {}

    // Configure download behavior at launch via ConnectOptions (LaunchOptions extends it)
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
      ],
      downloadBehavior: {
        policy: "allow",
        downloadPath: this.outputDir,
      },
    });

    // Create an explicit context (inherits launch downloadBehavior); also works
    // to override per-context if needed by passing BrowserContextOptions.
    const context: BrowserContext = await browser.createBrowserContext({
      // downloadBehavior: { policy: "allow", downloadPath: this.outputDir }, // optional override
    });

    try {
      const page = await context.newPage();
      this.log(`💾 Downloads directory: ${this.outputDir}`);
      if (this.testMode)
        this.log("🧪 Test mode - will not wait for file completion");

      this.log("🌐 Navigating to Blackmagic Design download page...");
      await this.retryable(
        () =>
          page.goto(
            "https://www.blackmagicdesign.com/event/davinciresolvedownload",
            {
              waitUntil: "networkidle2",
              timeout: 45_000,
            },
          ),
        { retries: 3 },
      );

      // Wait for form root (Angular app) to be visible
      await this.retryable(
        () => page.waitForSelector("form", { visible: true, timeout: 20_000 }),
        { retries: 2 },
      );

      // Validate data before typing
      this.validateRegistrationData();

      this.log("📝 Filling out registration form...");

      // Prefer robust, label-driven typing with ID fallback
      await this.typeByLabelOrId(
        page,
        "First Name",
        "#firstname",
        this.registrationData.firstname,
      );
      await this.typeByLabelOrId(
        page,
        "Last Name",
        "#lastname",
        this.registrationData.lastname,
      );
      await this.typeByLabelOrId(
        page,
        "Email",
        "#email",
        this.registrationData.email,
      );
      if (this.registrationData.phone) {
        await this.typeByLabelOrId(
          page,
          "Phone",
          "#phone",
          this.registrationData.phone,
        );
      }
      await this.typeByLabelOrId(
        page,
        "Company",
        "#company",
        this.registrationData.company ?? "",
      );
      await this.typeByLabelOrId(
        page,
        "Street",
        "#street",
        this.registrationData.street,
      );
      await this.typeByLabelOrId(
        page,
        "City",
        "#city",
        this.registrationData.city,
      );
      await this.typeByLabelOrId(
        page,
        "Zip",
        "#zip, #zipcode",
        this.registrationData.zipcode,
      );

      // Country (try by value, then by option text)
      await this.selectByValueOrText(
        page,
        "#country",
        this.registrationData.country,
        this.countryTextGuess(this.registrationData.country),
      );

      // State waits for options to populate after country change
      await this.waitForOptions(page, "#state", 15_000);
      if (this.registrationData.state) {
        await this.selectByValueOrText(
          page,
          "#state",
          this.registrationData.state,
          this.registrationData.state,
        );
      }

      // Policy checkbox
      await this.ensureChecked(page, "#policy");

      // Click the platform-specific download button
      await this.clickPlatformDownload(page, this.registrationData.platform);

      if (this.testMode) {
        this.log("🧪 Test mode: clicked download, stopping here.");
        return;
      }

      // Detect the response that signals a download via Content-Disposition
      this.log("⏳ Waiting for server to signal attachment...");
      const dlResponse = await this.waitForDownloadResponse(page, 60_000);

      const hintedName = this.extractFilenameFromContentDisposition(
        dlResponse.headers()["content-disposition"] || "",
      );
      if (hintedName) this.log(`⬇️  Server filename hint: ${hintedName}`);

      // Watch the download directory for the target file to appear and stop growing
      await this.waitForDownloadCompletion(hintedName);
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  // ---------- Helpers: DOM interactions ----------

  private async typeByLabelOrId(
    page: Page,
    labelText: string,
    idSelector: string,
    value: string,
  ) {
    if (!value) return;
    const ok = await page.evaluate(
      (label, sel, val) => {
        const findByLabel = () => {
          const labs = Array.from(document.querySelectorAll("label"));
          const match = labs.find(
            (el) =>
              (el.textContent || "").trim().toLowerCase() ===
              label.toLowerCase(),
          );
          if (!match) return null;
          const forId = match.getAttribute("for");
          if (forId)
            return document.getElementById(forId) as HTMLInputElement | null;
          return (
            (match.querySelector(
              "input,textarea",
            ) as HTMLInputElement | null) || null
          );
        };

        const input =
          findByLabel() ||
          (document.querySelector(sel) as HTMLInputElement | null);
        if (!input) return false;

        input.focus();
        (input as HTMLInputElement).value = val;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      labelText,
      idSelector,
      value,
    );

    if (!ok)
      this.log(
        `⚠️ Could not find input for "${labelText}" / ${idSelector}, continuing...`,
      );
  }

  private async selectByValueOrText(
    page: Page,
    selector: string,
    preferredValue: string,
    fallbackText: string,
  ) {
    // Try by value first
    const byValue = await page.evaluate(
      (sel, value) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        if (!el) return false;
        const opt = Array.from(el.options).find((o) => o.value === value);
        if (opt) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return false;
      },
      selector,
      preferredValue,
    );
    if (byValue) return;

    // Then try by visible text (case-insensitive)
    const byText = await page.evaluate(
      (sel, text) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        if (!el) return false;
        const norm = (s: string) => s.trim().toLowerCase();
        const target = norm(text);
        const opt = Array.from(el.options).find((o) => norm(o.text) === target);
        if (opt) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return false;
      },
      selector,
      fallbackText,
    );

    if (!byText)
      this.log(
        `⚠️ Could not select ${selector} (${preferredValue} / ${fallbackText})`,
      );
  }

  private async waitForOptions(page: Page, selector: string, timeout = 15_000) {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        return !!el && el.options.length > 1;
      },
      { timeout },
      selector,
    );
  }

  private async ensureChecked(page: Page, checkboxSelector: string) {
    // Try a normal click; if it fails, flip it programmatically.
    try {
      await page.click(checkboxSelector, { delay: 10 });
      await this.sleep(200);
    } catch {}

    const checked = await page.evaluate((sel) => {
      const cb = document.querySelector(sel) as HTMLInputElement | null;
      if (!cb) return false;
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        cb.dispatchEvent(new Event("click", { bubbles: true }));
      }
      return cb.checked;
    }, checkboxSelector);

    this.log(
      `📋 Policy checkbox status: ${checked ? "✅ Checked" : "❌ Not checked"}`,
    );
  }

  private async clickPlatformDownload(page: Page, platform: Platform) {
    const labelMap: Record<Platform, string> = {
      linux: "Download Linux",
      mac: "Download Mac",
      windows: "Download Windows",
    };
    const targetText = labelMap[platform];

    this.log(`🎯 Looking for '${targetText}' button...`);

    await page.waitForFunction(
      (text) => {
        const els = Array.from(
          document.querySelectorAll("button,a,[role='button']"),
        );
        return els.some((el) =>
          (el.textContent || "").toLowerCase().includes(text.toLowerCase()),
        );
      },
      { timeout: 15_000 },
      targetText,
    );

    const clicked = await page.evaluate(
      (text, plat) => {
        const els = Array.from(
          document.querySelectorAll("button,a,[role='button']"),
        );
        const ok = (el: Element) =>
          (el.textContent || "").toLowerCase().includes(text.toLowerCase()) ||
          (el as HTMLElement).dataset.platform === plat;
        const el = els.find(ok);
        if (el) {
          (el as HTMLElement).click();
          return true;
        }
        return false;
      },
      targetText,
      platform,
    );

    if (!clicked) throw new Error(`Download button '${targetText}' not found`);
    this.log("✅ Download button clicked");
  }

  private async waitForDownloadResponse(
    page: Page,
    timeoutMs: number,
  ): Promise<HTTPResponse> {
    const resp = await page.waitForResponse(
      (r) => {
        const cd = r.headers()["content-disposition"] || "";
        return r.status() >= 200 && r.status() < 400 && /attachment/i.test(cd);
      },
      { timeout: timeoutMs },
    );
    this.log(`📋 Download response: ${resp.status()} for ${resp.url()}`);
    return resp;
  }

  // ---------- Helpers: Filesystem polling ----------

  private async waitForDownloadCompletion(
    filenameHint: string | null,
  ): Promise<void> {
    const deadline = Date.now() + 15 * 60 * 1000; // 15 minutes
    const poll = 5000;

    let lastSize = -1;
    let stable = 0;
    let target: string | null = null;

    const filter = (f: string) => {
      const lower = f.toLowerCase();
      const looksLike = /davinci|resolve|blackmagic/.test(lower);
      const extOk = /\.(zip|tar\.gz|run|dmg|exe|deb|rpm)$/i.test(f);
      return looksLike && extOk;
    };

    while (Date.now() < deadline) {
      // choose newest matching file (or by hint name if available)
      target = await this.pickNewest(this.outputDir, (f) => {
        if (filenameHint && !f.includes(filenameHint)) return false;
        return filter(f);
      });

      if (target) {
        const full = join(this.outputDir, target);
        const { size } = await stat(full).catch(() => ({ size: 0 }));
        if (size > lastSize) {
          lastSize = size;
          stable = 0;
          this.log(`📥 Downloading: ${this.formatFileSize(size)} (${target})`);
        } else if (size > 0) {
          stable++;
          this.log(
            `⏳ Verifying: ${this.formatFileSize(size)} (${target}) - check ${stable}/3`,
          );
          if (stable >= 3) {
            this.log(
              `✅ Download completed: ${target} (${this.formatFileSize(size)})`,
            );
            return;
          }
        } else {
          this.log("⏳ Waiting for file to grow...");
          stable = 0;
        }
      } else {
        this.log("⏳ Waiting for download to appear...");
        stable = 0;
      }

      await this.sleep(poll);
    }

    // Timeout diagnostics
    this.log("⚠️ Download monitoring timeout reached (15 minutes)");
    const finalPick = await this.pickNewest(this.outputDir, (f) => filter(f));
    if (finalPick) {
      const { size } = await stat(join(this.outputDir, finalPick)).catch(
        () => ({ size: 0 }),
      );
      this.log(`📄 Found file: ${finalPick} (${this.formatFileSize(size)})`);
      throw new Error(
        "Download may be incomplete or very slow. Please check the file manually.",
      );
    } else {
      this.log("❌ No DaVinci Resolve files found in download directory");
      throw new Error("Download failed - no files found after timeout");
    }
  }

  private async pickNewest(
    dir: string,
    filter: (f: string) => boolean,
  ): Promise<string | null> {
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      return null;
    }
    const candidates = files.filter(filter);
    if (!candidates.length) return null;

    const withTimes = await Promise.all(
      candidates.map(async (f) => {
        const p = join(dir, f);
        const s = await stat(p).catch(() => null);
        return { f, t: s?.mtimeMs ?? 0 };
      }),
    );

    withTimes.sort((a, b) => b.t - a.t);
    return withTimes[0]?.f ?? null;
  }

  // ---------- Validation, config, and misc ----------

  private validateRegistrationData(): void {
    const { email, phone, firstname, lastname } = this.registrationData;

    if (!firstname?.trim()) throw new Error("First name is required");
    if (!lastname?.trim()) throw new Error("Last name is required");
    if (!email?.trim()) throw new Error("Email is required");
    if (!this.isValidEmail(email))
      throw new Error(`Invalid email format: ${email}`);

    // Be permissive—let site complain if it wants a different format
    if (phone && !this.isValidPhone(phone))
      this.log(`⚠️ Phone format looks odd: ${phone} (continuing anyway)`);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Very permissive: digits plus common separators, 7–20 chars after trimming spaces.
    const clean = phone.replace(/\s/g, "");
    return /^[\d\-+()xX]{7,20}$/.test(clean);
  }

  private getDefaultOutputDir(): string {
    return process.env.DEFAULT_OUTPUT_PATH || "./downloads";
  }

  private getPlatform(): Platform {
    const p = process.platform;
    if (p === "darwin") return "mac";
    if (p === "win32") return "windows";
    return "linux";
  }

  private getTestRegistrationData(): RegistrationData {
    return {
      firstname: "John",
      lastname: "Doe",
      email: "john.doe@example.com",
      phone: "555-123-4567",
      country: "US",
      state: "New York",
      city: "New York",
      street: "123 Main St",
      zipcode: "10001",
      company: "",
      platform: this.getPlatform(),
    };
  }

  private loadFromEnvironment(): Partial<RegistrationData> {
    const e = process.env;
    const envData: Partial<RegistrationData> = {};
    if (e.DAVINCI_FIRSTNAME) envData.firstname = e.DAVINCI_FIRSTNAME;
    if (e.DAVINCI_LASTNAME) envData.lastname = e.DAVINCI_LASTNAME;
    if (e.DAVINCI_EMAIL) envData.email = e.DAVINCI_EMAIL;
    if (e.DAVINCI_PHONE) envData.phone = e.DAVINCI_PHONE;
    if (e.DAVINCI_COUNTRY) envData.country = e.DAVINCI_COUNTRY;
    if (e.DAVINCI_STATE) envData.state = e.DAVINCI_STATE;
    if (e.DAVINCI_CITY) envData.city = e.DAVINCI_CITY;
    if (e.DAVINCI_STREET) envData.street = e.DAVINCI_STREET;
    if (e.DAVINCI_ZIPCODE) envData.zipcode = e.DAVINCI_ZIPCODE;
    if (e.DAVINCI_COMPANY) envData.company = e.DAVINCI_COMPANY;
    return envData;
  }

  private parseCommandLineArgs(): void {
    const args = process.argv.slice(2);

    if (args.includes("--help") || args.includes("-h")) {
      this.showHelp();
      process.exit(0);
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!; // non-null assertion: guarded by bounds
      const next = args[i + 1];

      if (arg === "--test" || arg === "-t") {
        this.testMode = true;
      } else if (arg === "--platform" && typeof next === "string") {
        if (["linux", "mac", "windows"].includes(next)) {
          (this.registrationData as any).platform = next as Platform;
          i++;
        } else {
          console.warn(`⚠️ Unknown platform: ${next}`);
        }
      } else if (
        this.isValueFlag(arg) &&
        typeof next === "string" &&
        this.handleValueArgument(arg, next)
      ) {
        i++; // consumed next
      } else if (arg === "-o" && typeof next === "string") {
        this.outputDir = next;
        i++;
      } else if (arg.startsWith("--")) {
        console.warn(`⚠️ Unknown or malformed argument: ${arg}`);
      }
    }
  }

  private isValueFlag(arg: string): boolean {
    return [
      "--firstname",
      "--lastname",
      "--email",
      "--phone",
      "--country",
      "--state",
      "--city",
      "--street",
      "--zipcode",
      "--company",
      "--output",
    ].includes(arg);
  }

  private handleValueArgument(arg: string, value: string): boolean {
    if (!value) return false;

    if (arg === "--output") {
      this.outputDir = value;
      return true;
    }

    const map: Record<string, keyof RegistrationData> = {
      "--firstname": "firstname",
      "--lastname": "lastname",
      "--email": "email",
      "--phone": "phone",
      "--country": "country",
      "--state": "state",
      "--city": "city",
      "--street": "street",
      "--zipcode": "zipcode",
      "--company": "company",
    };

    const prop = map[arg];
    if (!prop) return false;

    (this.registrationData as any)[prop] = value;
    return true;
  }

  private showHelp(): void {
    console.log(`
DaVinci Resolve Downloader - TypeScript Edition

Usage: bun run daVinciDownloader.ts [options]

Options:
  -t, --test           Run in test mode (no actual download)
  -o, --output <dir>   Download directory (default: ./downloads)
  --platform <p>       linux | mac | windows (default: autodetect)
  --firstname <name>
  --lastname <name>
  --email <email>
  --phone <phone>
  --country <country>  e.g. "US" or "United States"
  --state <state>      e.g. "New York"
  --city <city>
  --street <street>
  --zipcode <zip>
  --company <name>
  -h, --help           Show this help

Environment Variables:
  DAVINCI_FIRSTNAME, DAVINCI_LASTNAME, DAVINCI_EMAIL, DAVINCI_PHONE,
  DAVINCI_COUNTRY, DAVINCI_STATE, DAVINCI_CITY, DAVINCI_STREET,
  DAVINCI_ZIPCODE, DAVINCI_COMPANY, DEFAULT_OUTPUT_PATH
`);
  }

  // ---------- Utilities ----------

  private extractFilenameFromContentDisposition(cd: string): string | null {
    if (!cd) return null;
    // RFC 5987 filename*=
    const star = cd.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
    if (star?.[2]) return decodeURIComponent(star[2].trim());

    // Simple filename=
    const simple = cd.match(/filename\s*=\s*("?)([^";]+)\1/i);
    if (simple?.[2]) return simple[2].trim();

    return null;
  }

  private countryTextGuess(codeOrText: string): string {
    const clean = codeOrText.replace(/^string:/i, "");
    if (clean.length === 2) {
      const map: Record<string, string> = {
        US: "United States",
        GB: "United Kingdom",
        NL: "Netherlands",
        DE: "Germany",
        FR: "France",
        IT: "Italy",
        ES: "Spain",
        CA: "Canada",
        AU: "Australia",
      };
      return map[clean.toUpperCase()] || clean;
    }
    return clean;
  }

  private formatFileSize(bytes: number): string {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / k ** i;
    return `${Math.round(val * 100) / 100} ${sizes[i]}`;
  }

  private async retryable<T>(
    fn: () => Promise<T>,
    opts: { retries: number; delayMs?: number },
  ): Promise<T> {
    let { retries, delayMs = 1000 } = opts;
    for (;;) {
      try {
        return await fn();
      } catch (err) {
        if (retries-- <= 0) throw err;
        this.log(`⚠️ Retrying... (${retries} attempts left)`);
        await this.sleep(delayMs);
        delayMs = Math.min(delayMs * 2, 10_000);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private log(msg: string) {
    if (this.verbose) console.log(msg);
  }
}

// Run the downloader
const daVinciDownloader = new DaVinciDownloader();
daVinciDownloader.run();
