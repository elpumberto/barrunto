import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { pack as hn } from '@/packs/hn';
import { page as hnPage } from '@/packs/hn/page';
import { pack as x } from '@/packs/x';
import { page as xPage } from '@/packs/x/page';
import { connection, pageSettings } from '@/storage/session';
import type { Settings } from '@/storage/types';
import { watchPage as watch } from './watch';

vi.mock('@/messages', () => ({ send: vi.fn() }));

/** The browser's way of telling what is on screen, worked by hand. */
class OnScreen {
	static last: OnScreen;
	watched = new Set<Element>();
	constructor(private tell: IntersectionObserverCallback) {
		OnScreen.last = this;
	}
	observe = (el: Element) => this.watched.add(el);
	unobserve = (el: Element) => this.watched.delete(el);
	disconnect = () => this.watched.clear();
	show(el: Element, ratio: number) {
		if (!this.watched.has(el)) return;
		const entry = {
			target: el,
			intersectionRatio: ratio,
			intersectionRect: { height: 0 },
			rootBounds: { height: 900 }
		};
		this.tell(
			[entry as unknown as IntersectionObserverEntry],
			this as unknown as IntersectionObserver
		);
	}
}

const ctx = { isInvalid: false, onInvalidated: vi.fn() } as unknown as ContentScriptContext;
const DWELL = xPage.dwellMs;
const watchPage = (at: ContentScriptContext) => watch(at, x, xPage);

/** X.com on, and whatever else is said. */
const chosen = (
	change: Partial<Settings> = {},
	sensitivity: 'low' | 'medium' = 'medium'
): Settings => ({
	paused: false,
	tuning: false,
	lookAhead: 0,
	packs: { x: { enabled: true, sensitivity, options: {} } },
	...change
});

function addPost(id: string): HTMLElement {
	const article = document.createElement('article');
	article.dataset.testid = 'tweet';
	article.innerHTML = `<div data-testid="User-Name"><a href="/u"><span>U</span></a><a href="/u"><span>@u</span></a>
		<a href="/u/status/${id}"><time>1h</time></a></div><div><div data-testid="tweetText">made-up words</div><div role="group"></div></div>`;
	document.body.append(article);
	return article;
}
const labelsOn = (article: HTMLElement) =>
	[
		...(article
			.querySelector('[data-barrunto="labels"]')
			?.shadowRoot?.querySelectorAll<HTMLElement>('.label') ?? [])
	].map((label) => label.dataset.id);

type AnalyzeMessage = { item: { id: string }; urgent: boolean };

const strengths = (flame: number): Analysis => ({
	analyzed: true,
	strengths: { bait: 0, flame, signal: 0 },
	answers: {}
});
/** Lets storage changes, page changes and replies reach the script. */
const settle = () => vi.advanceTimersByTimeAsync(200);

