import { defineContentScript } from 'wxt/utils/define-content-script';
import { MatchPattern } from 'wxt/utils/match-patterns';
import { packs } from '@/packs';
import { pages } from '@/packs/pages';
import { watchPage } from './watch';

export default defineContentScript({
	// No sites of its own: the background has it run on the sites of the packs that are on.
	registration: 'runtime',
	main(ctx) {
		// A page already open when its pack is turned on is handed the script by the background, and a
		// pack turned off and on again would hand it over twice: the one already there carries on.
		const world = globalThis as { barruntoIsHere?: boolean };
		if (world.barruntoIsHere) return;
		world.barruntoIsHere = true;

		const pack = packs.find(({ sites }) =>
			sites.some((site) => new MatchPattern(site).includes(location.href))
		);
		const page = pack && pages[pack.id];
		if (!page) return;
		watchPage(ctx, pack, page).catch((error) => console.error('[barrunto] could not start', error));
	}
});
