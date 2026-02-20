export const SELECTORS = {
	firstname: '#firstname',
	lastname: '#lastname',
	email: '#email',
	phone: '#phone',
	company: '#company',
	street: '#street',
	city: '#city',
	zipcode: '#zip, #zipcode',
	country: '#country',
	state: '#state',

	// Main page
	freeDownloadButton: 'a[href*="davinciresolve"]',

	// Modal OS selection - these are the platform links in the download modal
	platformLinks: {
		linux: 'Linux',
		mac: 'Mac OS X',
		windows: 'Windows',
		winarm: 'Windows ARM',
	},
} as const;
