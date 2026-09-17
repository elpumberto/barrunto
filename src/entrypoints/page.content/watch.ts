import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { labelsFor, packSettingsOf } from '@/engine';
import type { Item, Pack, PageHalf } from '@/engine';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { connection, pageSettings } from '@/storage/session';
import type { ConnectionStatus, Settings } from '@/storage/types';
import { ground } from './ground';
import { clearTuning, paintLabels, paintTuning } from './paint';
import { tuningFor } from './tuning';

/** How much of an item has to show, or of the screen it has to fill when it is taller than the screen. */
const IN_VIEW = 0.5;
/** A page changes in bursts: the items are gone over once the burst settles. */
const SETTLE_MS = 150;
/** How many analyzed items a tab remembers, for when the page draws them again on scrolling back. */
const ITEMS_REMEMBERED = 500;
/** Right after installing, the page can ask for the status before the background has opened session storage. */
const STATUS_TRIES = { times: 5, everyMs: 500 };

/** What came of looking at an item. */
type Outcome =
	| { item: Item; analysis: Analysis }
	| { skipped: string }
	| { failed: 'noReply' | 'extensionReloaded' };

/** What the tuning detail says for an item that was not analyzed. Why a pack skips one, it says in words itself. */
const IN_WORDS: Record<string, string> = {
	noKey: 'no key',
	paused: 'paused',
	keyRejected: 'key rejected',
	packOff: 'this pack is off',
	tooManyCalls: 'too many calls',
	serviceDown: 'service down',
	noNetwork: 'no network',
	noReply: 'no reply from the background',
	extensionReloaded: 'the extension was reloaded'
};

/** An item's element on the page: which item it shows, whether it has been asked about, and what came of it. */
interface Tracked {
	id: string | null;
	asked: boolean;
	outcome?: Outcome;
}

const analyzed = (outcome: Outcome | undefined) =>
	outcome !== undefined && 'item' in outcome && outcome.analysis.analyzed;

async function connectionNow(tries = STATUS_TRIES.times): Promise<ConnectionStatus> {
	try {
		return await connection.getValue();
	} catch (error) {
		if (tries <= 1) throw error;
		await new Promise((resolve) => setTimeout(resolve, STATUS_TRIES.everyMs));
		return connectionNow(tries - 1);
	}
}

