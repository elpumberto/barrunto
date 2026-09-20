import { beforeEach, describe, expect, it } from 'vitest';
import { labelsFor, strengthsFor } from '@/engine';
import type { Rules } from '@/engine';
import type { Post } from '@/packs/x';
import { rules } from '@/packs/x/rules';
import { clearTuning, paintTuning } from './paint';
import { tuningFor } from './tuning';

const post: Post = {
	id: '1',
	text: 'x'.repeat(200),
	author: { name: 'Some One', handle: '@someone' },
	metrics: { replies: 900, reposts: 0, likes: 100 },
	hasMedia: false,
	hasLink: false,
	inThread: false,
	isCutShort: false,
	quoted: null
};
const answers = { ...Object.fromEntries(rules.traits.map((t) => [t.id, 0.05])), attacks: 0.9 };

describe('tuningFor', () => {
	it('marks as labelled exactly what gets a label', () => {
		for (const sensitivity of ['low', 'ultra'] as const) {
			const tuning = tuningFor(rules, answers, post, sensitivity);
			const labelled = tuning.analyzed ? tuning.judgments.filter((j) => j.labelled) : [];
			const labels = labelsFor(rules.judgments, strengthsFor(rules, answers, post), sensitivity);
			expect(labelled.map((j) => j.judgment.id)).toEqual(labels.map((j) => j.id));
		}
	});

	it("lists Jev's answers as they came and the page signals held between 0 and 1", () => {
		const tuning = tuningFor(rules, answers, post, 'medium');
		if (!tuning.analyzed) throw new Error('expected an analyzed post');
		expect(tuning.inputs.find((i) => i.name === 'attacks')).toMatchObject({
			value: 0.9,
			isSignal: false
		});
		expect(tuning.inputs.find((i) => i.name === 'reply ratio')).toMatchObject({
			value: 1,
			isSignal: true
		});
		const flame = tuning.judgments.find((j) => j.judgment.id === 'flame')!;
		expect(flame.parts.reduce((sum, part) => sum + part.amount, 0)).toBeCloseTo(flame.strength);
	});
});

