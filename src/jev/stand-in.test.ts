import { describe, expect, it } from 'vitest';
import { standIn } from './stand-in';

const questions = ['a', 'b', 'c'].map((id) => ({ id, name: id, question: `Is it ${id}?` }));

describe('stand-in Jev', () => {
	it('answers every question between 0 and 1, the same way for the same content', async () => {
		const first = await standIn.ask('any', 'a made-up post', questions);
		const again = await standIn.ask('other', 'a made-up post', questions);
		expect(Object.keys(first.answers)).toEqual(['a', 'b', 'c']);
		for (const p of Object.values(first.answers)) expect(p >= 0 && p <= 1).toBe(true);
		expect(again.answers).toEqual(first.answers);
		expect(first.usage.tokensIn).toBeGreaterThan(0);
	});

	it('rejects a key that starts with "bad"', async () => {
		await expect(standIn.checkKey('bad-key')).rejects.toMatchObject({ failure: 'keyRejected' });
		await expect(standIn.checkKey('anything')).resolves.toBeUndefined();
	});
});
