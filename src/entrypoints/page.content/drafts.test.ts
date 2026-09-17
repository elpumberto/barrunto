import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { pack as x } from '@/packs/x';
import { page as xPage } from '@/packs/x/page';
import { connection, pageSettings } from '@/storage/session';
import { defaultSettings } from '@/storage/types';
import type { Settings } from '@/storage/types';
import { PAUSE_MS, watchDrafts } from './drafts';

vi.mock('@/messages', () => ({ send: vi.fn() }));

let ctx: ContentScriptContext;
const watch = () => watchDrafts(ctx, x, xPage.drafts!);
const chosen = (change: Partial<Settings> = {}): Settings => ({
	...defaultSettings,
	packs: { x: { enabled: true, sensitivity: 'medium', treatments: {} } },
	...change
});

/** A box to write in next to its author's picture, as on X.com. */
function addBox(): HTMLElement {
	document.body.innerHTML = `<div><div><div data-testid="UserAvatar-Container-ada"></div></div>
		<div id="column"><div contenteditable="true" data-testid="tweetTextarea_0"></div></div></div>`;
	return document.querySelector<HTMLElement>('[contenteditable]')!;
}
/** As the editor does it: the words of a text that is already there change, and nothing else. */
function type(box: HTMLElement, words: string) {
	if (box.firstChild instanceof Text && words) box.firstChild.data = words;
	else box.textContent = words;
}
const hunch = () => document.querySelector('#column > [data-barrunto="draft"]');
const rows = () =>
	[...(hunch()?.shadowRoot?.querySelectorAll<HTMLElement>('.row') ?? [])].map(
		(row) => `${row.dataset.id} ${row.lastChild?.textContent}${row.matches('.up') ? ' (up)' : ''}`
	);
const strengths = (bait: number, flame: number): Analysis => ({
	analyzed: true,
	strengths: { bait, flame, signal: 0 },
	answers: {}
});

beforeEach(async () => {
	fakeBrowser.reset();
	vi.useFakeTimers();
	vi.mocked(send).mockReset();
	ctx = { isInvalid: false, onInvalidated: vi.fn() } as unknown as ContentScriptContext;
	await connection.setValue({ state: 'connected' });
	await pageSettings.setValue(chosen());
});
afterEach(() => {
	// What watched the page of one test lets go of it before the next.
	(ctx as { isInvalid: boolean }).isInvalid = true;
	vi.useRealTimers();
});

describe('watching what the user writes', () => {
	it('asks once the words have stayed still, and not for every key pressed', async () => {
		vi.mocked(send).mockResolvedValue(strengths(0.5, 0.25));
		const box = addBox();
		await watch();
		type(box, 'Comment YES if you');
		await vi.advanceTimersByTimeAsync(PAUSE_MS - 300);
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS - 300);
		expect(send).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(PAUSE_MS);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				packId: 'x',
				urgent: true,
				item: expect.objectContaining({ text: 'Comment YES if you agree with this' })
			})
		);
		// Every label some reader would get, and from which sensitivity; the user's own is medium.
		expect(rows()).toEqual(['bait from Medium (up)', 'flame only at Ultra']);

		await vi.advanceTimersByTimeAsync(PAUSE_MS * 3);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('dims what it said when the words change, and takes it away when they go', async () => {
		vi.mocked(send).mockResolvedValue(strengths(0.7, 0));
		const box = addBox();
		await watch();
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(rows()).toEqual(['bait even at Low (up)']);

		type(box, 'Comment YES if you agree with this, or');
		await vi.advanceTimersByTimeAsync(400);
		expect(hunch()?.hasAttribute('data-stale')).toBe(true);

		type(box, '');
		await vi.advanceTimersByTimeAsync(400);
		expect(hunch()).toBeNull();
	});

	it('says nothing of a word or two, nor while the user would rather it did not', async () => {
		const box = addBox();
		await watch();
		type(box, 'Ho ho ho');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		await pageSettings.setValue(chosen({ checkDrafts: false }));
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(send).not.toHaveBeenCalled();
		expect(hunch()).toBeNull();
	});

	it('keeps saying that Jev is being asked while settings change, and says nothing once reloaded from under', async () => {
		let answer!: (analysis: Analysis) => void;
		vi.mocked(send).mockReturnValue(new Promise((resolve) => (answer = resolve as typeof answer)));
		const box = addBox();
		await watch();
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(hunch()?.shadowRoot?.querySelector('.waiting')).not.toBeNull();
		await pageSettings.setValue(chosen({ tuning: true }));
		await vi.advanceTimersByTimeAsync(200);
		expect(hunch()?.shadowRoot?.querySelector('.waiting')).not.toBeNull();

		(ctx as { isInvalid: boolean }).isInvalid = true;
		answer(strengths(0.7, 0));
		await vi.advanceTimersByTimeAsync(200);
		expect(rows()).toEqual([]);
	});

	it('does not ask again about words put back as they were', async () => {
		vi.mocked(send).mockResolvedValue(strengths(0.7, 0));
		const box = addBox();
		await watch();
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		type(box, 'Comment YES if you agree with this, or');
		await vi.advanceTimersByTimeAsync(400);
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(send).toHaveBeenCalledTimes(1);
		expect(hunch()?.hasAttribute('data-stale')).toBe(false);

		// Told to stop, it takes away what it had said.
		await pageSettings.setValue(chosen({ checkDrafts: false }));
		await vi.advanceTimersByTimeAsync(200);
		expect(hunch()).toBeNull();
	});

	it('checks again what it could not, once Jev recovers', async () => {
		vi.mocked(send).mockResolvedValueOnce({ analyzed: false, reason: 'serviceDown' });
		vi.mocked(send).mockResolvedValue(strengths(0.7, 0));
		const box = addBox();
		await watch();
		type(box, 'Comment YES if you agree with this');
		await connection.setValue({ state: 'trouble', reason: 'serviceDown' });
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(hunch()?.shadowRoot?.textContent).toContain('Not checked');
		await connection.setValue({ state: 'connected' });
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(send).toHaveBeenCalledTimes(2);
		expect(rows()).toEqual(['bait even at Low (up)']);
	});

	it('says that it could not check when Jev is in trouble', async () => {
		vi.mocked(send).mockResolvedValue({ analyzed: false, reason: 'serviceDown' });
		const box = addBox();
		await watch();
		type(box, 'Comment YES if you agree with this');
		await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
		expect(hunch()?.shadowRoot?.textContent).toContain('Not checked: service down.');
	});
});
