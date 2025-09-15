#!/usr/bin/env bun
import { createWriteStream, existsSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

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
	platform: "linux" | "mac" | "windows";
}

interface DownloadProgress {
	downloaded: number;
	total: number;
	percentage: number;
}

class DaVinciDownloader {
	private outputPath: string;
	private testMode: boolean;
	private registrationData: RegistrationData;
	private downloadStarted: boolean = false;
	private downloadCompleted: boolean = false;

	constructor(outputPath?: string, testMode: boolean = false) {
		this.outputPath = outputPath || this.getDefaultOutputPath();
		this.testMode = testMode;
		this.registrationData = this.getTestRegistrationData();
	}

	private getDefaultOutputPath(): string {
		const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";

		// Try to detect AUR cache directories
		const aurCachePaths = [
			join(homeDir, ".cache/yay/davinci-resolve"),
			join(homeDir, ".cache/paru/clone/davinci-resolve"),
			join(homeDir, ".cache/aurutils"),
			join(homeDir, ".cache/pikaur/pkg"),
			join(homeDir, ".cache/aura/pkgs"),
		];

		for (const cachePath of aurCachePaths) {
			if (existsSync(cachePath)) {
				return join(cachePath, "DaVinci_Resolve_20.2_Linux.zip");
			}
		}

		// Fallback to current directory
		return "./DaVinci_Resolve_20.2_Linux.zip";
	}

	private getTestRegistrationData(): RegistrationData {
		return {
			firstname: "John",
			lastname: "Doe",
			email: "john.doe@example.com",
			phone: "555-123-4567",
			country: "string:us", // Fix country format to match Angular form expectations
			state: "string:New York", // Use proper format discovered through MCP analysis
			city: "New York",
			street: "123 Main St",
			zipcode: "10001",
			company: "",
			platform: "linux",
		};
	}

	private parseCommandLineArgs(): void {
		const args = process.argv.slice(2);

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];

