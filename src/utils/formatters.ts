export function formatFileSize(bytes: number): string {
	if (bytes <= 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const val = bytes / k ** i;
	return `${Math.round(val * 100) / 100} ${sizes[i]}`;
}
