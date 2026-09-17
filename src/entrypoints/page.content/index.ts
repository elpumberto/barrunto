import { defineContentScript } from 'wxt/utils/define-content-script';
import { MatchPattern } from 'wxt/utils/match-patterns';
import { packs } from '@/packs';
import { pages } from '@/packs/pages';
import { watchPage } from './watch';

export default defineContentScript({
	// No sites of its own: the background has it run on the sites of the packs that are on.
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
