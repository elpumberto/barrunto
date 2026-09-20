import { beforeEach, describe, expect, it } from 'vitest';
import { labelsFor, strengthsFor } from '@/engine';
import { pack } from '@/packs/jetective';
import type { Profile } from '@/packs/jetective';
import { account as made, answersFor, posts } from '@/packs/jetective/rules/made-up';
import { cardFor } from './card';
import { clearCard, paintCard } from './paint';

const { rules } = pack;
const texts = pack.card!;
/** Twelve posts, on an account opened twelve days before it was read, with a handle full of digits. */
const account: Profile = made({
	id: 'ada84620193',
	handle: 'ada84620193',
	bio: '',
	posts: posts(12),
	created: '2025-12-20T00:00:00.000Z',
	postCount: 10
});
type Kinds = Parameters<typeof answersFor>[1];
const told = (
	kinds: Kinds,
	given: Record<string, number> = {},
	sensitivity: 'low' | 'medium' | 'ultra' = 'medium'
) => {
	const card = cardFor(rules, texts, answersFor(account, kinds, given), account, sensitivity);
	if (card.state !== 'told') throw new Error('not told');
	return card;
};
const PITCH = { asksPrivate: 0.9 };

describe('cardFor', () => {
	it('charges exactly what would get a label, the strongest first', () => {
		const kinds = { money: 7, stock: 5 };
		const given = { asksPrivate: 0.9, sameTemplate: 0.9 };
		for (const sensitivity of ['low', 'medium', 'ultra'] as const) {
			const labels = labelsFor(
				rules.judgments,
				strengthsFor(rules, answersFor(account, kinds, given), account),
				sensitivity
			);
			const { charges } = told(kinds, given, sensitivity);
			expect(charges.map((c) => c.judgment.id).sort()).toEqual(labels.map((j) => j.id).sort());
			const strengths = charges.map((c) => c.strength);
			expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
		}
		expect(told(kinds, given, 'ultra').charges.length).toBeGreaterThan(1);
	});

	it("tells what pushed a charge and what held it back, in the pack's words, counted, what weighed most first", () => {
		const [scam] = told({ money: 8, own: 4 }, PITCH).charges;
		expect(scam!.reads).toBe('Looks like a scam');
		expect(scam!.pushed).toEqual([
			'8 of 12 posts promise money, or to get back what was lost.',
			texts.evidence.moneyPost,
			texts.evidence.asksPrivate,
			texts.evidence.newAccount,
			texts.evidence.digitsTail
		]);
		expect(scam!.heldBack).toEqual([
			'4 of 12 posts tell of things of their own, in words of their own.'
		]);
	});

	it('calls a hunch strong where it would show even on low, and faint where only past medium', () => {
		expect(told({ money: 10 }, PITCH).charges[0]!.hunch).toBe('a strong hunch');
		expect(told({ money: 5 }, {}, 'ultra').charges[0]!.hunch).toBe('a fair hunch');
		expect(told({ advert: 6 }, {}, 'ultra').charges[0]!.hunch).toBe('a faint hunch');
	});

	it('charges nothing when nothing is clear', () => {
		expect(told({}).charges).toEqual([]);
	});
});

describe('what a card says of its subject', () => {
	const facts = (change: Partial<Profile> = {}) =>
		Object.fromEntries(texts.facts({ ...account, ...change }).map((f) => [f.name, f.value]));

	it('is what the page says, in words and whole numbers', () => {
		const old = { created: '2019-03-09T16:20:00.000Z', followers: 6522, postCount: 1306 };
		expect(facts(old)).toMatchObject({
			Alias: 'Ada Nobody',
			Handle: '@ada84620193',
			'On file since': 'March 2019 · 6 years',
			Follows: '280',
			'Followed by': '6,522',
			'Posts on record': '1,306 · about 0.5 a day',
			Examined: '12 posts on this page'
		});
		expect(facts()['On file since']).toBe('December 2025 · 12 days');
	});

	it('says so where the page did not say', () => {
		const unknown = facts({ created: null, followers: null, following: null, postCount: null });
		expect(unknown['On file since']).toBe('not on the page');
		expect(unknown['Posts on record']).toBe('not on the page');
	});

	it('numbers a case the same for the same account, with nothing of the account in it', () => {
		expect(texts.title(account)).toBe(texts.title({ ...account, name: 'Somebody Else' }));
		expect(texts.title(account)).not.toBe(texts.title({ ...account, handle: 'bob_noone' }));
		expect(texts.title(account)).toMatch(/^Case Nº JJ-[0-9A-F]{6}$/);
	});

	it('stamps it by what came of it', () => {
		expect(told({}).stamp).toBe('No charges');
		expect(told({ money: 10 }, PITCH).stamp).toBe('Hunch');
	});
});

describe('paintCard', () => {
	let anchor: HTMLElement;
	const sheet = () => anchor.querySelector('[data-barrunto="card"]')!.shadowRoot!;
	beforeEach(() => {
		document.body.innerHTML = '<div id="anchor"></div>';
		anchor = document.getElementById('anchor')!;
	});

	it('shows both sides of every charge, and says so when one is empty', () => {
		paintCard(anchor, told({ money: 12 }, PITCH), 'medium', 'light');
		const sides = [...sheet().querySelectorAll('.exhibits > div')].map((side) => [
			side.querySelector('h4')!.textContent,
			[...side.querySelectorAll('li')].map((li) => li.textContent)
		]);
		expect(sides[0]![0]).toBe('Exhibits for');
		expect(sides[1]).toEqual(['Exhibits against', ['Nothing on file.']]);
		expect(sheet().querySelector('.caveat')!.textContent).toContain('never who is behind it');
	});

	it('takes a name off the page for text, never for markup', () => {
		const rude: Profile = { ...account, handle: '<img src=x>' };
		const card = cardFor(rules, texts, answersFor(rude), rude, 'medium');
		paintCard(anchor, card, 'medium', 'dark');
		expect(sheet().querySelector('.file img')).toBeNull();
		expect(sheet().querySelector('.facts')!.textContent).toContain('@<img src=x>');
	});

	it('paints one card in place of the one before, and goes when cleared', () => {
		paintCard(anchor, told({}), 'medium', 'light');
		paintCard(anchor, told({ money: 12 }, PITCH), 'medium', 'light');
		expect(anchor.querySelectorAll('[data-barrunto="card"]')).toHaveLength(1);
		expect(sheet().querySelectorAll('.file')).toHaveLength(1);
		clearCard(anchor);
		expect(anchor.querySelector('[data-barrunto]')).toBeNull();
	});
});