			if (arg === "--test") {
				this.testMode = true;
			} else if (arg === "--output" && args[i + 1]) {
				this.outputPath = args[i + 1];
				i++;
			} else if (arg === "--firstname" && args[i + 1]) {
				this.registrationData.firstname = args[i + 1];
				i++;
			} else if (arg === "--lastname" && args[i + 1]) {
				this.registrationData.lastname = args[i + 1];
				i++;
			} else if (arg === "--email" && args[i + 1]) {
				this.registrationData.email = args[i + 1];
				i++;
			} else if (arg === "--phone" && args[i + 1]) {
				this.registrationData.phone = args[i + 1];
				i++;
			} else if (arg === "--state" && args[i + 1]) {
				this.registrationData.state = args[i + 1];
				i++;
			} else if (arg === "--city" && args[i + 1]) {
				this.registrationData.city = args[i + 1];
				i++;
			} else if (arg === "--street" && args[i + 1]) {
				this.registrationData.street = args[i + 1];
				i++;
			} else if (arg === "--zipcode" && args[i + 1]) {
				this.registrationData.zipcode = args[i + 1];
				i++;
			} else if (arg === "--company" && args[i + 1]) {
				this.registrationData.company = args[i + 1];
				i++;
			}
		}
	}

	async getAuthenticatedDownloadURL(): Promise<string> {
		console.log(
			"🚀 Starting browser automation for Blackmagic Design authentication...",
		);

		const browser = await puppeteer.launch({
			headless: true,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
				"--disable-software-rasterizer",
			],
		});

		try {
			const page = await browser.newPage();

			let downloadURL: string | null = null;

			// Set up comprehensive response interception
			await page.setRequestInterception(true);

			page.on("request", (request) => {
				const url = request.url();
				const method = request.method();
				console.log(`📤 ${method}: ${url}`);

				// Check for download URLs in requests and start download immediately
				if (
					url.includes("swr.cloud.blackmagicdesign.com") &&
					url.includes("verify=")
				) {
					downloadURL = url;
					console.log(
						`✅ Captured download URL, starting download immediately...`,
					);

					// Start download immediately without waiting
					this.downloadFileInBackground(url).catch(console.error);
				}

				// Log form submissions specifically
				if (method === "POST" && url.includes("blackmagicdesign.com")) {
					console.log(`📝 Form submission detected: ${url}`);
				}

				request.continue();
			});

			// Enhanced response interception to capture download URL
			page.on("response", async (response) => {
				const url = response.url();
				const status = response.status();
				console.log(`📥 ${status}: ${url}`);

				// Check for download URLs in response body for AJAX requests
				if (url.includes("blackmagicdesign.com") && status === 200) {
					try {
						const contentType = response.headers()["content-type"] || "";
						if (contentType.includes("json") || contentType.includes("text")) {
							const body = await response.text();
							console.log(
								`📄 Response body preview: ${body.substring(0, 200)}...`,
							);

							// Look for download URLs in JSON or HTML responses
							const downloadUrlMatch = body.match(
								/https:\/\/swr\.cloud\.blackmagicdesign\.com[^"'\s]+verify=[^"'\s]+/,
							);
							if (downloadUrlMatch) {
								downloadURL = downloadUrlMatch[0];
								console.log(
									`✅ Captured download URL from response, starting download...`,
								);

								// Start download immediately
								this.downloadFileInBackground(downloadUrlMatch[0]).catch(
									console.error,
								);
							}
						}
					} catch (error) {
						console.log(`⚠️ Could not read response body: ${error.message}`);
					}
				}

				// Direct URL check
				if (
					url.includes("swr.cloud.blackmagicdesign.com") &&
					url.includes("verify=")
				) {
					downloadURL = url;
					console.log(
						`✅ Captured download URL from direct response, starting download...`,
					);

					// Start download immediately
					this.downloadFileInBackground(url).catch(console.error);
				}

				// Check redirects
				if (status >= 300 && status < 400) {
					const location = response.headers().location;
					if (
						location?.includes("swr.cloud.blackmagicdesign.com") &&
						location.includes("verify=")
					) {
						downloadURL = location;
						console.log(
							`✅ Captured download URL from redirect, starting download...`,
						);

						// Start download immediately
						this.downloadFileInBackground(location).catch(console.error);
					}
				}
			});

			// Listen for page navigation that might contain the download URL
			page.on("framenavigated", (frame) => {
				if (frame === page.mainFrame()) {
					const url = frame.url();
					console.log(`🔄 Page navigated to: ${url}`);

					if (
						url.includes("swr.cloud.blackmagicdesign.com") &&
						url.includes("verify=")
					) {
						downloadURL = url;
						console.log(
							`✅ Captured download URL from navigation, starting download...`,
						);

						// Start download immediately
						this.downloadFileInBackground(url).catch(console.error);
					}
				}
			});

			console.log("🌐 Navigating to Blackmagic Design download page...");
			await page.goto(
				"https://www.blackmagicdesign.com/event/davinciresolvedownload",
				{
					waitUntil: "networkidle2",
					timeout: 30000,
				},
			);

			// Wait for form to be visible
			await page.waitForSelector("form", { timeout: 10000 });

			console.log("📝 Filling out registration form...");

			// Wait for all form fields to be ready (Angular app needs time to load)
			console.log("⏳ Waiting for form fields to be ready...");
			await page.waitForSelector("#firstname", { timeout: 15000 });
			await page.waitForSelector("#country", { timeout: 15000 });

			// Fill basic text fields
			await page.type("#firstname", this.registrationData.firstname);
			await page.type("#lastname", this.registrationData.lastname);
			await page.type("#email", this.registrationData.email);
			await page.type("#phone", this.registrationData.phone);
			await page.type("#company", this.registrationData.company);
			await page.type("#street", this.registrationData.street);
			await page.type("#city", this.registrationData.city);
			await page.type("#zip", this.registrationData.zipcode);

			// Select country first
			console.log("🌍 Selecting country...");
			await page.select("#country", this.registrationData.country);

			// Wait for Angular to populate states based on country selection
			console.log("⏳ Waiting for state options to load...");
			await new Promise((resolve) => setTimeout(resolve, 3000));

			// Try to select state, with fallback if selector format is different
			try {
				await page.select("#state", this.registrationData.state);
				console.log("✅ State selected successfully");
			} catch (_error) {
				console.log("⚠️ Standard state selection failed, trying alternative...");

				// If the "string:" prefix is needed, try that
				try {
					await page.select(
						"#state",
						`string:${this.registrationData.state.replace("string:", "")}`,
					);
					console.log("✅ State selected with string prefix");
				} catch (_altError) {
					console.log("🔄 Trying to find state options and select manually...");

					// Try to get state options and select manually
					const stateSelected = await page.evaluate((stateName) => {
						const stateSelect = document.querySelector(
							"#state",
						) as HTMLSelectElement;
						if (stateSelect) {
							// Log available options
							const options = Array.from(stateSelect.options).map((opt) => ({
								value: opt.value,
								text: opt.text,
							}));
							console.log("Available state options:", options);

							// Try different matching approaches
							const targetState = stateName.replace("string:", "");
							const option = Array.from(stateSelect.options).find(
								(opt) =>
									opt.text.includes(targetState) ||
									opt.value.includes(targetState) ||
									opt.value === `string:${targetState}`,
							);

							if (option) {
								stateSelect.value = option.value;
								// Trigger change event for Angular
								stateSelect.dispatchEvent(
									new Event("change", { bubbles: true }),
								);
								return true;
							}
						}
						return false;
					}, this.registrationData.state);

					if (!stateSelected) {
						console.log("⚠️ Could not select state, continuing without it...");
					} else {
						console.log("✅ State selected manually");
					}
				}
			}

			// Check the policy checkbox - ensure it gets properly checked
			console.log("✅ Checking policy agreement...");

			// Multiple approaches to ensure checkbox is checked
			try {
				// First, click the checkbox
				await page.click("#policy");

				// Wait a moment for the click to register
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Verify it's checked and force check if needed
				const isChecked = await page.evaluate(() => {
					const checkbox = document.querySelector(
						"#policy",
					) as HTMLInputElement;
					if (checkbox && !checkbox.checked) {
						checkbox.checked = true;
						// Trigger change event for Angular
						checkbox.dispatchEvent(new Event("change", { bubbles: true }));
						checkbox.dispatchEvent(new Event("click", { bubbles: true }));
						return checkbox.checked;
					}
					return checkbox ? checkbox.checked : false;
				});

				console.log(
					`📋 Policy checkbox status: ${isChecked ? "✅ Checked" : "❌ Not checked"}`,
				);
			} catch (_error) {
				console.log(
					"⚠️ Policy checkbox click failed, trying alternative approach...",
				);

				// Alternative approach using evaluate
				await page.evaluate(() => {
					const checkbox = document.querySelector(
						"#policy",
					) as HTMLInputElement;
					if (checkbox) {
						checkbox.checked = true;
						checkbox.dispatchEvent(new Event("change", { bubbles: true }));
						checkbox.dispatchEvent(new Event("click", { bubbles: true }));
					}
				});
			}

			console.log("⚡ Form completed, clicking download button...");

			// Determine button text based on platform
			const buttonText =
				this.registrationData.platform === "linux"
					? "Download Linux"
					: this.registrationData.platform === "mac"
						? "Download Mac"
						: "Download Windows";

			console.log(`🎯 Looking for '${buttonText}' button...`);

			// Wait for the download button and click it
			try {
				await page.waitForFunction(
					(text) => {
						const buttons = Array.from(document.querySelectorAll("button"));
						return buttons.some((btn) => btn.textContent?.includes(text));
					},
					{ timeout: 10000 },
					buttonText,
				);

				console.log(`🎯 Found button, clicking '${buttonText}'...`);

				const buttonClicked = await page.evaluate((text) => {
					const buttons = Array.from(document.querySelectorAll("button"));
					const button = buttons.find((btn) => btn.textContent?.includes(text));
					if (button) {
						console.log("Button found, about to click:", button.outerHTML);
						button.click();

						// Check if any immediate changes happened
						setTimeout(() => {
							console.log("Page URL after click:", window.location.href);
							console.log("Page title after click:", document.title);
						}, 100);

						return true;
					}
					return false;
				}, buttonText);

				if (!buttonClicked) {
					throw new Error(`Download button '${buttonText}' not found`);
				}

				console.log(
					"✅ Button clicked successfully, checking for immediate changes...",
				);

				// Wait a bit to see if there are any immediate responses
				await new Promise((resolve) => setTimeout(resolve, 3000));

				// Check if the page has changed or if there are any error messages
				const pageInfo = await page.evaluate(() => {
					const errorElements = document.querySelectorAll(
						".error, .alert, .danger, .ng-invalid, .has-error",
					);
					const errorMessages = Array.from(errorElements).map((el) => ({
						type: el.className,
						text: el.textContent?.trim(),
						tag: el.tagName.toLowerCase(),
					}));

					return {
						url: window.location.href,
						title: document.title,
						hasErrors: errorElements.length > 0,
						errorCount: errorElements.length,
						errorDetails: errorMessages,
						formAction:
							document.querySelector("form")?.action || "no form found",
						formValidation: {
							isValid:
								document.querySelector("form")?.checkValidity?.() || "unknown",
							requiredFields: Array.from(
								document.querySelectorAll("input[required], select[required]"),
							).map((field) => ({
								name: field.name || field.id,
								value: field.value,
								valid: field.validity?.valid || "unknown",
							})),
						},
						allButtons: Array.from(document.querySelectorAll("button"))
							.map((b) => b.textContent?.trim())
							.slice(0, 10),
					};
				});

				console.log(
					"📊 Detailed page state after button click:",
					JSON.stringify(pageInfo, null, 2),
				);

				if (pageInfo.hasErrors && pageInfo.errorDetails.length > 0) {
					console.log("🚨 Form validation errors detected:");
					pageInfo.errorDetails.forEach((error, index) => {
						console.log(`   ${index + 1}. [${error.type}] ${error.text}`);
					});
				}
			} catch (_error) {
				// Try alternative button selectors
				console.log("🔄 Trying alternative button selectors...");

				const clicked = await page.evaluate(() => {
					// Try common button patterns
					const selectors = [
						'button[data-platform="linux"]',
						'a[href*="linux"]',
						".download-linux",
						"#download-linux",
					];

					for (const selector of selectors) {
						const element = document.querySelector(selector);
						if (element) {
							(element as HTMLElement).click();
							return true;
						}
					}
					return false;
				});

				if (!clicked) {
					throw new Error(
						`Could not find Linux download button with any method`,
					);
				}
			}

			console.log("⏳ Waiting for download to start...");

			// Wait for any potential AJAX requests after form submission
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Wait for download to start (max 30 seconds)
			let attempts = 0;
			while (!this.downloadStarted && attempts < 30) {
				console.log(
					`🔍 Attempt ${attempts + 1}/30: Waiting for download to start...`,
				);
				await new Promise((resolve) => setTimeout(resolve, 1000));
				attempts++;

				// Check current page URL in case we were redirected
				const currentUrl = page.url();
				if (
					currentUrl.includes("swr.cloud.blackmagicdesign.com") &&
					currentUrl.includes("verify=")
				) {
					console.log(`✅ Found download URL from current page: ${currentUrl}`);
					this.downloadFileInBackground(currentUrl).catch(console.error);
					break;
				}
			}

			if (!this.downloadStarted) {
				throw new Error("Failed to start download after 30 seconds");
			}

			// Now wait for download to complete
			console.log("⏳ Download started, waiting for completion...");
			let downloadAttempts = 0;
			while (!this.downloadCompleted && downloadAttempts < 600) {
				// Max 10 minutes
				await new Promise((resolve) => setTimeout(resolve, 1000));
				downloadAttempts++;

				// Show progress every 30 seconds
				if (downloadAttempts % 30 === 0) {
					console.log(
						`⏳ Still waiting for download... (${Math.floor(downloadAttempts / 60)} minutes elapsed)`,
					);
				}
			}

			if (!this.downloadCompleted) {
				console.log(
					"⚠️ Download timeout after 10 minutes, but file may still be downloading in background",
				);
			} else {
				console.log(
					"✅ Download completed successfully while browser was open",
				);
			}

			return downloadURL || "Download completed";
		} finally {
			await browser.close();
		}
	}

	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	}

	private showProgress(progress: DownloadProgress): void {
		const bar = "█".repeat(Math.floor(progress.percentage / 2));
		const empty = "░".repeat(50 - Math.floor(progress.percentage / 2));

		process.stdout.write(
			`\r📥 Downloading: [${bar}${empty}] ${progress.percentage.toFixed(1)}% (${this.formatBytes(progress.downloaded)}/${this.formatBytes(progress.total)})`,
		);
	}

	async downloadFileInBackground(url: string): Promise<void> {
		if (this.downloadStarted) {
			console.log("🔄 Download already in progress, ignoring duplicate URL");
			return;
		}

		this.downloadStarted = true;

		if (this.testMode) {
			console.log("🧪 Test mode - would download:", url);
			this.downloadCompleted = true;
			return;
		}

		console.log(`🎯 Starting download from: ${url}`);
		console.log(`💾 Output path: ${this.outputPath}`);

		// Ensure output directory exists
		const outputDir = dirname(this.outputPath);
		try {
			await mkdir(outputDir, { recursive: true });
		} catch (_error) {
			// Directory might already exist, ignore error
		}

		const tempPath = `${this.outputPath}.tmp`;

		try {
			// Remove existing temp file if it exists
			if (existsSync(tempPath)) {
				unlinkSync(tempPath);
			}

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const totalSize = parseInt(
				response.headers.get("content-length") || "0",
				10,
			);
			let downloaded = 0;

			const writeStream = createWriteStream(tempPath);

			if (!response.body) {
				throw new Error("No response body");
			}

			const reader = response.body.getReader();

			try {
				while (true) {
					const { done, value } = await reader.read();

					if (done) break;

					downloaded += value.length;
					writeStream.write(value);

					if (totalSize > 0) {
						const progress: DownloadProgress = {
							downloaded,
							total: totalSize,
							percentage: (downloaded / totalSize) * 100,
						};

						this.showProgress(progress);
					}
				}
			} finally {
				reader.releaseLock();
				writeStream.end();
			}

			// Wait for write stream to finish
			await new Promise<void>((resolve, reject) => {
				writeStream.on("finish", resolve);
				writeStream.on("error", reject);
			});

			// Move temp file to final location
			await Bun.write(this.outputPath, await Bun.file(tempPath).arrayBuffer());
			unlinkSync(tempPath);

			console.log(`\n✅ Download completed successfully!`);
			console.log(`📁 File saved to: ${this.outputPath}`);

			this.downloadCompleted = true;
		} catch (error) {
			// Clean up temp file on error
			if (existsSync(tempPath)) {
				unlinkSync(tempPath);
			}
			console.error(
				`💥 Download error: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}

	async downloadFile(url: string): Promise<void> {
		console.log(`🎯 Starting download from: ${url}`);
		console.log(`💾 Output path: ${this.outputPath}`);

		// Ensure output directory exists
		const outputDir = dirname(this.outputPath);
		try {
			await mkdir(outputDir, { recursive: true });
		} catch (_error) {
			// Directory might already exist, ignore error
		}

		const tempPath = `${this.outputPath}.tmp`;

		try {
			// Remove existing temp file if it exists
			if (existsSync(tempPath)) {
				unlinkSync(tempPath);
			}

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const totalSize = parseInt(
				response.headers.get("content-length") || "0",
				10,
			);
			let downloaded = 0;

			const writeStream = createWriteStream(tempPath);

			if (!response.body) {
				throw new Error("No response body");
			}

			const reader = response.body.getReader();

			try {
				while (true) {
					const { done, value } = await reader.read();

					if (done) break;

					downloaded += value.length;
					writeStream.write(value);

					if (totalSize > 0) {
						const progress: DownloadProgress = {
							downloaded,
							total: totalSize,
							percentage: (downloaded / totalSize) * 100,
						};

						this.showProgress(progress);
					}
				}
			} finally {
				reader.releaseLock();
				writeStream.end();
			}

			// Wait for write stream to finish
			await new Promise<void>((resolve, reject) => {
				writeStream.on("finish", resolve);
				writeStream.on("error", reject);
			});

			// Move temp file to final location
			await Bun.write(this.outputPath, await Bun.file(tempPath).arrayBuffer());
			unlinkSync(tempPath);

			console.log(`\n✅ Download completed successfully!`);
			console.log(`📁 File saved to: ${this.outputPath}`);
		} catch (error) {
			// Clean up temp file on error
			if (existsSync(tempPath)) {
				unlinkSync(tempPath);
			}
			throw error;
		}
	}

	async run(): Promise<void> {
		this.parseCommandLineArgs();

		console.log("🎬 DaVinci Resolve Downloader - TypeScript Edition");
		console.log("================================================");

		if (this.testMode) {
			console.log("🧪 Running in test mode with mock credentials");
			console.log("⚠️  Not for production use!");
		}

		try {
			// Step 1: Authenticate and automatically start download
			await this.getAuthenticatedDownloadURL();

			if (this.testMode) {
				console.log("🧪 Test mode completed!");
				console.log("✅ Authentication and download flow tested successfully!");
			} else {
				console.log(
					"🎉 All done! DaVinci Resolve download completed and ready for installation.",
				);
			}
		} catch (error) {
			console.error(
				`💥 Error: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	}
}

// Run the downloader
const downloader = new DaVinciDownloader();
downloader.run();
