import { ConfigManager } from '#config/ConfigManager';
import { DaVinciDownloader } from '#downloader/DaVinciDownloader';

export async function main(): Promise<void> {
	const config = new ConfigManager();
	config.parseCliArgs(process.argv.slice(2));

	const downloader = new DaVinciDownloader(config);
	await downloader.run();
}

if (import.meta.main) main();
