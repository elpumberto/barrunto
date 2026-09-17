import { beforeEach, describe, expect, it } from 'vitest';
import { labelsFor, strengthsFor } from '@/engine';
import type { Post } from '@/engine';
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

	it('replaces the detail that was there, and goes when cleared', () => {
		paintTuning(anchor, tuningFor(rules, answers, post, 'high'), 'light');
		paintTuning(anchor, { analyzed: false, reason: 'ad' }, 'light');
		expect(anchor.querySelectorAll('[data-barrunto="tuning"]')).toHaveLength(1);
		expect(box().textContent).toBe('not analyzed: ad');
		clearTuning(anchor);
		expect(anchor.querySelector('[data-barrunto="tuning"]')).toBeNull();
	});
});
