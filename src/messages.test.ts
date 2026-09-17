import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { listen } from './messages';

const handlers = {
	analyze: vi.fn(async () => ({ analyzed: false as const, reason: 'paused' as const })),
	checkKey: vi.fn(async () => ({ ok: true as const })),
	forgetKey: vi.fn(async () => {}),
	resetCounters: vi.fn(async () => {})
};

type Listener = (message: unknown, sender: object, reply: (value: unknown) => void) => unknown;
let deliver: Listener;
const ours = () => fakeBrowser.runtime.id;
const fromPopup = () => ({ id: ours(), url: fakeBrowser.runtime.getURL('/popup.html') });
const fromPage = (url: string) => ({ id: ours(), tab: { id: 1 }, url });
// The popup opened in a tab of its own is still the popup.
const fromPopupInATab = () => ({ ...fromPopup(), tab: { id: 2 } });

beforeEach(() => {
	fakeBrowser.reset();
	const added = vi.spyOn(fakeBrowser.runtime.onMessage, 'addListener');
	listen(handlers);
	deliver = added.mock.calls[0]![0] as Listener;
});

describe('listen', () => {
	it('answers the popup and keeps the channel open for the reply', async () => {
		const reply = vi.fn();
		expect(deliver({ type: 'checkKey', apiKey: 'k' }, fromPopup(), reply)).toBe(true);
		await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true }));
		expect(deliver({ type: 'checkKey', apiKey: 'k' }, fromPopupInATab(), vi.fn())).toBe(true);
	});

	it('takes analyses only from a page, and tells the handler which', () => {
		const item = { type: 'analyze', packId: 'x', item: {} };
		expect(deliver(item, fromPage('https://x.com/home'), vi.fn())).toBe(true);
		expect(handlers.analyze).toHaveBeenCalledWith(item, 'https://x.com/home');
		expect(deliver(item, fromPopup(), vi.fn())).toBeUndefined();
		expect(deliver(item, { id: ours(), tab: { id: 1 } }, vi.fn())).toBeUndefined();
	});

	it('does not let the page touch the key or the counters', () => {
		const page = fromPage('https://x.com/home');
		for (const type of ['checkKey', 'forgetKey', 'resetCounters']) {
			expect(deliver({ type, apiKey: 'theirs' }, page, vi.fn())).toBeUndefined();
		}
		expect(handlers.checkKey).not.toHaveBeenCalled();
		expect(handlers.forgetKey).not.toHaveBeenCalled();
	});

	it('ignores other extensions and messages it does not know', () => {
		expect(deliver({ type: 'checkKey' }, { id: 'someone-else' }, vi.fn())).toBeUndefined();
		expect(deliver({ type: 'unknown' }, fromPopup(), vi.fn())).toBeUndefined();
		expect(deliver(null, fromPopup(), vi.fn())).toBeUndefined();
	});

	it('replies with nothing when a handler fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		handlers.forgetKey.mockRejectedValueOnce(new Error('no'));
		const reply = vi.fn();
		deliver({ type: 'forgetKey' }, fromPopup(), reply);
		await vi.waitFor(() => expect(reply).toHaveBeenCalledWith(undefined));
	});
});
