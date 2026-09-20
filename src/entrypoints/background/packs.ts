import { browser } from 'wxt/browser';
import { sitesOf } from '@/engine';
import type { Pack } from '@/engine';
import { packById, packs } from '@/packs';
import { ASKED_FOR_MS, askedFor, changePack, settings } from '@/storage';
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
 * Chrome's question can outlive the popup that asked it, so the answer is taken here. Chrome says
 * which sites leave arrived for, in words of its own, and not which pack it was asked for: two packs
 * may act on the same site, so the popup notes the pack before asking, and only that one is turned
 * on. Leave that arrives with nobody having asked, given from Chrome's own pages, turns nothing on:
 * the pack's switch is there for that, and Chrome has no question left to ask.
 */
async function turnOnWhatGotLeave() {
	const asked = await askedFor.getValue();
	// A note left by a question that was turned down says nothing of leave that arrives long after.
	const fresh = asked !== null && Date.now() - asked.at < ASKED_FOR_MS;
	const pack = fresh ? packById(asked.packId) : undefined;
	if (asked && !fresh) await askedFor.removeValue();
	if (pack && (await hasLeave(pack))) {
		await askedFor.removeValue();
		await changePack(pack, () => ({ enabled: true }));
	}
	await sync();
}

function sync(): Promise<void> {
	return inTurn(async () => {
		const sites = sitesOf(await packsOn());

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
	await reach(sitesOf(await packsOn()));
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
