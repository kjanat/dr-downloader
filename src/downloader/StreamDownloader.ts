import type { DownloaderOutput } from '#downloader/output';
import { formatFileSize } from '#utils/formatters';
import { resolveUserAgent } from '#utils/userAgent';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

// biome-ignore lint/complexity/noStaticOnlyClass: utility class
export class StreamDownloader {
	static async download(url: string, outputDir: string, out: DownloaderOutput): Promise<string> {
		await mkdir(outputDir, { recursive: true });

		// Extract filename from URL
		const urlPath = new URL(url).pathname;
		const filename = basename(urlPath) || 'DaVinci_Resolve_Linux.zip';
		const outputPath = join(outputDir, filename);

		const response = await fetch(url, {
			// Same identity as the Puppeteer page (honest by default; overridable
			// via DAVINCI_USER_AGENT) so the page request and the byte download
			// don't speak with two different voices.
			headers: { 'User-Agent': resolveUserAgent() },
		});

		if (!response.ok) {
			throw new Error(`Download failed: ${response.status} ${response.statusText}`);
		}

		const contentLength = Number(response.headers.get('content-length') || 0);
		const sizeLabel = contentLength > 0 ? ` (${formatFileSize(contentLength)})` : '';
		out.log(`📥 Downloading ${filename}${sizeLabel} to ${outputDir}/`);

		const body = response.body;
		if (!body) throw new Error('No response body');

		const writer = createWriteStream(outputPath);
		const reader = body.getReader();

		// Determinate bar when the server sends a content-length, otherwise an
		// indeterminate one. Animates in a TTY; silent in non-TTY / --json.
		const bar = out.progress({
			total: contentLength > 0 ? contentLength : undefined,
			label: filename,
		});

		let downloaded = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const flushed = writer.write(Buffer.from(value));
				downloaded += value.byteLength;
				bar.increment(value.byteLength);

				// Honor stream backpressure: when the buffer is full, wait for the
				// drain event before reading more so chunks don't pile up in memory
				// if the disk is slower than the network.
				if (!flushed) {
					await new Promise<void>((resolve) => writer.once('drain', resolve));
				}
			}

			writer.end();
			await new Promise<void>((resolve, reject) => {
				writer.on('finish', resolve);
				writer.on('error', reject);
			});

			bar.done(`Download complete: ${filename} (${formatFileSize(downloaded)})`);
			return outputPath;
		} catch (e) {
			bar.fail('Download failed');
			writer.end();
			throw e;
		}
	}
}
