import { browser } from 'wxt/browser';
import type { Pack } from '@/engine';
import { packs } from '@/packs';
import { changePack, settings } from '@/storage';
import { takingTurns } from '@/storage/in-turn';

/** The name Chrome keeps the content script under, and where the build leaves it. */
const SCRIPT = { id: 'barrunto', file: '/content-scripts/page.js' } as const;

const inTurn = takingTurns();

/** Whether Chrome holds the user's leave for Barrunto to act on the pack's sites. */
export const hasLeave = (pack: Pack) => browser.permissions.contains({ origins: pack.sites });

/**
 * The packs that are on: the ones the user has turned on and Chrome holds their leave for. The two
 * are kept apart. What the user asked for is theirs and is never changed here; leave comes and goes
 * outside Barrunto: taken back from Chrome's own pages, or never carried over by an update. A pack
 * that is wanted and has no leave is off, and the popup says what it is missing.
 */
export async function packsOn(): Promise<Pack[]> {
	const { packs: chosen } = await settings.getValue();
	const on: Pack[] = [];
	for (const pack of packs) if (chosen[pack.id]?.enabled && (await hasLeave(pack))) on.push(pack);
	return on;
}

/** Has the content script run on the sites of the packs that are on, and on no others. */
export function keepPacksCurrent() {
	settings.watch(sync);
	browser.permissions.onAdded.addListener(turnOnWhatGotLeave);
	browser.permissions.onRemoved.addListener(sync);
	void sync();
}

/**
 * Chrome's question can outlive the popup that asked it, so the answer is taken here. Leave is given
 * back whenever a pack is turned off, so a pack that has it is one the user wants on. Chrome may
 * word the sites its own way: what counts is whether it now holds leave for them, not how it says so.
 */
async function turnOnWhatGotLeave() {
	for (const pack of packs) {
		if (await hasLeave(pack)) await changePack(pack, () => ({ enabled: true }));
	}
	await sync();
}

function sync(): Promise<void> {
	return inTurn(async () => {
		const sites = (await packsOn()).flatMap((pack) => pack.sites);

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
		return sites.filter((site) => !before.includes(site));
	}).then(reach, (error: unknown) =>
		console.error('[barrunto] could not register the packs', error)
	);
}

/**
 * After an update, or a reload while working on it, the pages already open are left with a copy of
 * the script that the extension has gone from under. They are handed the new one.
 */
export async function reachOpenTabs() {
	await sync();
	await reach((await packsOn()).flatMap((pack) => pack.sites));
}

/**
 * Chrome runs a newly registered script only on pages loaded from then on: the ones already open
 * get it by hand. Nobody waits for this: a tab that is slow to take it holds nothing else up, and
 * one that cannot take it (still loading, discarded) picks the script up when it next loads.
 */
async function reach(sites: string[]) {
	if (!sites.length) return;
	const tabs = await browser.tabs.query({ url: sites });
	const taking = tabs.flatMap(({ id }) =>
		id === undefined
			? []
			: [browser.scripting.executeScript({ target: { tabId: id }, files: [SCRIPT.file] })]
	);
	void Promise.allSettled(taking);
}