/** Watches a page of the pack's for its items, has the ones that dwell analyzed, and paints what comes back. */
export async function watchPage(ctx: ContentScriptContext, pack: Pack, page: PageHalf) {
	const { rules } = pack;
	/** What is known of each item's element on the page. */
	const tracked = new WeakMap<HTMLElement, Tracked>();
	/** What came of each analyzed item, by id, for when the page draws it again. The oldest go first. */
	const remembered = new Map<string, Outcome>();
	const dwelling = new Map<HTMLElement, number>();

	let connectionStatus = await connectionNow();
	let currentSettings: Settings = await pageSettings.getValue();
	/** What the user has chosen for this pack, as it stands now. */
	const chosen = () => packSettingsOf(pack, currentSettings.packs[pack.id]);
	const reading = () =>
		!currentSettings.paused &&
		chosen().enabled &&
		(connectionStatus.state === 'connected' || connectionStatus.state === 'trouble');

	function remember(id: string, outcome: Outcome) {
		remembered.set(id, outcome);
		const oldest = remembered.keys().next().value;
		if (remembered.size > ITEMS_REMEMBERED && oldest !== undefined) remembered.delete(oldest);
	}

	function paint(article: HTMLElement, outcome: Outcome, arrive: boolean) {
		try {
			const { sensitivity, options } = chosen();
			const analysis = 'item' in outcome ? outcome.analysis : null;
			const labels = analysis?.analyzed
				? labelsFor(rules.judgments, analysis.strengths, sensitivity)
				: [];
			paintLabels(page.labelAnchor(article), labels, page.labelPlace, arrive);
			page.act?.(article, labels, options);

			const anchor = page.tuningAnchor(article);
			if (!currentSettings.tuning) return clearTuning(anchor);
			const reason = reasonOf(outcome);
			const tuning =
				'item' in outcome && outcome.analysis.analyzed
					? tuningFor(rules, outcome.analysis.answers, outcome.item, sensitivity)
					: { analyzed: false as const, reason: IN_WORDS[reason] ?? reason };
			paintTuning(anchor, tuning, ground());
		} catch (error) {
			console.error('[barrunto] could not paint a post', error);
		}
	}

	function unpaint(article: HTMLElement) {
		try {
			paintLabels(page.labelAnchor(article), [], page.labelPlace, false);
			page.act?.(article, [], chosen().options);
			clearTuning(page.tuningAnchor(article));
		} catch (error) {
			console.error('[barrunto] could not clear a post', error);
		}
	}

	async function look(article: HTMLElement) {
		const known = tracked.get(article);
		if (!known || known.asked || !reading() || ctx.isInvalid) return;

		const read = page.read(article);
		if (!read) {
			if (currentSettings.tuning) console.debug('[barrunto] could not read this item', article);
			return;
		}
		known.asked = true;

		let outcome: Outcome;
		if ('skipped' in read) {
			outcome = read;
		} else {
			const { item } = read;
			outcome = await send({ type: 'analyze', packId: pack.id, item }).then(
				(analysis): Outcome => (analysis ? { item, analysis } : { failed: 'noReply' }),
				(): Outcome => ({ failed: 'extensionReloaded' })
			);
			if (analyzed(outcome)) remember(item.id, outcome);
		}
		// The page may have given the element to another item while Jev was answering.
		if (tracked.get(article) !== known || !article.isConnected) return;
		known.outcome = outcome;
		paint(article, outcome, true);
	}

	const onScreen = new IntersectionObserver(
		(entries) => {
			for (const { target, intersectionRatio, intersectionRect, rootBounds } of entries) {
				const article = target as HTMLElement;
				window.clearTimeout(dwelling.get(article));
				dwelling.delete(article);

				// An item taller than the screen never shows half of itself: filling half the screen does.
				const fillsScreen = intersectionRect.height >= (rootBounds?.height ?? Infinity) * IN_VIEW;
				if (intersectionRatio < IN_VIEW && !fillsScreen) continue;
				dwelling.set(
					article,
					window.setTimeout(() => {
						onScreen.unobserve(article);
						dwelling.delete(article);
						void look(article);
					}, page.dwellMs)
				);
			}
		},
		{ threshold: [0, 0.1, 0.25, IN_VIEW] }
	);

	/** Goes over the items on the page: paints the ones already known, waits for the rest to dwell. */
	function scan() {
		// Reloading the extension leaves this script running in the open page, cut off from the rest:
		// asking whether it still holds is what makes it let go of the page.
		if (ctx.isInvalid) return;
		for (const article of page.find(document)) {
			const id = page.idOf(article);
			let mine = tracked.get(article);
			if (!mine || mine.id !== id) {
				if (mine) unpaint(article);
				const outcome = id ? remembered.get(id) : undefined;
				mine = { id, asked: outcome !== undefined, outcome };
				tracked.set(article, mine);
				if (outcome) paint(article, outcome, false);
			}
			if (!mine.asked && reading()) onScreen.observe(article);
		}
	}

	function repaint() {
		for (const article of page.find(document)) {
			const outcome = tracked.get(article)?.outcome;
			if (outcome) paint(article, outcome, true);
		}
	}

	/** An item that could not be analyzed gets another chance when Barrunto starts reading again. */
	function forgetFailures() {
		for (const article of page.find(document)) {
			const mine = tracked.get(article);
			if (!mine?.outcome || 'skipped' in mine.outcome || analyzed(mine.outcome)) continue;
			mine.asked = false;
			mine.outcome = undefined;
		}
	}

	let settling = 0;
	const changes = new MutationObserver(() => {
		if (settling) return;
		settling = window.setTimeout(() => {
			settling = 0;
			scan();
		}, SETTLE_MS);
	});

	/** Watches while Barrunto is reading; when it is not, it lets go of the page and leaves what is painted. */
	let wasReading = false;
	function startOrStop() {
		if (reading() === wasReading) return;
		wasReading = reading();
		if (wasReading) {
			forgetFailures();
			changes.observe(document.body, { childList: true, subtree: true });
			scan();
		} else {
			changes.disconnect();
			onScreen.disconnect();
			for (const timer of dwelling.values()) window.clearTimeout(timer);
			dwelling.clear();
		}
	}

	const unwatch = [
		pageSettings.watch((next) => {
			currentSettings = next;
			startOrStop();
			repaint();
		}),
		connection.watch((next) => {
			connectionStatus = next;
			startOrStop();
		})
	];
	ctx.onInvalidated(() => {
		// By now the extension is gone from under this script, and even letting go of storage throws.
		for (const stop of unwatch) {
			try {
				stop();
			} catch {
				// Nothing left to let go of.
			}
		}
		changes.disconnect();
		onScreen.disconnect();
	});

	startOrStop();
}

function reasonOf(outcome: Outcome): string {
	if ('skipped' in outcome) return outcome.skipped;
	if ('failed' in outcome) return outcome.failed;
	return outcome.analysis.analyzed ? '' : outcome.analysis.reason;
}
