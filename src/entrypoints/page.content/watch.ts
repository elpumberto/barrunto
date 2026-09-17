import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { labelsFor, packSettingsOf, treatmentFor } from '@/engine';
import type { Item, Pack, PageHalf } from '@/engine';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { connection, pageSettings } from '@/storage/session';
import type { ConnectionStatus, Settings } from '@/storage/types';
import { ground } from './ground';
import {
	clearLabels,
	clearTuning,
	paintLabels,
	paintTreatment,
	paintTuning,
	paintWaiting
} from './paint';
import { tuningFor } from './tuning';

/** How much of an item has to show, or of the screen it has to fill when it is taller than the screen. */
const IN_VIEW = 0.5;
/** A page changes in bursts: the items are gone over this long after one starts, and no more often. */
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
	malformed: 'not an item this pack understands',
	tooManyCalls: 'too many calls',
	serviceDown: 'service down',
	noNetwork: 'no network',
	noReply: 'no reply from the background',
	extensionReloaded: 'the extension was reloaded'
};

/**
 * An item's element on the page: which item it shows, whether it has been asked about, and what
 * came of it. While the answer is on its way, `waitingFor` is the item asked about and `urgent`
 * says whether it was asked as something in front of the user or as something read ahead of them.
 */
interface Tracked {
	id: string | null;
	asked: boolean;
	waitingFor?: Item;
	urgent?: boolean;
	outcome?: Outcome;
	/** Where its labels go, which may be outside the element and so outlive it. */
	anchor: HTMLElement;
}

/** What Barrunto puts in the page carries this, whatever it is. */
const OURS = 'data-barrunto';

