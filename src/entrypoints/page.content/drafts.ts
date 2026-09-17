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

/** What is known of a box: the words last seen in it, by their item's id, since when, and what came of asking. */
interface Seen {
	id: string | null;
	since: number;
	asked: boolean;
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
	let boxes: HTMLElement[] = [];
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
			const anchor = drafts.anchor(box);
			const told = seen.get(box)?.told;
			const hunch = told && reading() ? hunchOf(told, chosen().sensitivity) : null;
			if (!hunch) {
				clearDraft(anchor);
				return clearTuning(anchor);
			}
			const lit = ground();
			paintDraft(anchor, hunch, lit);
			// Said of words that have changed since, it stays dimmed until it is said again.
			if (told!.item.id !== seen.get(box)?.id) staleDraft(anchor);
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
		try {
			paintDraft(drafts.anchor(box), { state: 'waiting' }, ground());
		} catch (error) {
			console.error('[barrunto] could not paint a draft', error);
		}
		const analysis = await send({ type: 'analyze', packId: pack.id, item, urgent: true }).catch(
			() => undefined
		);
		// The words may have changed while Jev was answering: then this says nothing of them.
		if (seen.get(box) !== known || known.id !== item.id || !box.isConnected) return;
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
		boxes = drafts.find(document);
		for (const box of boxes) {
			const read = drafts.read(box);
			const item = read && 'item' in read ? read.item : null;
			let known = seen.get(box);
			if (!known || known.id !== (item?.id ?? null)) {
				known = { id: item?.id ?? null, since: Date.now(), asked: false, told: known?.told };
				seen.set(box, known);
				// Nothing left to say anything about, as when the post is sent and the box emptied.
				if (!item) {
					known.told = undefined;
					paint(box);
				} else staleDraft(drafts.anchor(box));
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
		changes.observe(document.body, { childList: true, subtree: true, characterData: true });
		check();
	}

	const unwatch = [
		pageSettings.watch((next) => {
			settings = next;
			startOrStop();
		}),
		connection.watch((next) => {
			status = next;
			startOrStop();
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
