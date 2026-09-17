import { browser } from 'wxt/browser';
import { packs } from '@/packs';
import { settings } from '@/storage';
import { inTurn } from '@/storage/in-turn';

/** The name Chrome keeps the content script under, and where the build leaves it. */
const SCRIPT = { id: 'barrunto', file: '/content-scripts/page.js' };

/**
 * Has the content script run on the sites of the packs that are on, and on no others. A pack is on
 * when the user has turned it on and Chrome holds their leave to act on its sites; the leave can be
 * taken back from Chrome's own pages, and then the pack is turned off here to match.
 */
export function keepPacksCurrent() {
	settings.watch(sync);
	browser.permissions.onRemoved.addListener(sync);
	void sync();
}

function sync(): Promise<void> {
	return inTurn(async () => {
		const stored = await settings.getValue();
		const sites: string[] = [];
		const revoked: string[] = [];
		for (const pack of packs) {
			if (!stored.packs[pack.id]?.enabled) continue;
			if (await browser.permissions.contains({ origins: pack.sites })) sites.push(...pack.sites);
			else revoked.push(pack.id);
		}

		// Only when the sites change: taking the script down and up again would miss a page loading meanwhile.
		const [registered] = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT.id] });
		const script = { id: SCRIPT.id, js: [SCRIPT.file], matches: sites };
		if (!sites.length) {
			if (registered) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT.id] });
		} else if (!registered) {
			await browser.scripting.registerContentScripts([script]);
		} else if ([...(registered.matches ?? [])].sort().join() !== [...sites].sort().join()) {
			await browser.scripting.updateContentScripts([script]);
		}

		if (revoked.length) {
			const entries = revoked.map((id) => [id, { ...stored.packs[id]!, enabled: false }]);
			await settings.setValue({
				...stored,
				packs: { ...stored.packs, ...Object.fromEntries(entries) }
			});
		}
	}).catch((error) => console.error('[barrunto] could not register the packs', error));
}
