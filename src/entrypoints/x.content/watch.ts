import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { labelsFor } from '@/engine';
import type { Post } from '@/engine';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { findPosts, ground, labelAnchor, postId, readPost, tuningAnchor } from '@/packs/x/page';
import type { Skipped } from '@/packs/x/page';
import { rules } from '@/packs/x/rules';
import { connection, pageSettings } from '@/storage/session';
import type { ConnectionStatus, Settings } from '@/storage/types';
import { clearTuning, paintLabels, paintTuning } from './paint';
import { tuningFor } from './tuning';

/** How long a post has to stay on screen before it is analyzed. */
const DWELL_MS = 700;
/** How much of a post has to show, or of the screen it has to fill when it is taller than the screen. */
const IN_VIEW = 0.5;
/** X.com changes its page in bursts: the posts are gone over once the burst settles. */
const SETTLE_MS = 150;
/** How many analyzed posts a tab remembers, for when X.com draws them again on scrolling back. */
const POSTS_REMEMBERED = 500;
/** Right after installing, the page can ask for the status before the background has opened session storage. */
const STATUS_TRIES = { times: 5, everyMs: 500 };

/** What came of looking at a post. */
type Outcome =
	| { post: Post; analysis: Analysis }
	| { skipped: Skipped }
	| { failed: 'noReply' | 'extensionReloaded' };

/** What the tuning detail says for a post that was not analyzed. */
const IN_WORDS: Record<string, string> = {
	ad: 'ad',
	noText: 'no text',
	protectedAccount: 'protected account',
	noKey: 'no key',
	paused: 'paused',
	keyRejected: 'key rejected',
	tooManyCalls: 'too many calls',
	serviceDown: 'service down',
	noNetwork: 'no network',
	noReply: 'no reply from the background',
	extensionReloaded: 'the extension was reloaded'
};

/** A post element on the page: which post it shows, whether it has been asked about, and what came of it. */
interface Tracked {
	id: string | null;
	asked: boolean;
	outcome?: Outcome;
}

const analyzed = (outcome: Outcome | undefined) =>
	outcome !== undefined && 'post' in outcome && outcome.analysis.analyzed;

async function connectionNow(tries = STATUS_TRIES.times): Promise<ConnectionStatus> {
	try {
		return await connection.getValue();
	} catch (error) {
		if (tries <= 1) throw error;
		await new Promise((resolve) => setTimeout(resolve, STATUS_TRIES.everyMs));
		return connectionNow(tries - 1);
	}
}

/** Watches X.com's page for posts, has the ones that dwell analyzed, and paints what comes back. */
export async function watchPage(ctx: ContentScriptContext) {
	/** What is known of each post element on the page. */
	const tracked = new WeakMap<HTMLElement, Tracked>();
	/** What came of each analyzed post, by id, for when X.com draws it again. The oldest go first. */
	const remembered = new Map<string, Outcome>();
	const dwelling = new Map<HTMLElement, number>();

	let connectionStatus = await connectionNow();
	let currentSettings: Settings = await pageSettings.getValue();
	const reading = () =>
		!currentSettings.paused &&
		(connectionStatus.state === 'connected' || connectionStatus.state === 'trouble');

	function remember(id: string, outcome: Outcome) {
		remembered.set(id, outcome);
		const oldest = remembered.keys().next().value;
		if (remembered.size > POSTS_REMEMBERED && oldest !== undefined) remembered.delete(oldest);
	}

	function paint(article: HTMLElement, outcome: Outcome, arrive: boolean) {
		try {
			const analysis = 'post' in outcome ? outcome.analysis : null;
			const labels = analysis?.analyzed
				? labelsFor(rules.judgments, analysis.strengths, currentSettings.sensitivity)
				: [];
			paintLabels(labelAnchor(article), labels, arrive);

			const anchor = tuningAnchor(article);
			if (!currentSettings.tuning) return clearTuning(anchor);
			const tuning =
				'post' in outcome && outcome.analysis.analyzed
					? tuningFor(rules, outcome.analysis.answers, outcome.post, currentSettings.sensitivity)
					: { analyzed: false as const, reason: IN_WORDS[reasonOf(outcome)] ?? 'unknown' };
			paintTuning(anchor, tuning, ground());
		} catch (error) {
			console.error('[barrunto] could not paint a post', error);
		}
	}

	function unpaint(article: HTMLElement) {
		try {
			paintLabels(labelAnchor(article), [], false);
			clearTuning(tuningAnchor(article));
		} catch (error) {
			console.error('[barrunto] could not clear a post', error);
		}
	}

	async function look(article: HTMLElement) {
		const mine = tracked.get(article);
		if (!mine || mine.asked || !reading() || ctx.isInvalid) return;

		const read = readPost(article);
		if (!read) {
			if (currentSettings.tuning) console.debug('[barrunto] could not read this post', article);
			return;
		}
		mine.asked = true;

		let outcome: Outcome;
		if ('skipped' in read) {
			outcome = read;
		} else {
			const { post } = read;
			outcome = await send({ type: 'analyzePost', post }).then(
				(analysis): Outcome => (analysis ? { post, analysis } : { failed: 'noReply' }),
				(): Outcome => ({ failed: 'extensionReloaded' })
			);
			if (analyzed(outcome)) remember(post.id, outcome);
		}
		// X.com may have given the element to another post while Jev was answering.
		if (tracked.get(article) !== mine || !article.isConnected) return;
		mine.outcome = outcome;
		paint(article, outcome, true);
	}

	const onScreen = new IntersectionObserver(
		(entries) => {
			for (const { target, intersectionRatio, intersectionRect, rootBounds } of entries) {
				const article = target as HTMLElement;
				window.clearTimeout(dwelling.get(article));
				dwelling.delete(article);

				// A post taller than the screen never shows half of itself: filling half the screen does.
				const fillsScreen = intersectionRect.height >= (rootBounds?.height ?? Infinity) * IN_VIEW;
				if (intersectionRatio < IN_VIEW && !fillsScreen) continue;
				dwelling.set(
					article,
					window.setTimeout(() => {
						onScreen.unobserve(article);
						dwelling.delete(article);
						void look(article);
					}, DWELL_MS)
				);
			}
		},
		{ threshold: [0, 0.1, 0.25, IN_VIEW] }
	);

	/** Goes over the posts on the page: paints the ones already known, waits for the rest to dwell. */
	function scan() {
		// Reloading the extension leaves this script running in the open page, cut off from the rest:
		// asking whether it still holds is what makes it let go of the page.
		if (ctx.isInvalid) return;
		for (const article of findPosts(document)) {
			const id = postId(article);
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
		for (const article of findPosts(document)) {
			const outcome = tracked.get(article)?.outcome;
			if (outcome) paint(article, outcome, true);
		}
	}

	/** A post that could not be analyzed gets another chance when Barrunto starts reading again. */
	function forgetFailures() {
		for (const article of findPosts(document)) {
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
