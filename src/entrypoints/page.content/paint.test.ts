import { beforeEach, describe, expect, it } from 'vitest';
import { rules } from '@/packs/x/rules';
import type { Judgment } from '@/engine';
import { paintLabels as paintLabelsAt } from './paint';

const PLACE = { top: '4px', right: '84px' };
const paintLabels = (item: HTMLElement, judgments: Judgment[], arrive?: boolean) =>
	paintLabelsAt(item, judgments, PLACE, arrive);

const [bait, flame, signal] = rules.judgments as [
	(typeof rules.judgments)[0],
	(typeof rules.judgments)[0],
	(typeof rules.judgments)[0]
];

let post: HTMLElement;
const hung = () =>
	[
		...(post
			.querySelector('[data-barrunto="labels"]')
			?.shadowRoot?.querySelectorAll<HTMLElement>('.label') ?? [])
	].map((node) => node.dataset.id);

beforeEach(() => {
	document.body.innerHTML = '<article><p>made up</p></article>';
	post = document.querySelector('article')!;
});

describe('paintLabels', () => {
	it('hangs the labels in the order given, outside the page styling', () => {
		paintLabels(post, [bait, signal]);
		expect(hung()).toEqual(['bait', 'signal']);
		expect(post.querySelector('.label')).toBeNull();
	});

	it('keeps what is up, takes away what is not wanted, adds what is new', () => {
		paintLabels(post, [bait, signal]);
		const kept = post.querySelector('[data-barrunto]')!.shadowRoot!.querySelector('.label');
		paintLabels(post, [bait, flame]);
		expect(hung()).toEqual(['bait', 'flame']);
		expect(post.querySelector('[data-barrunto]')!.shadowRoot!.querySelector('.label')).toBe(kept);
		expect(post.querySelectorAll('[data-barrunto="labels"]')).toHaveLength(1);
	});

	it('leaves the rest of the post as it was', () => {
		paintLabels(post, [flame]);
		paintLabels(post, []);
		expect(hung()).toEqual([]);
		expect(post.querySelector('p')?.textContent).toBe('made up');
	});

	it('does not let a click on a label reach the post', () => {
		let reached = false;
		post.addEventListener('click', () => (reached = true));
		paintLabels(post, [flame]);
		post
			.querySelector('[data-barrunto]')!
			.shadowRoot!.querySelector<HTMLElement>('.label')!
			.click();
		expect(reached).toBe(false);
	});

	it('drops in only when asked to, and only once', () => {
		paintLabels(post, [bait], false);
		paintLabels(post, [bait, flame]);
		const [still, fresh] = post
			.querySelector('[data-barrunto]')!
			.shadowRoot!.querySelectorAll('.label');
		expect(still!.classList.contains('arrive')).toBe(false);
		expect(fresh!.classList.contains('arrive')).toBe(true);
		fresh!.dispatchEvent(new Event('animationend'));
		expect(fresh!.classList.contains('arrive')).toBe(false);
	});

	it('says on hover that it is a hunch', () => {
		paintLabels(post, [flame]);
		const label = post
			.querySelector('[data-barrunto]')!
			.shadowRoot!.querySelector<HTMLElement>('.label')!;
		expect(label.title).toBe(
			'Flame: Picking a fight, or already causing one. A hunch, not a verdict.'
		);
	});

	it('hangs them from the corner that far from it, or puts them in line', () => {
		paintLabels(post, [flame]);
		const host = post.querySelector<HTMLElement>('[data-barrunto="labels"]')!;
		expect(host.dataset.place).toBe('hanging');
		expect(host.style.getPropertyValue('--right')).toBe('84px');

		const header = post.querySelector('p')!;
		paintLabelsAt(header, [flame], 'inline');
		expect(header.querySelector<HTMLElement>('[data-barrunto]')!.dataset.place).toBe('inline');
	});
});
