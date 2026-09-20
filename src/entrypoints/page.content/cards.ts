import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { packSettingsOf } from '@/engine';
import type { CardHalf, Item, Pack } from '@/engine';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { connection, pageSettings } from '@/storage/session';
import { cardFor, sheetFor } from './card';
import type { Card } from './card';
import { ground } from './ground';
import { clearCard, clearTuning, paintCard, paintedIn, paintTuning } from './paint';
import { tuningFor } from './tuning';
import { connectionNow } from './watch';

/** A page changes in bursts: it is gone over this long after one starts, and no more often. */
const SETTLE_MS = 300;
/** A page that has not changed for this long has settled: what it shows by then is what there is. */
export const QUIET_MS = 2000;
/** A page that never stops changing is taken for settled this long after what it is about was first read. */
export const LONGEST_WAIT_MS = 6000;

/** However much more a page goes on to show, what it is about is not asked about more times than this. */
const MOST_LOOKS = 6;

/** How far in the tuning detail goes, to sit under the card and not at the edge of the page. */
const TUNING_INSET = '16px';

/**
 * What is known of what the page is about now: since when it could be read, whether it was asked
 * about and the answer is still on its way, what came of it, and where the card was painted.
 */
interface Subject {
	id: string;
	readSince: number | null;
	asked: boolean;
	waitingFor?: Item;
	told?: { item: Item; analysis: Analysis | undefined };
	/** How many times it was asked about, and the item last asked about: what is worth another look is told against it. */
	looks: number;
	lastAsked?: Item;
	/** What is painted of it, in a word, and where: the same is not painted again. */
	painted?: { anchor: HTMLElement; what: string };
	/** Why it is not for asking about, in words, while that holds. */
	skipped?: string;
	anchor?: HTMLElement;
}

const IN_WORDS: Record<string, string> = {
	tooManyCalls: 'too many calls',
	serviceDown: 'service down',
	noNetwork: 'no network'
};

/**
 * Watches a site of the pack's for the pages that are about one thing, such as a profile, has that
 * thing analyzed and shows a card about it. The site may go from one such page to another, or
 * to one that is about nothing, without loading anything: what the address says is asked again on
 * every change of the page.
 */