describe('paintTuning', () => {
	let anchor: HTMLElement;
	const box = () =>
		anchor.querySelector('[data-barrunto="tuning"]')!.shadowRoot!.querySelector('.box')!;

	beforeEach(() => {
		document.body.innerHTML = '<div id="content"></div>';
		anchor = document.getElementById('content')!;
	});

	it('draws every input, every judgment with a tick per sensitivity, and only the parts that count', () => {
		paintTuning(anchor, tuningFor(rules, answers, post, 'high'), 'dark');
		expect(box().querySelectorAll('.traits .row')).toHaveLength(
			rules.traits.length + rules.signals.length
		);
		expect(box().querySelectorAll('.judgments .row')).toHaveLength(3);
		expect(box().querySelectorAll('.judgments .row:first-child .tick')).toHaveLength(4);
		expect(box().querySelectorAll('.tick.current')).toHaveLength(3);
		expect(box().querySelector('.row.up')!.textContent).toContain('● Flame');
		expect(box().querySelector('.row.up .parts')!.textContent).toBe(
			'attacks +0.58 · reply ratio +0.35'
		);
		expect((anchor.querySelector('[data-barrunto="tuning"]') as HTMLElement).dataset.ground).toBe(
			'dark'
		);
	});

	it('folds to one line with how each judgment came out, and stays unfolded where it was', () => {
		paintTuning(anchor, tuningFor(rules, answers, post, 'high'), 'light');
		const folded = box() as HTMLDetailsElement;
		expect(folded.open).toBe(false);
		expect(
			[...folded.querySelectorAll('.brief span:not(.logo)')].map((span) => span.textContent)
		).toEqual([
			expect.stringMatching(/^○ Bait 0\.\d\d$/),
			expect.stringMatching(/^● Flame 0\.\d\d$/),
			expect.stringMatching(/^○ Signal 0\.\d\d$/)
		]);

		expect(folded.querySelector('.brief .logo svg')).not.toBeNull();

		folded.open = true;
		paintTuning(anchor, tuningFor(rules, answers, post, 'low'), 'light');
		expect((box() as HTMLDetailsElement).open).toBe(true);
	});

	describe('of a pack with many judgments, and questions asked part by part', () => {
		/** Made-up rules: six judgments, a question of their own for each of three parts, and a signal that counts them. */
		const label = (text: string) => ({ text, hint: '', glyph: '', color: '#000', ink: '#fff' });
		const thresholds = { low: 0.6, medium: 0.42, high: 0.3, ultra: 0.2 };
		const many: Rules = {
			present: () => 'made up',
			doubt: 0.4,
			traits: ['kind', 'curt', 'vague'].map((id) => ({ id, name: id, question: `Is it ${id}?` })),
			traitsOf: () =>
				[0, 1, 2].map((i) => ({
					id: `part${i}`,
					name: `part ${i + 1}`,
					question: `What is part ${i}?`,
					options: { plain: 'Plain.', fancy: 'Fancy.' }
				})),
			signals: [
				{ id: 'fancyParts', name: 'fancy parts', from: (_, a = {}) => a['part0.fancy'] ?? 0 },
				{ id: 'long', name: 'long', from: () => 0 }
			],
			judgments: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((text, n) => ({
				id: text.toLowerCase(),
				recipe: [
					{ kind: 'trait', id: 'kind', weight: n === 5 ? 1 : n === 1 ? 0.5 : n === 2 ? 0.2 : 0 },
					{ kind: 'signal', id: 'fancyParts', weight: n === 3 ? 0.1 : 0 }
				],
				thresholds,
				label: label(text),
				noise: false
			}))
		};
		const given = {
			kind: 0.9,
			curt: 0.02,
			vague: 0.5,
			'part0.fancy': 0.8,
			'part0.plain': 0.2,
			'part1.plain': 0.9,
			'part1.fancy': 0.1,
			'part2.plain': 0.7,
			'part2.fancy': 0.3
		};
		const paint = () => paintTuning(anchor, tuningFor(many, given, { id: '1' }, 'medium'), 'light');

		it('names in the folded line the ones labelled and then the strongest of the rest, and counts the others', () => {
			paint();
			const named = [...box().querySelectorAll('.brief span:not(.logo)')].map((s) => s.textContent);
			expect(named).toEqual(['● Six 0.83', '○ Two 0.42', '○ Three 0.17', '○ Four 0.08', '+2 more']);
		});

		it('tells in a line what was asked part by part, and in another what came to nothing, and gives rows to the rest', () => {
			paint();
			expect(box().querySelector('.tally')!.textContent).toBe('part: plain 2 · fancy 1');
			const rows = [...box().querySelectorAll('.traits .row')].map(
				(r) => r.firstChild!.textContent
			);
			expect(rows).toEqual(['kind', 'vague', 'fancy parts*']);
			const nothing = [...box().querySelectorAll('.nothing')].map((line) => line.textContent);
			expect(nothing).toEqual(['nothing in: curt · long*', '○ nothing of: One · Five']);
			expect(box().querySelectorAll('.judgments .row')).toHaveLength(4);
		});
	});

	it('does not let a click on the detail reach the item', () => {
		let reached = false;
		anchor.addEventListener('click', () => (reached = true));
		paintTuning(anchor, tuningFor(rules, answers, post, 'high'), 'light');
		box().querySelector<HTMLElement>('.brief')!.click();
		expect(reached).toBe(false);
	});

	it('replaces the detail that was there, and goes when cleared', () => {
		paintTuning(anchor, tuningFor(rules, answers, post, 'high'), 'light');
		paintTuning(anchor, { analyzed: false, reason: 'ad' }, 'light');
		expect(anchor.querySelectorAll('[data-barrunto="tuning"]')).toHaveLength(1);
		expect(box().textContent).toBe('not analyzed: ad');
		clearTuning(anchor);
		expect(anchor.querySelector('[data-barrunto="tuning"]')).toBeNull();
	});
});
