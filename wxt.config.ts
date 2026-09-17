import { defineConfig } from 'wxt';
import { packs } from './src/packs';

const sites = packs.flatMap((pack) => pack.sites);
const TYPESAFE = 'https://api.typesafe.ai/*';

export default defineConfig({
	srcDir: 'src',
	// Everything is imported where it is used: nothing appears from nowhere.
	imports: false,
	manifest: {
		name: 'Barrunto',
		// What the popup needs for its folds to close one another by themselves. Everything else asks
		// for less: the build is for Chrome 111 and later, and optional sites came with 102.
		minimum_chrome_version: '120',
		// `scripting` is what lets the background have the content script run only where a pack is on.
		// `activeTab` tells the popup the address of the page it is opened over, and of no other, so
		// that it can offer that page's pack.
		permissions: ['storage', 'scripting', 'activeTab'],
		// Barrunto may act on no site until the user turns its pack on, and Chrome asks them then. The
		// stand-in build holds them all from the start: the smoke test has nobody to answer Chrome.
		host_permissions: process.env.WXT_STAND_IN ? [TYPESAFE, ...sites] : [TYPESAFE],
		optional_host_permissions: sites,
		action: { default_title: 'Barrunto' }
	}
});
