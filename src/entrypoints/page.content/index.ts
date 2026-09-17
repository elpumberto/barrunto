import { defineContentScript } from 'wxt/utils/define-content-script';
import { MatchPattern } from 'wxt/utils/match-patterns';
import { packs } from '@/packs';
import { pages } from '@/packs/pages';
import { watchPage } from './watch';

export default defineContentScript({
	// No sites of its own: the background has it run on the sites of the packs that are on, and hands
	// it to the pages already open. Handed over twice, the newest copy is the one that carries on:
	// WXT has the older one let go of the page, and what that one painted is cleared as it is met.
	registration: 'runtime',
	main(ctx) {
		const pack = packs.find(({ sites }) =>
			sites.some((site) => new MatchPattern(site).includes(location.href))
		);
		const page = pack && pages[pack.id];
		if (!page) return;
		watchPage(ctx, pack, page).catch((error) => console.error('[barrunto] could not start', error));
	}
});
