import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';
import { packs } from '@/packs';
import { changePack, settings } from '@/storage';
import { inTurn } from '@/storage/in-turn';

/** The name Chrome keeps the content script under, and where the build leaves it. */
const SCRIPT = { id: 'barrunto', file: '/content-scripts/page.js' } as const;

/**
 * Has the content script run on the sites of the packs that are on, and on no others. A pack is on
 * when the user has turned it on and Chrome holds their leave to act on its sites. Leave comes and
 * goes outside Barrunto too: Chrome's question can outlive the popup that asked it, and leave can
 * be taken back from Chrome's own pages. Either way the pack follows.
 */
export function keepPacksCurrent() {
	settings.watch(sync);
	browser.permissions.onAdded.addListener(turnOnWhatGotLeave);
	browser.permissions.onRemoved.addListener(sync);
	void sync();
}

async function turnOnWhatGotLeave({ origins = [] }: Browser.permissions.Permissions) {
	for (const pack of packs) {
		if (pack.sites.every((site) => origins.includes(site))) {
			await changePack(pack, () => ({ enabled: true }));
		}
	}
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
		const before = registered?.matches ?? [];
		const script = { id: SCRIPT.id, js: [SCRIPT.file], matches: sites };
		if (!sites.length) {
			if (registered) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT.id] });
		} else if (!registered) {
			await browser.scripting.registerContentScripts([script]);
		} else if ([...before].sort().join() !== [...sites].sort().join()) {
			await browser.scripting.updateContentScripts([script]);
		}
		await reach(sites.filter((site) => !before.includes(site)));

		if (revoked.length) {
			const entries = revoked.map((id) => [id, { ...stored.packs[id]!, enabled: false }]);
			await settings.setValue({
				...stored,
				packs: { ...stored.packs, ...Object.fromEntries(entries) }
			});
		}
	}).catch((error) => console.error('[barrunto] could not register the packs', error));
}

/** Chrome runs a newly registered script only on pages loaded from then on: the ones already open get it by hand. */
async function reach(sites: string[]) {
	if (!sites.length) return;
	for (const { id } of await browser.tabs.query({ url: sites })) {
		if (id === undefined) continue;
		// A tab that cannot take it (still loading, discarded) picks the script up when it next loads.
		await browser.scripting
			.executeScript({ target: { tabId: id }, files: [SCRIPT.file] })
			.catch(() => {});
	}
}
