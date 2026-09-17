import { defineConfig } from 'wxt';

export default defineConfig({
	srcDir: 'src',
	// Everything is imported where it is used: nothing appears from nowhere.
	imports: false,
	manifest: {
		name: 'Barrunto',
		// The first Chrome where the background can open session storage to a content script.
		minimum_chrome_version: '102',
		permissions: ['storage'],
		host_permissions: ['https://api.typesafe.ai/*'],
		action: { default_title: 'Barrunto' }
	}
});
