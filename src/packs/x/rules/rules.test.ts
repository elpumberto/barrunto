import { describe, expect, it } from 'vitest';
import { wordingOf } from '@/engine';
import type { Post } from '../post';
import { rules } from '.';

const post: Post = {
	id: '1',
	text: 'x'.repeat(5000),
	author: { name: 'Some One', handle: '@someone' },
	metrics: { replies: 0, reposts: 0, likes: 0 },
	hasMedia: false,
	hasLink: false,
	inThread: false,
	isCutShort: false,
	quoted: { author: '@other', text: 'y'.repeat(5000) }
};
const presented = rules.present(post) as { post: Record<string, unknown> };

// What holds for the rules of every pack is in `packs.test.ts`.
describe('the X.com rules', () => {
	it('points in its questions only at fields the post is presented with', () => {
		for (const { question, yes = '', no = '' } of rules.traits) {
			for (const [, field] of `${question} ${yes} ${no}`.matchAll(/`post\.(\w+)`/g)) {
				expect(Object.keys(presented.post), question).toContain(field);
			}
		}
	});

	it('cuts what it sends to Jev to a length', () => {
		const sent = presented.post as { text: string; quotes: { text: string } };
		expect(sent.text).toHaveLength(4000);
		expect(sent.quotes.text).toHaveLength(4000);
	});

	it('names the wording of the questions differently when one changes', () => {
		const [first, ...rest] = rules.traits;
		const reworded = [{ ...first!, question: `${first!.question} Really?` }, ...rest];
		expect(wordingOf(reworded)).not.toBe(wordingOf(rules.traits));
		expect(wordingOf([...rules.traits])).toBe(wordingOf(rules.traits));
	});
});

describe('the page signals', () => {
	const signal = (id: string) => rules.signals.find((s) => s.id === id)!;
	const withMetrics = (replies: number, likes: number): Post => ({
		...post,
		metrics: { replies, reposts: 0, likes }
	});

	it('reply ratio: nothing at half a reply per like, everything from two', () => {
		expect(signal('replyRatio').from(withMetrics(50, 99))).toBeCloseTo(0);
		expect(signal('replyRatio').from(withMetrics(200, 99))).toBeCloseTo(1);
	});

	it('reply ratio: a handful of replies says little', () => {
		expect(signal('replyRatio').from(withMetrics(1, 0))).toBeLessThan(0.05);
	});

	it('length: nothing up to 80 characters, everything from 280', () => {
		expect(signal('length').from({ ...post, text: 'x'.repeat(80) })).toBeCloseTo(0);
		expect(signal('length').from({ ...post, text: 'x'.repeat(280) })).toBeCloseTo(1);
	});
});
