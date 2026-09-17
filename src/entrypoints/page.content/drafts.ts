import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { labelledFrom, packSettingsOf } from '@/engine';
import type { DraftsHalf, Item, Pack, Sensitivity } from '@/engine';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { connection, pageSettings } from '@/storage/session';
import { ground } from './ground';
import { clearDraft, clearTuning, paintDraft, paintTuning, staleDraft } from './paint';
import type { Hunch } from './paint';
import { tuningFor } from './tuning';
import { connectionNow } from './watch';

/** The words have to stay as they are this long before Jev is asked about them: nobody pays for every key pressed. */
export const PAUSE_MS = 1200;
/** A page changes in bursts: the boxes are gone over this long after one starts, and no more often. */
const SETTLE_MS = 300;

/**
 * What is known of a box: the words last seen in it, by their item's id, since when, whether they
 * were asked about and the answer is still on its way, what came of asking, and where it was painted.
 */
interface Seen {
	id: string | null;
	since: number;
	asked: boolean;
	waiting: boolean;
	anchor?: HTMLElement;
	told?: { item: Item; analysis: Analysis | undefined };
}

const IN_WORDS: Record<string, string> = {
	tooManyCalls: 'too many calls',
	serviceDown: 'service down',
	noNetwork: 'no network'
};

/**
 * Watches what the user writes on a page of the pack's and tells them, under it, how it would be
 * read: the same questions, recipes and thresholds as for anybody else's. It asks once the words
 * have stayed still for a moment, and only while Barrunto is reading.
 */
