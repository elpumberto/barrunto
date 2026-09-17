import { describe, expect, it } from 'vitest';
import { labelsFor, strengthsFor } from '@/engine';
import type { Answers, Sensitivity } from '@/engine';
import type { Comment } from '../comment';
import { rules } from '.';

/**
 * The kinds of comment each recipe is meant for, with the answers one would expect of Jev for them.
 * They say what the recipes intend; the weights are still to be tuned against real threads.
 */
const comment = (length: number): Comment => ({
	id: '1',
	text: 'x'.repeat(length),
	author: 'someone',
	depth: 1,
	story: { title: 'A made-up story', text: '' },
	parent: null
});

const answers = (given: Answers): Answers => ({
	...Object.fromEntries(rules.traits.map((t) => [t.id, 0.05])),
	...given
});

const labels = (c: Comment, a: Answers, sensitivity: Sensitivity) =>
	labelsFor(rules.judgments, strengthsFor(rules, a, c), sensitivity).map((j) => j.id);

describe('the recipes', () => {
	it('takes someone who ran the thing and explains what happened for Insight, even on low', () => {
		const a = answers({ teaches: 0.9, expertise: 0.85, firstHand: 0.9, concrete: 0.8 });
		expect(labels(comment(900), a, 'low')).toEqual(['insight']);
	});

	it('takes a short, exact correction for Insight', () => {
		const a = answers({ teaches: 0.85, expertise: 0.8, concrete: 0.75 });
		expect(labels(comment(180), a, 'medium')).toEqual(['insight']);
	});

	it('does not take a long anecdote that teaches nothing for Insight', () => {
		const a = answers({ firstHand: 0.9, concrete: 0.6, teaches: 0.2 });
		expect(labels(comment(900), a, 'medium')).toEqual([]);
	});

	it('takes "this is just X with extra steps" for Snark', () => {
		const a = answers({ dismissive: 0.9, quip: 0.7 });
		expect(labels(comment(40), a, 'medium')).toEqual(['snark']);
	});

	it('does not take harsh criticism that gives its reasons for Snark', () => {
		const a = answers({
			attacks: 0.45,
			dismissive: 0.3,
			teaches: 0.8,
			expertise: 0.7,
			concrete: 0.7
		});
		expect(labels(comment(600), a, 'medium')).toEqual(['insight']);
	});

	it('takes a complaint about the title or the paywall for Tangent', () => {
		const a = answers({ meta: 0.92 });
		expect(labels(comment(90), a, 'medium')).toEqual(['tangent']);
	});

	it('takes a sneer about the site for both Snark and Tangent', () => {
		const a = answers({ meta: 0.9, dismissive: 0.85, attacks: 0.7 });
		expect(labels(comment(60), a, 'medium')).toEqual(['snark', 'tangent']);
	});

	it('stays quiet about an ordinary reply', () => {
		const a = answers({ concrete: 0.5, firstHand: 0.45, teaches: 0.35 });
		expect(labels(comment(250), a, 'high')).toEqual([]);
	});

	it('stays quiet when Jev is lukewarm about everything', () => {
		const a = Object.fromEntries(rules.traits.map((t) => [t.id, 0.45]));
		expect(labels(comment(300), a, 'high')).toEqual([]);
	});
});
