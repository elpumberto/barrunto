import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { connection, pageSettings } from '@/storage/session';
import { watchPage } from './watch';

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
const DWELL = 700;

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
	await pageSettings.setValue({ paused: false, sensitivity: 'medium', tuning: false });
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

		await pageSettings.setValue({ paused: false, sensitivity: 'low', tuning: false });
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

		await pageSettings.setValue({ paused: true, sensitivity: 'medium', tuning: false });
		await settle();
		expect(labelsOn(painted)).toEqual(['flame']);
		expect(OnScreen.last.watched.size).toBe(0);

		await pageSettings.setValue({ paused: false, sensitivity: 'medium', tuning: false });
		await settle();
		expect(OnScreen.last.watched.has(failed)).toBe(true);
		expect(OnScreen.last.watched.has(painted)).toBe(false);
	});
});