export async function watchCards(ctx: ContentScriptContext, pack: Pack, half: CardHalf) {
	const texts = pack.card;
	if (!texts) return;
	let subject: Subject | null = null;
	let lastChange = Date.now();
	let status = await connectionNow();
	let settings = await pageSettings.getValue();
	const chosen = () => packSettingsOf(pack, settings.packs[pack.id]);
	const reading = () =>
		!settings.paused &&
		chosen().enabled &&
		(status.state === 'connected' || status.state === 'trouble');

	function cardOf(known: Subject): Card | null {
		// Asked about again, what was said before stays until there is something new to say.
		if (known.waitingFor && !known.told?.analysis?.analyzed) {
			const sheet = sheetFor(texts!, known.waitingFor, texts!.stamps.asking);
			return { ...sheet, state: 'asking', asking: texts!.asking };
		}
		if (!known.told) return null;
		const { item, analysis } = known.told;
		if (analysis?.analyzed) {
			return cardFor(pack.rules, texts!, analysis.answers, item, chosen().sensitivity);
		}
		// Paused, no key, pack off: Barrunto is not reading, and says nothing of it here either.
		const reason = analysis ? IN_WORDS[analysis.reason] : 'no reply';
		return reason
			? { ...sheetFor(texts!, item, texts!.stamps.asking), state: 'failed', reason }
			: null;
	}

	function unpaint(anchor: HTMLElement | undefined) {
		if (!anchor) return;
		clearCard(anchor);
		clearTuning(anchor);
	}

	function paint() {
		try {
			const anchor = half.anchor(document);
			// The page may have been drawn again around the card since: what was painted elsewhere goes.
			if (subject?.anchor && subject.anchor !== anchor) unpaint(subject.anchor);
			if (subject) subject.anchor = anchor ?? undefined;
			if (!anchor) return;
			const card = subject && reading() ? cardOf(subject) : null;
			const lit = ground();
			const analysis = subject?.told?.analysis;
			const tuned = Boolean(subject && reading() && settings.tuning);

			// A page like X.com's changes all the time, and this is gone over on every change: what is
			// there already, saying the same, is left alone. Painting it again would take away what the
			// user has selected in it, and have it read out again to whoever listens to the page.
			const what = JSON.stringify([
				card?.state,
				card?.state === 'failed' && card.reason,
				subject?.told?.item.id ?? subject?.waitingFor?.id,
				analysis && (analysis.analyzed || analysis.reason),
				subject?.skipped,
				chosen().sensitivity,
				tuned,
				lit
			]);
			const there = paintedIn(anchor);
			const same = subject?.painted?.anchor === anchor && subject.painted.what === what;
			if (same && there.card === Boolean(card) && (there.tuning || !tuned)) return;
			if (subject) subject.painted = { anchor, what };

			if (card) paintCard(anchor, card, chosen().sensitivity, lit);
			else clearCard(anchor);

			if (!subject || !tuned) return clearTuning(anchor);
			if (analysis?.analyzed) {
				const { sensitivity } = chosen();
				paintTuning(
					anchor,
					tuningFor(pack.rules, analysis.answers, subject.told!.item, sensitivity),
					lit,
					TUNING_INSET
				);
			} else if (analysis || subject.skipped) {
				// Why a pack skips one, it says in words itself; why the background did not ask, in a word.
				const reason = analysis ? (IN_WORDS[analysis.reason] ?? analysis.reason) : subject.skipped!;
				paintTuning(anchor, { analyzed: false, reason }, lit, TUNING_INSET);
			} else clearTuning(anchor);
		} catch (error) {
			console.error('[barrunto] could not paint a card', error);
		}
	}

	async function ask(known: Subject, item: Item) {
		known.asked = true;
		known.looks++;
		known.lastAsked = item;
		known.waitingFor = item;
		paint();
		const analysis = await send({ type: 'analyze', packId: pack.id, item, urgent: true }).catch(
			() => undefined
		);
		known.waitingFor = undefined;
		// The user may have gone to another page while Jev was answering: then this says nothing of
		// it. Nor does a copy of this script that the extension has been reloaded from under.
		if (ctx.isInvalid || subject !== known) return;
		// Another look that came to nothing takes nothing away from what the one before said.
		if (analysis?.analyzed || !known.told?.analysis?.analyzed) known.told = { item, analysis };
		paint();
		// Turned down for what no longer holds (a pause since lifted, a pack since turned on again, while
		// the call waited its turn), it is asked about again, and not left with nothing said of it.
		const lifted = analysis && !analysis.analyzed && !IN_WORDS[analysis.reason];
		if (lifted && analysis.reason !== 'malformed' && reading() && known.looks < MOST_LOOKS) {
			forgetFailure();
			check();
		}
	}

	let timer = 0;
	let due = 0;
	/** Has the page gone over this long from now, or sooner if that was already coming. */
	const soon = (ms: number) => {
		if (timer && due <= Date.now() + ms) return;
		window.clearTimeout(timer);
		due = Date.now() + ms;
		timer = window.setTimeout(() => {
			timer = 0;
			check();
		}, ms);
	};

	/** Goes over the page: what it is about now, whether that can be read yet, and whether it is time to ask. */
	function check() {
		if (ctx.isInvalid || !reading()) return;
		const id = half.subjectOf(location.href);
		if (id !== (subject?.id ?? null)) {
			unpaint(subject?.anchor);
			subject = id === null ? null : { id, readSince: null, asked: false, looks: 0 };
		}
		if (!subject) return;
		// Asked about already: the card is put back if the page drew itself again without it. The page
		// is still read: it may have shown enough since to be worth another look.
		if (subject.asked) {
			paint();
			const { told } = subject;
			if (subject.waitingFor || subject.looks >= MOST_LOOKS || !told?.analysis?.analyzed) return;
			const now = half.again && half.read(document, subject.id);
			// Against what was last asked about, answered or not: a look that failed is not tried again
			// with every post the page shows next.
			if (!now || !('item' in now) || now.item.id === subject.lastAsked?.id) return;
			if (half.again!(now.item, subject.lastAsked ?? told.item)) void ask(subject, now.item);
			return;
		}

		const read = half.read(document, subject.id);
		if (!read) return;
		if ('skipped' in read) {
			subject.skipped = read.skipped;
			return paint();
		}
		subject.readSince ??= Date.now();
		const now = Date.now();
		const settlesIn = Math.min(
			lastChange + QUIET_MS - now,
			subject.readSince + LONGEST_WAIT_MS - now
		);
		if (half.ready(read.item, settlesIn <= 0)) {
			subject.skipped = undefined;
			return void ask(subject, read.item);
		}
		if (settlesIn > 0) return soon(settlesIn);
		// Settled with too little on it. The page may still bring more: then it is gone over again.
		subject.skipped = 'too little to tell';
		paint();
	}

	/** What Barrunto itself puts in the page is no reason to go over it again. */
	const isOurs = (node: Node) => node instanceof Element && node.hasAttribute('data-barrunto');
	const changes = new MutationObserver((records) => {
		if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every(isOurs))) return;
		lastChange = Date.now();
		soon(SETTLE_MS);
	});

	/** What could not be looked into gets another chance when Barrunto starts reading again, or Jev recovers. */
	function forgetFailure() {
		if (!subject?.asked || subject.waitingFor || subject.told?.analysis?.analyzed) return;
		subject.asked = false;
		subject.told = undefined;
	}

	let wasReading = false;
	function startOrStop() {
		paint();
		if (reading() === wasReading) return;
		wasReading = reading();
		if (!wasReading) {
			changes.disconnect();
			window.clearTimeout(timer);
			timer = 0;
			return;
		}
		forgetFailure();
		lastChange = Date.now();
		changes.observe(document.body, { childList: true, subtree: true });
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
				forgetFailure();
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
