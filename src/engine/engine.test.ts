import { describe, expect, it } from 'vitest';
import {
	clears,
	contributions,
	labelledFrom,
	labelsFor,
	sitesOf,
	sitesOnlyOf,
	strength,
	strengthsFor,
	traitsFor,
	treatmentFor,
	wordingOf
} from '.';
import type { Item, Judgment, Pack, Rules } from '.';

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

describe('labelledFrom', () => {
	it('is the lowest sensitivity at which a strength gets the label, if any', () => {
		const [judgment] = rules.judgments;
		const { low, ultra } = judgment!.thresholds;
		expect(labelledFrom(judgment!, low)).toBe('low');
		expect(labelledFrom(judgment!, ultra)).toBe('ultra');
		expect(labelledFrom(judgment!, ultra - 0.01)).toBeNull();
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
		expect(treatmentFor([bad!], { bad: 'label' })).toBe('label');
		// What the user has said nothing about is treated as it ships.
		expect(treatmentFor([bad!], {})).toBe('fade');
		expect(treatmentFor([], asked)).toBe('label');
	});

	it('takes the strictest when labels pull apart, and never heeds a judgment that is not noise', () => {
		expect(treatmentFor([good!, worse!], asked)).toBe('hide');
		expect(treatmentFor([good!, bad!], asked)).toBe('fade');
		expect(treatmentFor([good!], { good: 'hide' })).toBe('label');
	});
});

describe('what Jev is asked about an item', () => {
	/** A shout is asked, word by word, what kind of word each is. */
	const kinds = { loud: 'In capitals.', quiet: 'Not in capitals.' };
	const byWord: Rules<Shout> = {
		...rules,
		traits: [{ id: 'rude', name: 'rude', question: 'Is it rude?' }],
		traitsOf: (shout) =>
			shout.text.split(' ').map((_, i) => ({
				id: `word${i}`,
				name: `word ${i + 1}`,
				question: `What kind of word is word ${i}?`,
				options: kinds
			})),
		signals: [
			{
				id: 'loudWords',
				name: 'loud words',
				from: (shout, answers = {}) =>
					shout.text.split(' ').filter((_, i) => (answers[`word${i}.loud`] ?? 0) > 0.5).length / 2
			}
		],
		judgments: [judgment('shouting', [{ kind: 'signal', id: 'loudWords', weight: 1 }])]
	};

	it('is what is asked of every item, and then what is asked of this one alone', () => {
		expect(traitsFor(byWord, post).map((t) => t.id)).toEqual(['rude', 'word0', 'word1']);
		expect(traitsFor(rules, post)).toEqual([]);
	});

	it('lets a page signal count what Jev answered, and takes it for nothing before Jev has', () => {
		const answers = {
			'word0.loud': 0.9,
			'word0.quiet': 0.1,
			'word1.loud': 0.2,
			'word1.quiet': 0.8
		};
		expect(strengthsFor(byWord, answers, post)).toEqual({ shouting: 0.5 });
		expect(strengthsFor(byWord, {}, post)).toEqual({ shouting: 0 });
	});

	it('takes a page signal that cannot be worked out for nothing', () => {
		const broken = {
			...byWord,
			signals: [{ id: 'loudWords', name: 'loud words', from: () => NaN }]
		};
		expect(strengthsFor(broken, {}, post)).toEqual({ shouting: 0 });
	});

	it('is worded differently when what there is to choose from changes', () => {
		const asked = traitsFor(byWord, post);
		const reworded = asked.map((t) =>
			t.options ? { ...t, options: { ...kinds, loud: 'LOUD.' } } : t
		);
		expect(wordingOf(reworded)).not.toBe(wordingOf(asked));
		expect(wordingOf([...asked])).toBe(wordingOf(asked));
	});
});

describe('the sites of packs', () => {
	const on = (id: string, ...sites: string[]): Pack => ({
		id,
		name: id,
		description: '',
		sites,
		rules: { ...rules, judgments: [] }
	});
	const posts = on('posts', 'https://a.example/*');
	const people = on('people', 'https://a.example/*', 'https://b.example/*');

	it('are named once each, though two packs act on the same one', () => {
		expect(sitesOf([posts, people])).toEqual(['https://a.example/*', 'https://b.example/*']);
		expect(sitesOf([])).toEqual([]);
	});

	it("are a pack's alone when no other pack acts on them, and a pack is no other to itself", () => {
		expect(sitesOnlyOf(people, [posts])).toEqual(['https://b.example/*']);
		expect(sitesOnlyOf(posts, [people])).toEqual([]);
		expect(sitesOnlyOf(posts, [posts])).toEqual(posts.sites);
		expect(sitesOnlyOf(posts, [])).toEqual(posts.sites);
	});
});
