import { defineContentScript } from 'wxt/utils/define-content-script';
import { MatchPattern } from 'wxt/utils/match-patterns';
import { packs } from '@/packs';
import { cards, pages } from '@/packs/pages';
import { watchCards } from './cards';
import { watchDrafts } from './drafts';
import { watchPage } from './watch';

export default defineContentScript({
	// No sites of its own: the background has it run on the sites of the packs that are on, and hands
	// it to the pages already open. Handed over twice, the newest copy is the one that carries on:
	// WXT has the older one let go of the page, and what that one painted is cleared as it is met.
	registration: 'runtime',
	main(ctx) {
		const failed = (error: unknown) => console.error('[barrunto] could not start', error);
		// Every pack of this site gets a watcher of its own, on or off: two packs may act on one site, and
		// each watcher works only while its own pack is on.
		for (const pack of packs) {
			if (!pack.sites.some((site) => new MatchPattern(site).includes(location.href))) continue;
			const page = pages[pack.id];
			const card = cards[pack.id];
			if (page) watchPage(ctx, pack, page).catch(failed);
			if (page?.drafts) watchDrafts(ctx, pack, page.drafts).catch(failed);
			if (card) watchCards(ctx, pack, card).catch(failed);
		}
	}
});
