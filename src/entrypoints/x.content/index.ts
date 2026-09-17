import { defineContentScript } from 'wxt/utils/define-content-script';
import { watchPage } from './watch';

export default defineContentScript({
	matches: ['https://x.com/*'],
	main(ctx) {
		watchPage(ctx).catch((error) => console.error('[barrunto] could not start', error));
	}
});
