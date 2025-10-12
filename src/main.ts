import { ConfigManager } from "@/config/ConfigManager.ts";
import { DaVinciDownloader } from "@/downloader/DaVinciDownloader.ts";

export async function main(): Promise<void> {
  const config = new ConfigManager();
  config.parseCliArgs(process.argv.slice(2));

  const downloader = new DaVinciDownloader(config);
  await downloader.run();
}
