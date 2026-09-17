import { describe, expect, it } from 'vitest';
import { labelsFor, strengthsFor } from '@/engine';
import type { Answers, Post, Sensitivity } from '@/engine';
import { rules } from '.';

/**
 * Kinds of post seen while tuning, with answers like the ones Jev gave them.
 * The words are made up; their length and the metrics are like the real ones.
 */
const post = (length: number, [replies, reposts, likes]: number[]): Post => ({
	id: '1',
	text: 'x'.repeat(length),
	author: { name: 'Some One', handle: '@someone' },
	metrics: { replies: replies!, reposts: reposts!, likes: likes! },
	hasMedia: false,
	hasLink: false,
	inThread: false,
	isCutShort: false,
	quoted: null
});

const answers = (given: Answers): Answers => ({
	...Object.fromEntries(rules.traits.map((t) => [t.id, 0.05])),
	...given
});

const labels = (p: Post, a: Answers, sensitivity: Sensitivity) =>
	labelsFor(rules.judgments, strengthsFor(rules, a, p), sensitivity).map((j) => j.id);

describe('the recipes', () => {
	it('takes a question thrown at the crowd for Bait, however tidy and first-hand it sounds', () => {
		const a = answers({
			asksReaction: 0.3,
			fishesReplies: 0.9,
			templated: 0.55,
			concrete: 0.67,
			firstHand: 0.8,
			careful: 0.81
		});
		expect(labels(post(60, [8, 0, 7]), a, 'medium')).toEqual(['bait']);
	});

	it('takes "follow me for more" for Bait even on low', () => {
		const a = answers({ asksReaction: 0.98, overpromises: 0.34, templated: 0.78, concrete: 0.47 });
		expect(labels(post(150, [6, 41, 821]), a, 'low')).toEqual(['bait']);
	});

	it('does not take a one-line milestone for Signal, concrete and first-hand as it is', () => {
		const a = answers({
			concrete: 0.89,
			firstHand: 0.95,
			careful: 0.57,
			templated: 0.28,
			teaches: 0.15
		});
		expect(labels(post(85, [27, 0, 156]), a, 'high')).toEqual([]);
	});

	it('takes a post that teaches from experience for Signal', () => {
		const a = answers({ teaches: 0.9, concrete: 0.95, firstHand: 0.93, careful: 0.8 });
		expect(labels(post(270, [23, 41, 388]), a, 'low')).toEqual(['signal']);
	});

	it('takes an attack for Flame, more so when replies pile up', () => {
		const a = answers({ attacks: 0.89, careful: 0.5 });
		expect(labels(post(120, [1, 3, 4]), a, 'high')).toEqual(['flame']);
		expect(labels(post(120, [1, 3, 4]), a, 'medium')).toEqual(['flame']);
		expect(labels(post(120, [1, 3, 4]), a, 'low')).toEqual([]);
		expect(labels(post(120, [900, 60, 200]), a, 'low')).toEqual(['flame']);
	});

	it('does not take middling answers for Bait: Jev not being sure is not half a yes', () => {
		const a = answers({ fishesReplies: 0.67, overpromises: 0.44, templated: 0.46, careful: 0.41 });
		expect(labels(post(55, [0, 0, 10]), a, 'high')).toEqual([]);
	});

	it('takes a concrete, first-hand account for Signal on high, without it teaching much', () => {
		const a = answers({ concrete: 0.93, firstHand: 0.97, careful: 0.82, teaches: 0.25 });
		expect(labels(post(222, [0, 0, 0]), a, 'high')).toEqual(['signal']);
		expect(labels(post(222, [0, 0, 0]), a, 'low')).toEqual([]);
	});

	it('does not take one reply and no likes for replies piling up', () => {
		const a = answers({ firstHand: 0.98, careful: 0.77, concrete: 0.46 });
		const strengths = strengthsFor(rules, a, post(264, [1, 0, 0]));
		expect(strengths.flame).toBeLessThan(0.02);
	});

	it('takes a gentle dig for Flame only on ultra', () => {
		const a = answers({ attacks: 0.63, firstHand: 0.95, careful: 0.74 });
		expect(labels(post(100, [0, 0, 0]), a, 'high')).toEqual([]);
		expect(labels(post(100, [0, 0, 0]), a, 'ultra')).toEqual(['flame']);
	});

	it('stays quiet about a passing remark', () => {
		const a = answers({ firstHand: 0.68, careful: 0.64 });
		expect(labels(post(110, [6, 1, 35]), a, 'ultra')).toEqual([]);
	});
});
