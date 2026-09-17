import { describe, expect, it } from 'vitest';
import { clears, contributions, labelsFor, strength, strengthsFor, treatmentFor } from '.';
import type { Item, Judgment, Rules } from '.';

/** An item of a made-up pack: the engine knows nothing of what is in one. */
interface Shout extends Item {
	text: string;
	replies: number;
}

const post: Shout = { id: '1', text: 'made up', replies: 10 };

const judgment = (id: string, recipe: Judgment['recipe'], noise = false): Judgment => ({
	id,
	recipe,
	noise,
	thresholds: { low: 0.75, medium: 0.6, high: 0.45, ultra: 0.3 },
	label: { text: id, hint: '', glyph: '', color: '#000', ink: '#fff' }
});

const rules: Rules<Shout> = {
	doubt: 0,
	present: (p) => p.text,
	traits: [],
	signals: [{ id: 'loud', name: 'loud', from: (p) => p.replies }],
	judgments: [
		judgment('a', [
			{ kind: 'trait', id: 'x', weight: 0.5 },
			{ kind: 'trait', id: 'y', weight: -0.5 }
		]),
		judgment('b', [{ kind: 'signal', id: 'loud', weight: 0.7 }])
	]
};

describe('strengths', () => {
	it('is the weighted sum of the recipe', () => {
		expect(strengthsFor(rules, { x: 1, y: 0.4 }, post).a).toBeCloseTo(0.3);
	});

	it('is clamped between 0 and 1', () => {
		expect(strengthsFor(rules, { x: 0, y: 1 }, post).a).toBe(0);
		expect(strength([{ ingredient: rules.judgments[0]!.recipe[0]!, value: 1, amount: 3 }])).toBe(1);
	});

	it('takes a page signal below zero, or one that does not exist, as nothing', () => {
		const odd = {
			...rules,
			signals: [{ id: 'loud', name: 'loud', from: () => -3 }],
			judgments: [
				judgment('c', [
					{ kind: 'signal', id: 'loud', weight: 1 },
					{ kind: 'signal', id: 'missing', weight: 1 }
				])
			]
		};
		expect(strengthsFor(odd, {}, post).c).toBe(0);
	});

	it('clamps a page signal before weighing it', () => {
		expect(strengthsFor(rules, {}, post).b).toBeCloseTo(0.7);
	});

	it('takes a missing answer as nothing', () => {
		const parts = contributions(rules.judgments[0]!, rules, {}, post);
		expect(strength(parts)).toBe(0);
	});
});

describe('doubt', () => {
	it('counts an answer only past the doubt, from nothing to everything', () => {
		const doubtful = { ...rules, doubt: 0.4 };
		expect(strengthsFor(doubtful, { x: 0.4, y: 0 }, post).a).toBe(0);
		expect(strengthsFor(doubtful, { x: 0.7, y: 0 }, post).a).toBeCloseTo(0.25);
		expect(strengthsFor(doubtful, { x: 1, y: 0 }, post).a).toBeCloseTo(0.5);
	});
});

describe('labelsFor', () => {
	it('labels more as the sensitivity goes up', () => {
		const strengths = { a: 0.65, b: 0.5 };
		const ids = (s: 'low' | 'medium' | 'high') =>
			labelsFor(rules.judgments, strengths, s).map((j) => j.id);
		expect(ids('low')).toEqual([]);
		expect(ids('medium')).toEqual(['a']);
		expect(ids('high')).toEqual(['a', 'b']);
	});

	it('labels nothing for a judgment with no strength', () => {
		expect(labelsFor(rules.judgments, {}, 'ultra')).toEqual([]);
	});

	it('clears a threshold by reaching it', () => {
		expect(clears(rules.judgments[0]!, 0.3, 'ultra')).toBe(true);
		expect(clears(rules.judgments[0]!, 0.29, 'ultra')).toBe(false);
		expect(labelsFor(rules.judgments, { a: 0.75 }, 'low')).toHaveLength(1);
	});
});

describe('what is done to an item', () => {
	const [good, bad, worse] = [
		judgment('good', []),
		judgment('bad', [], true),
		judgment('worse', [], true)
	];
	const asked = { bad: 'fade', worse: 'hide' } as const;

	it('is the most the user asks for among its labels, hiding before fading', () => {
		expect(treatmentFor([bad!], asked)).toBe('fade');
		expect(treatmentFor([bad!, worse!], asked)).toBe('hide');
		expect(treatmentFor([bad!], {})).toBe('label');
		expect(treatmentFor([], asked)).toBe('label');
	});

	it('takes the strictest when labels pull apart, and never heeds a judgment that is not noise', () => {
		expect(treatmentFor([good!, worse!], asked)).toBe('hide');
		expect(treatmentFor([good!, bad!], asked)).toBe('fade');
		expect(treatmentFor([good!], { good: 'hide' })).toBe('label');
	});
});
