import { describe, expect, it } from 'vitest';
import type { Comment } from '../comment';
import { rules } from '.';

const comment: Comment = {
	id: '1',
	text: 'x'.repeat(5000),
	story: { title: 'A made-up story', text: 'y'.repeat(5000) },
	parent: { text: 'z'.repeat(5000) }
};
type Sent = {
	story: { title: string; text: string | null };
	parent: { text: string } | null;
	comment: { text: string };
};
const presented = rules.present(comment) as Sent;

// What holds for the rules of every pack is in `packs.test.ts`.
describe('the Hacker News rules', () => {
	it('points in its questions only at what the comment is presented with', () => {
		for (const { question, yes = '', no = '' } of rules.traits) {
			const pointed = `${question} ${yes} ${no}`.matchAll(/`(\w+)(?:\.(\w+))?`/g);
			for (const [, whole, field] of pointed) {
				expect(Object.keys(presented), question).toContain(whole);
				if (field)
					expect(Object.keys(presented[whole as keyof Sent] ?? {}), question).toContain(field);
			}
		}
	});

	it('cuts what it sends to Jev to a length, the context shorter than the comment', () => {
		expect(presented.comment.text).toHaveLength(4000);
		expect(presented.parent!.text).toHaveLength(1500);
		expect(presented.story.text).toHaveLength(1500);
	});

	it('says plainly when there is no story text and no comment answered', () => {
		const top = { ...comment, story: { title: 'A link', text: '' }, parent: null };
		expect(rules.present(top)).toMatchObject({ story: { text: null }, parent: null });
	});

	it('length: nothing up to 200 characters, everything from 800', () => {
		const length = rules.signals.find((s) => s.id === 'length')!;
		expect(length.from({ ...comment, text: 'x'.repeat(200) })).toBeCloseTo(0);
		expect(length.from({ ...comment, text: 'x'.repeat(800) })).toBeCloseTo(1);
	});

	it("sends nobody's name", () => {
		expect(JSON.stringify(presented)).not.toMatch(/author|someone/);
	});
});
