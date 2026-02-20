import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { formatFileSize } from '@/utils/formatters.ts';

// biome-ignore lint/complexity/noStaticOnlyClass: utility class
export class StreamDownloader {
	static async download(url: string, outputDir: string): Promise<string> {
		await mkdir(outputDir, { recursive: true });

		// Extract filename from URL
		const urlPath = new URL(url).pathname;
		const filename = basename(urlPath) || 'DaVinci_Resolve_Linux.zip';
		const outputPath = join(outputDir, filename);

		console.log(`📥 Downloading ${filename} to ${outputDir}/`);

		const response = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			},
		});

		if (!response.ok) {
			throw new Error(
				`Download failed: ${response.status} ${response.statusText}`,
			);
		}

		const contentLength = Number(response.headers.get('content-length') || 0);
		if (contentLength > 0) {
			console.log(`📦 File size: ${formatFileSize(contentLength)}`);
		}

		const body = response.body;
		if (!body) {
			throw new Error('No response body');
		}

		const writer = createWriteStream(outputPath);
		const reader = body.getReader();

		let downloaded = 0;
		let lastLogTime = 0;
		const logInterval = 3000; // Log progress every 3 seconds

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				writer.write(Buffer.from(value));
				downloaded += value.byteLength;

				const now = Date.now();
				if (now - lastLogTime > logInterval) {
					lastLogTime = now;
					const pct = contentLength > 0
						? ` (${((downloaded / contentLength) * 100).toFixed(1)}%)`
						: '';
					console.log(`📥 Downloaded: ${formatFileSize(downloaded)}${pct}`);
				}
			}
		} finally {
			writer.end();
		}

		// Wait for writer to finish
		await new Promise<void>((resolve, reject) => {
			writer.on('finish', resolve);
			writer.on('error', reject);
		});

		console.log(
			`✅ Download complete: ${filename} (${formatFileSize(downloaded)})`,
		);
		return outputPath;
	}
}
