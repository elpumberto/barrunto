import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Post } from '@/engine';
import { jev, JevError } from '@/jev';
import { rules } from '@/packs/x/rules';
import { apiKey, connection, sessionCounters, settings } from '@/storage';
import { analyze } from './analyze';

vi.mock('@/jev', async (original) => ({
	...(await original<typeof import('@/jev')>()),
	jev: { ask: vi.fn(), checkKey: vi.fn() }
}));

const post = (id: string): Post => ({
	id,
	text: 'made up',
	author: { name: 'Some One', handle: '@someone' },
	metrics: { replies: 0, reposts: 0, likes: 0 },
	hasMedia: false,
	hasLink: false,
	inThread: false,
	isCutShort: false,
	quoted: null
});

const answers = Object.fromEntries(rules.traits.map((trait) => [trait.id, 0.9]));
const answering = () =>
	vi.mocked(jev.ask).mockResolvedValue({ answers, usage: { tokensIn: 100, tokensOut: 10 } });

beforeEach(async () => {
	fakeBrowser.reset();
	await apiKey.setValue('the-key');
	await connection.setValue({ state: 'connected' });
});

describe('analyze', () => {
	it('asks Jev once when the same post is asked about twice at once', async () => {
		answering();
		const [one, other] = await Promise.all([analyze(post('1')), analyze(post('1'))]);
		expect(jev.ask).toHaveBeenCalledTimes(1);
		expect(one).toEqual(other);
		expect(one.analyzed && Object.keys(one.strengths)).toEqual(['bait', 'flame', 'signal']);
	});

	it('reuses the answers of the session without asking or counting again', async () => {
		answering();
		await analyze(post('2'));
		await analyze(post('2'));
		expect(jev.ask).toHaveBeenCalledTimes(1);
		expect(await sessionCounters.getValue()).toEqual({ posts: 1, tokensIn: 100, tokensOut: 10 });
	});

	it('asks nothing while paused or without a key', async () => {
		await settings.setValue({ paused: true, sensitivity: 'medium', tuning: false });
		expect(await analyze(post('3'))).toEqual({ analyzed: false, reason: 'paused' });
		await settings.removeValue();
		await apiKey.removeValue();
		expect(await analyze(post('3'))).toEqual({ analyzed: false, reason: 'noKey' });
		expect(jev.ask).not.toHaveBeenCalled();
	});

	it('notes a rejected key and asks no more until it changes', async () => {
		vi.mocked(jev.ask).mockRejectedValue(new JevError('keyRejected'));
		expect(await analyze(post('4'))).toEqual({ analyzed: false, reason: 'keyRejected' });
		expect(await connection.getValue()).toEqual({ state: 'keyRejected' });
		await analyze(post('5'));
		expect(jev.ask).toHaveBeenCalledTimes(1);
	});

	it('notes trouble, leaves the post unanalyzed, and is back to connected with the next good call', async () => {
		vi.mocked(jev.ask).mockRejectedValueOnce(new Error('anything'));
		expect(await analyze(post('6'))).toEqual({ analyzed: false, reason: 'serviceDown' });
		expect(await connection.getValue()).toEqual({ state: 'trouble', reason: 'serviceDown' });
		answering();
		expect((await analyze(post('7'))).analyzed).toBe(true);
		expect(await connection.getValue()).toEqual({ state: 'connected' });
	});

	it('says nothing of the connection when the key was removed while Jev was answering', async () => {
		vi.mocked(jev.ask).mockImplementation(async () => {
			await apiKey.removeValue();
			await connection.setValue({ state: 'noKey' });
			return { answers, usage: { tokensIn: 1, tokensOut: 1 } };
		});
		await analyze(post('8'));
		expect(await connection.getValue()).toEqual({ state: 'noKey' });
	});
});