beforeEach(async () => {
	fakeBrowser.reset();
	document.body.innerHTML = '';
	vi.useFakeTimers();
	vi.stubGlobal('IntersectionObserver', OnScreen);
	await connection.setValue({ state: 'connected' });
	await pageSettings.setValue(chosen());
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('watching the page', () => {
	it('never asks about a post that leaves before it has dwelt', async () => {
		const article = addPost('1');
		await watchPage(ctx);
		OnScreen.last.show(article, 0.8);
		await vi.advanceTimersByTimeAsync(DWELL - 100);
		OnScreen.last.show(article, 0);
		await vi.advanceTimersByTimeAsync(DWELL);
		expect(send).not.toHaveBeenCalled();
	});

	it('asks once about a post that dwells, however the page stirs meanwhile, and paints what comes back', async () => {
		let answer!: (analysis: Analysis) => void;
		vi.mocked(send).mockReturnValue(new Promise((resolve) => (answer = resolve as typeof answer)));
		await watchPage(ctx);
		const article = addPost('2');
		await settle();

		OnScreen.last.show(article, 0.8);
		await vi.advanceTimersByTimeAsync(DWELL);
		addPost('3');
		await settle();
		OnScreen.last.show(article, 0.8);
		await vi.advanceTimersByTimeAsync(DWELL);
		expect(send).toHaveBeenCalledTimes(1);

		answer(strengths(0.5));
		await settle();
		expect(labelsOn(article)).toEqual(['flame']);
	});

	it('repaints on a change of sensitivity without asking again', async () => {
		vi.mocked(send).mockResolvedValue(strengths(0.5));
		const article = addPost('4');
		await watchPage(ctx);
		OnScreen.last.show(article, 1);
		await vi.advanceTimersByTimeAsync(DWELL);
		expect(labelsOn(article)).toEqual(['flame']);

		await pageSettings.setValue(chosen({}, 'low'));
		await settle();
		expect(labelsOn(article)).toEqual([]);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('paints at once a post it already knows when X.com draws it again', async () => {
		vi.mocked(send).mockResolvedValue(strengths(0.9));
		const article = addPost('5');
		await watchPage(ctx);
		OnScreen.last.show(article, 1);
		await vi.advanceTimersByTimeAsync(DWELL);

		article.remove();
		const again = addPost('5');
		await settle();
		expect(labelsOn(again)).toEqual(['flame']);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('leaves what is painted when paused, asks nothing, and gives failed posts another chance on resuming', async () => {
		vi.mocked(send).mockResolvedValueOnce(strengths(0.9));
		const painted = addPost('6');
		const failed = addPost('7');
		await watchPage(ctx);
		OnScreen.last.show(painted, 1);
		await vi.advanceTimersByTimeAsync(DWELL);

		vi.mocked(send).mockResolvedValueOnce({ analyzed: false, reason: 'noNetwork' });
		OnScreen.last.show(failed, 1);
		await vi.advanceTimersByTimeAsync(DWELL);
		expect(send).toHaveBeenCalledTimes(2);

		await pageSettings.setValue(chosen({ paused: true }));
		await settle();
		expect(labelsOn(painted)).toEqual(['flame']);
		expect(OnScreen.last.watched.size).toBe(0);

		await pageSettings.setValue(chosen());
		await settle();
		vi.mocked(send).mockResolvedValueOnce(strengths(0.9));
		OnScreen.last.show(painted, 1);
		OnScreen.last.show(failed, 1);
		await vi.advanceTimersByTimeAsync(DWELL);
		expect(send).toHaveBeenCalledTimes(3);
		expect(labelsOn(failed)).toEqual(['flame']);
	});

	it('with items to read ahead, asks at once about what is in sight and the next few, and no further', async () => {
		vi.mocked(send).mockResolvedValue(strengths(0));
		const posts = ['10', '11', '12', '13', '14'].map(addPost);
		await pageSettings.setValue(chosen({ lookAhead: 2 }));
		await watchPage(ctx);
		OnScreen.last.show(posts[0]!, 0.2);
		await settle();

		const asked = vi.mocked(send).mock.calls.map(([message]) => message as AnalyzeMessage);
		expect(asked.map((m) => [m.item.id, m.urgent])).toEqual([
			['10', true],
			['11', false],
			['12', false]
		]);

		OnScreen.last.show(posts[0]!, 0);
		OnScreen.last.show(posts[1]!, 1);
		await settle();
		expect(vi.mocked(send).mock.calls.map(([m]) => (m as AnalyzeMessage).item.id)).toEqual([
			'10',
			'11',
			'12',
			'13'
		]);
	});

	it('says it is waiting for Jev, and hurries an item read ahead when the user gets to it', async () => {
		let answer!: (analysis: Analysis) => void;
		vi.mocked(send).mockReturnValue(new Promise((resolve) => (answer = resolve as typeof answer)));
		const [first, second] = ['20', '21'].map(addPost);
		await pageSettings.setValue(chosen({ lookAhead: 1 }));
		await watchPage(ctx);
		OnScreen.last.show(first!, 1);
		await settle();
		const waiting = (article: HTMLElement) =>
			article.querySelector('[data-barrunto="labels"]')?.shadowRoot?.querySelector('.waiting');
		expect(waiting(second!)).not.toBeNull();
		expect(send).toHaveBeenCalledTimes(2);

		OnScreen.last.show(second!, 1);
		await settle();
		expect(send).toHaveBeenCalledTimes(3);
		expect(send).toHaveBeenLastCalledWith(
			expect.objectContaining({ item: expect.objectContaining({ id: '21' }), urgent: true })
		);
		OnScreen.last.show(second!, 1);
		await settle();
		expect(send).toHaveBeenCalledTimes(3);

		answer(strengths(0.9));
		await settle();
		expect(waiting(second!)).toBeNull();
		expect(labelsOn(second!)).toEqual(['flame']);
	});

	it('lets go of the page when its pack is turned off', async () => {
		const article = addPost('8');
		await watchPage(ctx);
		expect(OnScreen.last.watched.has(article)).toBe(true);

		await pageSettings.setValue({ ...chosen(), packs: {} });
		await settle();
		expect(OnScreen.last.watched.size).toBe(0);
	});

	it('reads a page with the pack it is given, and lets the pack act on what it labels', async () => {
		document.body.innerHTML = `<table class="fatitem"><tr><td><span class="titleline"><a href="#">A story</a></span></td></tr></table>
			<table><tr class="athing comtr" id="9"><td><table><tr><td class="ind" indent="0"></td>
			<td class="default"><a class="hnuser">someone</a><div class="comment"><div class="commtext">made-up words</div></div></td></tr></table></td></tr></table>`;
		const row = document.getElementById('9')!;
		const fading = { enabled: true, sensitivity: 'medium' as const, options: { fade: true } };
		await pageSettings.setValue({ ...chosen(), packs: { hn: fading } });
		vi.mocked(send).mockResolvedValue({
			analyzed: true,
			strengths: { insight: 0, snark: 0.9, tangent: 0 },
			answers: {}
		});

		await watch(ctx, hn, hnPage);
		OnScreen.last.show(row, 1);
		await vi.advanceTimersByTimeAsync(hnPage.dwellMs);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'analyze',
				packId: 'hn',
				item: expect.objectContaining({ id: '9' })
			})
		);
		expect(labelsOn(row)).toEqual(['snark']);
		expect(row.querySelector<HTMLElement>('.commtext')!.style.opacity).toBe('0.45');

		await pageSettings.setValue({ ...chosen(), packs: { hn: { ...fading, options: {} } } });
		await settle();
		expect(row.querySelector<HTMLElement>('.commtext')!.style.opacity).toBe('');
	});
});
