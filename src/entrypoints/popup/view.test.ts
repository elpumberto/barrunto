import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closedForm, compact, renderPopup } from './view';
import type { PopupActions, PopupState } from './view';

const connected: PopupState = {
	connection: { state: 'connected' },
	settings: { paused: false, sensitivity: 'medium', tuning: false },
	session: { posts: 7, tokensIn: 1900, tokensOut: 98 },
	total: { posts: 1284, tokensIn: 352_000, tokensOut: 18_000 },
	keyTail: '4f2a',
	form: closedForm
};

const actions = {
	connect: vi.fn(),
	typed: vi.fn(),
	changeKey: vi.fn(),
	cancelKey: vi.fn(),
	removeKey: vi.fn(),
	setPaused: vi.fn(),
	setSensitivity: vi.fn(),
	setTuning: vi.fn(),
	resetCounters: vi.fn()
} satisfies PopupActions;

let root: HTMLElement;
const draw = (state: Partial<PopupState>) => renderPopup(root, { ...connected, ...state }, actions);
const click = (selector: string) => root.querySelector<HTMLElement>(selector)!.click();
const status = () => root.querySelector('.status')!.textContent;

beforeEach(() => {
	document.body.innerHTML = '<main id="popup"></main>';
	root = document.getElementById('popup')!;
});

describe('compact', () => {
	it.each([
		[0, '0'],
		[999, '999'],
		[1000, '1K'],
		[1949, '1.9K'],
		[99_950, '100K'],
		[352_000, '352K'],
		[999_499, '999K'],
		[999_500, '1M'],
		[1_250_000, '1.3M']
	])('%d reads %s', (n, text) => expect(compact(n)).toBe(text));

	it('reads anything that is not a number as 0', () => {
		expect(compact('<img src=x>' as unknown as number)).toBe('0');
		expect(compact(NaN)).toBe('0');
	});
});

describe('the popup', () => {
	it('shows only the key form without a key, with no way back', () => {
		draw({ connection: { state: 'noKey' } });
		expect(status()).toBe('No key');
		expect(root.querySelector('#key')).not.toBeNull();
		expect(root.querySelector('.stops')).toBeNull();
		expect(root.querySelector('[data-action="cancel"]')).toBeNull();
	});

	it('shows the form with the reason when the key is rejected, even mid-browsing', () => {
		draw({ connection: { state: 'keyRejected' } });
		expect(status()).toBe('Key rejected');
		expect(root.querySelector('.failure')!.textContent).toContain('rejected this key');
	});

	it('shows everything with a working key, the counters shortened and the key masked', () => {
		draw({});
		expect(status()).toBe('Connected');
		expect(root.querySelector('.counters')!.textContent).toContain('1.3K');
		expect(root.querySelector('.key span')!.textContent).toBe('Key ts_••••••4f2a');
		expect(root.querySelector('[aria-pressed="true"]')!.textContent).toBe('Medium');
	});

	it('says paused, and puts trouble in a band over the working view', () => {
		draw({ settings: { ...connected.settings, paused: true } });
		expect(status()).toBe('Paused');
		draw({ connection: { state: 'trouble', reason: 'noNetwork' } });
		expect(status()).toBe('Trouble');
		expect(root.querySelector('.band')!.textContent).toContain('No connection');
		expect(root.querySelector('.stops')).not.toBeNull();
	});

	it('lets a change of key be backed out of, and locks the form while checking', () => {
		draw({ form: { ...closedForm, open: true } });
		click('[data-action="cancel"]');
		expect(actions.cancelKey).toHaveBeenCalled();
		draw({ form: { ...closedForm, open: true, checking: true, typed: 'k' } });
		expect(root.querySelector<HTMLInputElement>('#key')!.disabled).toBe(true);
		expect(status()).toBe('Checking…');
	});

	it('sends each control to its action', () => {
		draw({});
		click('[data-action="pause"]');
		expect(actions.setPaused).toHaveBeenCalledWith(true);
		click('[data-action="sensitivity"][data-value="ultra"]');
		expect(actions.setSensitivity).toHaveBeenCalledWith('ultra');
		click('[data-action="tuning"]');
		expect(actions.setTuning).toHaveBeenCalledWith(true);
		click('[data-action="reset"]');
		click('[data-action="change"]');
		click('[data-action="remove"]');
		expect(actions.resetCounters).toHaveBeenCalled();
		expect(actions.changeKey).toHaveBeenCalled();
		expect(actions.removeKey).toHaveBeenCalled();
	});

	it('connects with what is typed, trimmed, and not with nothing', () => {
		draw({ connection: { state: 'noKey' } });
		const field = root.querySelector<HTMLInputElement>('#key')!;
		const submit = () =>
			root
				.querySelector('form')!
				.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		submit();
		expect(actions.connect).not.toHaveBeenCalled();
		field.value = '  the-key ';
		submit();
		expect(actions.connect).toHaveBeenCalledWith('the-key');
	});

	it('keeps what is typed and where the focus is across a redraw', () => {
		const typing = { ...closedForm, open: true, typed: 'half a k' };
		draw({ form: typing });
		root.querySelector<HTMLInputElement>('#key')!.focus();
		draw({ form: typing, session: { posts: 8, tokensIn: 2000, tokensOut: 100 } });
		const field = root.querySelector<HTMLInputElement>('#key')!;
		expect(field.value).toBe('half a k');
		expect(document.activeElement).toBe(field);
	});

	it('tells what is being typed as it is typed', () => {
		draw({ connection: { state: 'noKey' } });
		const field = root.querySelector<HTMLInputElement>('#key')!;
		field.value = 'abc';
		field.dispatchEvent(new Event('input', { bubbles: true }));
		expect(actions.typed).toHaveBeenCalledWith('abc');
	});

	it('never takes the key tail for markup', () => {
		draw({ keyTail: '<b>x' });
		expect(root.querySelector('.key b')).toBeNull();
		expect(root.querySelector('.key span')!.textContent).toContain('<b>x');
	});
});
