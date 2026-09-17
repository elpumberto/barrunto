import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pack as hn } from '@/packs/hn';
import { pack as x } from '@/packs/x';
import { closedForm, compact, renderPopup } from './view';
import type { PopupActions, PopupState } from './view';

const connected: PopupState = {
	connection: { state: 'connected' },
	settings: {
		paused: false,
		tuning: false,
		lookAhead: 10,
		packs: { x: { enabled: true, sensitivity: 'medium', options: {} } }
	},
	packs: [x, hn],
	pack: x,
	view: 'home',
	about: null,
	session: { items: 7, tokensIn: 1900, tokensOut: 98 },
	total: { items: 1284, tokensIn: 352_000, tokensOut: 18_000 },
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
	setOption: vi.fn(),
	setTuning: vi.fn(),
	setLookAhead: vi.fn(),
	resetCounters: vi.fn(),
	go: vi.fn(),
	showAbout: vi.fn(),
	setEnabled: vi.fn()
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
		expect(root.querySelector('[data-fold="usage"] .brief')!.textContent).toBe(
			'7 analyzed · 2K tokens'
		);
		expect(root.querySelector('.key .tail')!.textContent).toBe('ts_••••••4f2a');
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

	it('shows the controls of the pack of this page, its own ones too, and sends them to their actions', () => {
		const chosen = { enabled: true, sensitivity: 'high' as const, options: {} };
		draw({ pack: hn, settings: { ...connected.settings, packs: { hn: chosen } } });
		expect(root.querySelector('.eyebrow')!.textContent).toBe('Hacker News');
		expect(root.querySelector('[aria-pressed="true"]')!.textContent).toBe('High');
		const fade = root.querySelector('[data-action="option"][data-value="fade"]')!;
		expect(fade.getAttribute('aria-checked')).toBe('false');
		click('[data-action="option"][data-value="fade"]');
		expect(actions.setOption).toHaveBeenCalledWith('hn', 'fade', true);
	});

	it('offers the pack of this page while it is off, and says so when the page has none', () => {
		draw({ pack: hn });
		expect(root.querySelector('.stops')).toBeNull();
		expect(root.querySelector('.eyebrow')!.textContent).toBe('Hacker News');
		click('[data-action="enable"][data-pack="hn"]');
		expect(actions.setEnabled).toHaveBeenCalledWith('hn', true);

		draw({ pack: null });
		expect(root.textContent).toContain('There is no rule pack for this page');
		draw({ pack: null, settings: { ...connected.settings, packs: {} } });
		expect(root.querySelector('.warning')!.textContent).toContain('No rule pack is on');
	});

	it('takes how many items to read ahead as a whole number within bounds', () => {
		draw({});
		const ahead = root.querySelector<HTMLInputElement>('#ahead')!;
		expect(ahead.value).toBe('10');
		for (const [typed, taken] of [
			['0', 0],
			['3.6', 4],
			['900', 50],
			['-2', 0],
			['x', 0]
		] as const) {
			ahead.value = typed;
			ahead.dispatchEvent(new Event('change', { bubbles: true }));
			expect(actions.setLookAhead).toHaveBeenLastCalledWith(taken);
		}
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
		expect(actions.setSensitivity).toHaveBeenCalledWith('x', 'ultra');
		click('[data-action="tuning"]');
		expect(actions.setTuning).toHaveBeenCalledWith(true);
		click('[data-action="reset"]');
		click('[data-action="change"]');
		click('[data-action="remove"]');
		click('[data-action="packs"]');
		expect(actions.go).toHaveBeenCalledWith('packs');
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
		draw({ form: typing, session: { items: 8, tokensIn: 2000, tokensOut: 100 } });
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

	it('keeps a fold open across a redraw', () => {
		draw({});
		const usage = () => root.querySelector<HTMLDetailsElement>('details[data-fold="usage"]')!;
		expect(usage().open).toBe(false);
		usage().open = true;
		draw({ session: { items: 8, tokensIn: 2000, tokensOut: 100 } });
		expect(usage().open).toBe(true);
	});

	it('never takes the key tail for markup', () => {
		draw({ keyTail: '<b>x' });
		expect(root.querySelector('.key b')).toBeNull();
		expect(root.querySelector('.key .tail')!.textContent).toContain('<b>x');
	});
});

describe('the catalogue of packs', () => {
	const entry = (id: string) => root.querySelector<HTMLElement>(`.pack[data-pack="${id}"]`)!;

	it('lists every pack with where it acts and whether it is on, and no controls', () => {
		draw({ view: 'packs' });
		expect(root.querySelectorAll('.pack')).toHaveLength(2);
		expect(entry('hn').querySelector('.site')!.textContent).toBe('news.ycombinator.com');
		expect(entry('x').querySelector('.switch')!.getAttribute('aria-checked')).toBe('true');
		expect(entry('hn').querySelector('.switch')!.getAttribute('aria-checked')).toBe('false');
		expect(root.querySelector('.stops')).toBeNull();
		expect(root.querySelector('.legend')).toBeNull();
	});

	it('unfolds what one pack is about: what it does and what its labels mean', () => {
		draw({ view: 'packs', about: 'hn' });
		expect(entry('x').querySelector('.legend')).toBeNull();
		expect([...entry('hn').querySelectorAll('.chip')].map((chip) => chip.textContent)).toEqual([
			'Insight',
			'Snark',
			'Tangent'
		]);
	});

	it('sends each thing to its action, and knows the way back', () => {
		draw({ view: 'packs' });
		entry('hn').querySelector<HTMLElement>('[data-action="about"]')!.click();
		expect(actions.showAbout).toHaveBeenCalledWith('hn');
		entry('hn').querySelector<HTMLElement>('[data-action="enable"]')!.click();
		expect(actions.setEnabled).toHaveBeenCalledWith('hn', true);
		entry('x').querySelector<HTMLElement>('[data-action="enable"]')!.click();
		expect(actions.setEnabled).toHaveBeenCalledWith('x', false);
		click('[data-action="home"]');
		expect(actions.go).toHaveBeenCalledWith('home');
	});

	it('gives way to the key form when the key is rejected', () => {
		draw({ view: 'packs', connection: { state: 'keyRejected' } });
		expect(root.querySelector('#key')).not.toBeNull();
		expect(root.querySelector('.pack')).toBeNull();
	});
});