/** Whether the page draws the element at all: a comment folded away with its thread is there, and is not. */
const drawn = (element: HTMLElement) => element.checkVisibility?.() ?? true;

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
	const placeOf = (element: HTMLElement) =>
		typeof page.labelPlace === 'function' ? page.labelPlace(element) : page.labelPlace;
	/** What is known of each item's element on the page. */
	const tracked = new WeakMap<HTMLElement, Tracked>();
	/** What came of each analyzed item, by id, for when the page draws it again. The oldest go first. */
	const remembered = new Map<string, Outcome>();
	const dwelling = new Map<HTMLElement, number>();
	/** The items the user asked to see after all, hidden as they were, by id. */
	const revealed = new Set<string>();
	/** The items the browser is told about, and the ones of them that show on screen, however little. */
	const watched = new Set<HTMLElement>();
	const inSight = new Set<HTMLElement>();
	/** The ones that show enough of themselves to be read, when nothing is read ahead. */
	const inView = new Set<HTMLElement>();
	/** The items on the page as of the last time it was gone over, in the page's order. */
	let items: HTMLElement[] = [];

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

	function paint(element: HTMLElement, outcome: Outcome, arrive: boolean) {
		try {
			const { sensitivity, treatments } = chosen();
			const analysis = 'item' in outcome ? outcome.analysis : null;
			const labels = analysis?.analyzed
				? labelsFor(rules.judgments, analysis.strengths, sensitivity)
				: [];
			// Read off the page once, before anything is written to it.
			const anchor = page.labelAnchor(element);
			const place = placeOf(element);
			const parts = page.parts(element);
			const lit = ground();
			paintLabels(anchor, labels, place, arrive);

			const id = 'item' in outcome ? outcome.item.id : null;
			paintTreatment(parts, id && revealed.has(id) ? 'label' : treatmentFor(labels, treatments), {
				// Labels that go with what is hidden are named in the line; the ones that stay hang over it.
				named: parts.hidden.some((part) => part.contains(anchor)) ? labels : [],
				roomy: place !== 'inline',
				ground: lit,
				show() {
					// The page may have given the element to another item since the line was drawn.
					if (tracked.get(element)?.outcome !== outcome) return;
					if (id) revealed.add(id);
					paint(element, outcome, false);
				}
			});

			const under = page.tuningAnchor(element);
			if (!currentSettings.tuning) return clearTuning(under);
			const reason = reasonOf(outcome);
			const tuning =
				'item' in outcome && outcome.analysis.analyzed
					? tuningFor(rules, outcome.analysis.answers, outcome.item, sensitivity)
					: { analyzed: false as const, reason: IN_WORDS[reason] ?? reason };
			paintTuning(under, tuning, lit, page.tuningInset);
		} catch (error) {
			console.error('[barrunto] could not paint an item', error);
		}
	}

	/** Takes away whatever Barrunto did to an item's element, this copy of the script or one before it. */
	function unpaint(element: HTMLElement) {
		try {
			clearLabels(page.labelAnchor(element));
			const none = { named: [], roomy: false, ground: ground(), show() {} };
			paintTreatment(page.parts(element), 'label', none);
			clearTuning(page.tuningAnchor(element));
		} catch (error) {
			console.error('[barrunto] could not clear an item', error);
		}
	}

	/** Has an item analyzed, once. `urgent`: it is in front of the user, and not being read ahead of them. */
	async function look(element: HTMLElement, urgent: boolean) {
		const known = tracked.get(element);
		if (!known || !reading() || ctx.isInvalid || !element.isConnected) return;
		if (known.asked) {
			// The user has caught up with an item read ahead whose answer is still on its way: it goes first now.
			if (urgent && known.waitingFor && !known.urgent) {
				known.urgent = true;
				const hurried = {
					type: 'analyze',
					packId: pack.id,
					item: known.waitingFor,
					urgent
				} as const;
				send(hurried).catch(() => {});
			}
			return;
		}

		const read = page.read(element);
		if (!read) {
			if (currentSettings.tuning) console.debug('[barrunto] could not read this item', element);
			return;
		}
		known.asked = true;

		let outcome: Outcome;
		if ('skipped' in read) {
			outcome = read;
		} else {
			const { item } = read;
			known.waitingFor = item;
			known.urgent = urgent;
			try {
				paintWaiting(page.labelAnchor(element), placeOf(element));
			} catch (error) {
				console.error('[barrunto] could not paint an item', error);
			}
			outcome = await send({ type: 'analyze', packId: pack.id, item, urgent }).then(
				(analysis): Outcome => (analysis ? { item, analysis } : { failed: 'noReply' }),
				(): Outcome => ({ failed: 'extensionReloaded' })
			);
			known.waitingFor = undefined;
			if (analyzed(outcome)) remember(item.id, outcome);
		}
		// The page may have given the element to another item while Jev was answering.
		if (tracked.get(element) !== known || !element.isConnected) return;
		known.outcome = outcome;
		paint(element, outcome, true);
	}

	/**
	 * Reading ahead: what shows on screen is asked about at once, and so are the next few items past
	 * the last of them, so that their labels are there by the time the user is. With nothing to read
	 * ahead, an item is asked about only once it has dwelt on screen, and this does nothing.
	 */
	function readAhead() {
		const ahead = currentSettings.lookAhead;
		if (!ahead || !reading() || !inSight.size) return;
		for (const item of inSight) void look(item, true);

		let last = items.length - 1;
		while (last >= 0 && !inSight.has(items[last]!)) last--;
		// Only as many as are read ahead are asked whether they are drawn: a thread can hold a thousand.
		for (let next = last + 1, read = 0; last >= 0 && next < items.length && read < ahead; next++) {
			if (!drawn(items[next]!)) continue;
			read++;
			void look(items[next]!, false);
		}
	}

	/** With nothing read ahead, an item is read once it has stayed in view for a moment. */
	function dwell(element: HTMLElement) {
		if (dwelling.has(element) || tracked.get(element)?.asked) return;
		dwelling.set(
			element,
			window.setTimeout(() => {
				dwelling.delete(element);
				void look(element, true);
			}, page.dwellMs)
		);
	}

	const onScreen = new IntersectionObserver(
		(entries) => {
			for (const { target, intersectionRatio, intersectionRect, rootBounds } of entries) {
				const element = target as HTMLElement;
				if (intersectionRatio > 0) inSight.add(element);
				else inSight.delete(element);

				// An item taller than the screen never shows half of itself: filling half the screen does.
				const fillsScreen = intersectionRect.height >= (rootBounds?.height ?? Infinity) * IN_VIEW;
				if (intersectionRatio >= IN_VIEW || fillsScreen) inView.add(element);
				else inView.delete(element);

				window.clearTimeout(dwelling.get(element));
				dwelling.delete(element);
				if (!currentSettings.lookAhead && inView.has(element)) dwell(element);
			}
			readAhead();
		},
		{ threshold: [0, 0.1, 0.25, IN_VIEW] }
	);

	/** Goes over the items on the page: paints the ones already known, and has the rest watched. */
	function scan() {
		// Reloading the extension leaves this script running in the open page, cut off from the rest:
		// asking whether it still holds is what makes it let go of the page.
		if (ctx.isInvalid) return;
		items = page.find(document);
		for (const element of items) {
			const id = page.idOf(element);
			let mine = tracked.get(element);
			if (!mine || mine.id !== id) {
				// Whatever is there is another item's: this element's before, or, on an element never
				// seen, what an earlier copy of this script left, or labels kept outside an element gone.
				unpaint(element);
				const outcome = id ? remembered.get(id) : undefined;
				mine = { id, asked: outcome !== undefined, outcome, anchor: page.labelAnchor(element) };
				tracked.set(element, mine);
				if (outcome) paint(element, outcome, false);
			}
			if (reading() && !watched.has(element)) {
				watched.add(element);
				onScreen.observe(element);
			}
			// An item that could not be read when it came into view, such as a folded comment, is not
			// told about again while it stays there: it is given its moment once it can be.
			if (reading() && !currentSettings.lookAhead && inView.has(element)) dwell(element);
		}
		// The browser is told about every item, asked about or not, to know which is the last in
		// sight; the ones the page has taken away are let go of, and so is what they left outside them.
		for (const element of watched) {
			if (element.isConnected) continue;
			watched.delete(element);
			inSight.delete(element);
			inView.delete(element);
			onScreen.unobserve(element);
			const anchor = tracked.get(element)?.anchor;
			if (anchor?.isConnected && !page.find(anchor).length) clearLabels(anchor);
		}
		readAhead();
	}

	function repaint() {
		for (const element of items) {
			const outcome = tracked.get(element)?.outcome;
			if (outcome) paint(element, outcome, true);
		}
	}

	/** An item that could not be analyzed gets another chance when Barrunto starts reading again. */
	function forgetFailures() {
		for (const element of items) {
			const mine = tracked.get(element);
			if (!mine?.outcome || 'skipped' in mine.outcome || analyzed(mine.outcome)) continue;
			mine.asked = false;
			mine.outcome = undefined;
		}
	}

	/** What Barrunto itself puts in the page and takes out of it is no reason to go over the page again. */
	const isOurs = (node: Node) => node instanceof Element && node.hasAttribute(OURS);
	let settling = 0;
	const changes = new MutationObserver((records) => {
		if (settling) return;
		if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every(isOurs))) return;
		settling = window.setTimeout(() => {
			settling = 0;
			scan();
		}, SETTLE_MS);
	});

	function letGo() {
		changes.disconnect();
		onScreen.disconnect();
		watched.clear();
		inSight.clear();
		inView.clear();
		window.clearTimeout(settling);
		settling = 0;
		for (const timer of dwelling.values()) window.clearTimeout(timer);
		dwelling.clear();
	}

	/** Has the browser tell again what is on screen, for the items that are owed another look. */
	function lookAgain() {
		if (!reading()) return;
		onScreen.disconnect();
		watched.clear();
		inSight.clear();
		inView.clear();
		scan();
	}

	/** Watches while Barrunto is reading; when it is not, it lets go of the page and leaves what is painted. */
	let wasReading = false;
	function startOrStop() {
		if (reading() === wasReading) return;
		wasReading = reading();
		if (!wasReading) return letGo();
		forgetFailures();
		changes.observe(document.body, { childList: true, subtree: true });
		scan();
	}

	const unwatch = [
		pageSettings.watch((next) => {
			const waitsAgain = currentSettings.lookAhead > 0 && next.lookAhead === 0;
			currentSettings = next;
			startOrStop();
			repaint();
			// Items passed over while reading ahead now have to dwell, and nothing has told of them since.
			if (waitsAgain) lookAgain();
			else readAhead();
		}),
		connection.watch((next) => {
			const recovered = connectionStatus.state === 'trouble' && next.state === 'connected';
			connectionStatus = next;
			startOrStop();
			// What failed while Jev was in trouble gets another chance now, not only after a pause.
			if (recovered) {
				forgetFailures();
				lookAgain();
			}
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
		letGo();
	});

	startOrStop();
}

function reasonOf(outcome: Outcome): string {
	if ('skipped' in outcome) return outcome.skipped;
	if ('failed' in outcome) return outcome.failed;
	return outcome.analysis.analyzed ? '' : outcome.analysis.reason;
}