export async function watchDrafts(ctx: ContentScriptContext, pack: Pack, drafts: DraftsHalf) {
	const seen = new WeakMap<HTMLElement, Seen>();
	/** The boxes something may be painted under. */
	const boxes = new Set<HTMLElement>();
	let status = await connectionNow();
	let settings = await pageSettings.getValue();
	const chosen = () => packSettingsOf(pack, settings.packs[pack.id]);
	const reading = () =>
		!settings.paused &&
		settings.checkDrafts &&
		chosen().enabled &&
		(status.state === 'connected' || status.state === 'trouble');

	function hunchOf(told: NonNullable<Seen['told']>, sensitivity: Sensitivity): Hunch | null {
		const { analysis } = told;
		if (analysis?.analyzed) {
			const rows = pack.rules.judgments.flatMap((judgment) => {
				const strength = analysis.strengths[judgment.id] ?? 0;
				const from = labelledFrom(judgment, strength);
				return from ? [{ judgment, strength, from }] : [];
			});
			return { state: 'told', sensitivity, rows };
		}
		// Paused, no key, pack off: Barrunto is not reading, and says nothing of it here either.
		const reason = analysis ? IN_WORDS[analysis.reason] : 'no reply';
		return reason ? { state: 'failed', reason } : null;
	}

	function paint(box: HTMLElement) {
		try {
			const known = seen.get(box);
			const anchor = drafts.anchor(box);
			// The page may have grown around the box since: what was painted elsewhere goes.
			if (known?.anchor && known.anchor !== anchor) {
				clearDraft(known.anchor);
				clearTuning(known.anchor);
			}
			if (known) known.anchor = anchor;
			const told = known?.told;
			const said = told && reading() ? hunchOf(told, chosen().sensitivity) : null;
			const hunch: Hunch | null =
				said ?? (known?.waiting && reading() ? { state: 'waiting' } : null);
			if (!hunch) {
				clearDraft(anchor);
				return clearTuning(anchor);
			}
			const lit = ground();
			paintDraft(anchor, hunch, lit);
			// Said of words that have changed since, it stays dimmed until it is said again.
			if (told && told.item.id !== known?.id) staleDraft(anchor);
			const analysis = told?.analysis;
			if (!settings.tuning || !analysis?.analyzed) return clearTuning(anchor);
			const { rules } = pack;
			paintTuning(
				anchor,
				tuningFor(rules, analysis.answers, told!.item, chosen().sensitivity),
				lit
			);
		} catch (error) {
			console.error('[barrunto] could not paint a draft', error);
		}
	}

	async function ask(box: HTMLElement, known: Seen, item: Item) {
		known.asked = true;
		known.waiting = true;
		paint(box);
		const analysis = await send({ type: 'analyze', packId: pack.id, item, urgent: true }).catch(
			() => undefined
		);
		known.waiting = false;
		// The words may have changed while Jev was answering: then this says nothing of them. Nor
		// does a copy of this script that the extension has been reloaded from under.
		if (ctx.isInvalid || seen.get(box) !== known || !box.isConnected) return;
		known.told = { item, analysis };
		paint(box);
	}

	let timer = 0;
	let due = 0;
	/** Has the boxes gone over this long from now, or sooner if that was already coming. */
	const soon = (ms: number) => {
		if (timer && due <= Date.now() + ms) return;
		window.clearTimeout(timer);
		due = Date.now() + ms;
		timer = window.setTimeout(() => {
			timer = 0;
			check();
		}, ms);
	};

	/** Goes over the boxes: what has changed waits for its words to stay still, and what has, is asked about. */
	function check() {
		if (ctx.isInvalid || !reading()) return;
		for (const box of boxes) if (!box.isConnected) boxes.delete(box);
		for (const box of drafts.find(document)) {
			boxes.add(box);
			const read = drafts.read(box);
			const item = read && 'item' in read ? read.item : null;
			let known = seen.get(box);
			if (!known || known.id !== (item?.id ?? null)) {
				// Nothing left to say anything about, as when the post is sent and the box emptied. Words
				// put back as they were when asked about need no asking again.
				const told = item ? known?.told : undefined;
				const same = told?.analysis?.analyzed === true && told.item.id === item?.id;
				known = {
					id: item?.id ?? null,
					since: Date.now(),
					asked: same,
					waiting: false,
					anchor: known?.anchor,
					told
				};
				seen.set(box, known);
				paint(box);
			}
			if (!item || known.asked) continue;
			const still = Date.now() - known.since;
			if (still >= PAUSE_MS) void ask(box, known, item);
			else soon(PAUSE_MS - still);
		}
	}

	/** What Barrunto itself puts in the page is no reason to go over it again. */
	const isOurs = (node: Node) => node instanceof Element && node.hasAttribute('data-barrunto');
	const changes = new MutationObserver((records) => {
		const ours = (r: MutationRecord) =>
			r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(isOurs);
		if (records.every(ours)) return;
		soon(SETTLE_MS);
	});

	/** What could not be checked gets another chance when Barrunto starts reading again, or Jev recovers. */
	function forgetFailures() {
		for (const box of boxes) {
			const known = seen.get(box);
			if (!known?.asked || known.waiting || known.told?.analysis?.analyzed) continue;
			known.asked = false;
			known.told = undefined;
		}
	}

	let wasReading = false;
	function startOrStop() {
		for (const box of boxes) if (box.isConnected) paint(box);
		if (reading() === wasReading) return;
		wasReading = reading();
		if (!wasReading) {
			changes.disconnect();
			window.clearTimeout(timer);
			timer = 0;
			return;
		}
		forgetFailures();
		changes.observe(document.body, { childList: true, subtree: true, characterData: true });
		check();
	}

	const unwatch = [
		pageSettings.watch((next) => {
			settings = next;
			startOrStop();
		}),
		connection.watch((next) => {
			const recovered = status.state === 'trouble' && next.state === 'connected';
			status = next;
			startOrStop();
			if (recovered && reading()) {
				forgetFailures();
				check();
			}
		})
	];
	ctx.onInvalidated(() => {
		for (const stop of unwatch) {
			try {
				stop();
			} catch {
				// Nothing left to let go of.
			}
		}
		changes.disconnect();
		window.clearTimeout(timer);
	});

	startOrStop();
}
