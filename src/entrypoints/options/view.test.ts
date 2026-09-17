import { beforeEach, describe, expect, it, vi } from 'vitest';
import { packs } from '@/packs';
import { renderOptions } from './view';
import type { OptionsActions, OptionsState } from './view';

const fresh: OptionsState = {
	packs,
	settings: { paused: false, tuning: false, packs: {} },
	connection: { state: 'connected' },
	refused: null
};
const hnOn = { hn: { enabled: true, sensitivity: 'medium' as const, options: {} } };

const actions = {
	setEnabled: vi.fn(),
	setSensitivity: vi.fn(),
	setOption: vi.fn()
} satisfies OptionsActions;

let root: HTMLElement;
const draw = (state: Partial<OptionsState>) => renderOptions(root, { ...fresh, ...state }, actions);
const card = (id: string) => root.querySelector<HTMLElement>(`.card[data-pack="${id}"]`)!;

beforeEach(() => {
	document.body.innerHTML = '<main id="options"></main>';
	root = document.getElementById('options')!;
});

describe('the packs page', () => {
	it('shows every pack off at first, with where it acts and what its labels mean', () => {
		draw({});
		expect(root.querySelectorAll('.card')).toHaveLength(packs.length);
		expect(card('hn').querySelector('.site')!.textContent).toBe('news.ycombinator.com');
		expect(card('hn').querySelector('.switch')!.getAttribute('aria-checked')).toBe('false');
		expect([...card('x').querySelectorAll('.chip')].map((chip) => chip.textContent)).toEqual([
			'Bait',
			'Flame',
			'Signal'
		]);
		expect(root.querySelector('.stops')).toBeNull();
	});

	it('shows the controls of a pack only while it is on', () => {
		draw({ settings: { ...fresh.settings, packs: hnOn } });
		expect(card('hn').querySelector('.stops')).not.toBeNull();
		expect(card('hn').querySelector('[data-action="option"]')).not.toBeNull();
		expect(card('x').querySelector('.stops')).toBeNull();
	});

	it('sends each control to its action, with the pack it belongs to', () => {
		draw({ settings: { ...fresh.settings, packs: hnOn } });
		card('x').querySelector<HTMLElement>('[data-action="enable"]')!.click();
		expect(actions.setEnabled).toHaveBeenCalledWith('x', true);
		card('hn').querySelector<HTMLElement>('[data-action="enable"]')!.click();
		expect(actions.setEnabled).toHaveBeenCalledWith('hn', false);
		card('hn').querySelector<HTMLElement>('[data-value="low"]')!.click();
		expect(actions.setSensitivity).toHaveBeenCalledWith('hn', 'low');
		card('hn').querySelector<HTMLElement>('[data-value="fade"]')!.click();
		expect(actions.setOption).toHaveBeenCalledWith('hn', 'fade', true);
	});

	it('says so when Chrome refused leave for a site, and when there is no key', () => {
		draw({ refused: 'x', connection: { state: 'noKey' } });
		expect(card('x').querySelector('.failure')!.textContent).toContain('did not give');
		expect(card('hn').querySelector('.failure')).toBeNull();
		expect(root.querySelector('.band')!.textContent).toContain('no TypeSafe key');
	});
});
