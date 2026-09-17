import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { jev, JevError } from '@/jev';
import { pack as hn } from '@/packs/hn';
import type { Comment } from '@/packs/hn';
import { pack as x } from '@/packs/x';
import type { Post } from '@/packs/x';
import { apiKey, changePack, connection, sessionCounters, settings } from '@/storage';
import { analyze as analyzeFrom } from './analyze';

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

const HOME = 'https://x.com/home';
/** As the X.com page asks. */
const analyze = (item: Post) => analyzeFrom(x.id, item, HOME);

const answers = Object.fromEntries(x.rules.traits.map((trait) => [trait.id, 0.9]));
const answering = () =>
	vi.mocked(jev.ask).mockResolvedValue({ answers, usage: { tokensIn: 100, tokensOut: 10 } });

beforeEach(async () => {
	fakeBrowser.reset();
	await apiKey.setValue('the-key');
	await connection.setValue({ state: 'connected' });
	await changePack(x, () => ({ enabled: true }));
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
		expect(await sessionCounters.getValue()).toEqual({ items: 1, tokensIn: 100, tokensOut: 10 });
	});

	it('asks nothing while paused or without a key', async () => {
		await settings.setValue({ ...(await settings.getValue()), paused: true });
		expect(await analyze(post('3'))).toEqual({ analyzed: false, reason: 'paused' });
		await settings.removeValue();
		await apiKey.removeValue();
		expect(await analyze(post('3'))).toEqual({ analyzed: false, reason: 'noKey' });
		expect(jev.ask).not.toHaveBeenCalled();
	});

	it('hurries a call that was waiting as read ahead when the user gets to the item', async () => {
		const asked: string[] = [];
		let open!: () => void;
		const gate = new Promise<void>((resolve) => (open = resolve));
		vi.mocked(jev.ask).mockImplementation(async (_key, content) => {
			asked.push((content as { post: { text: string } }).post.text);
			await gate;
			return { answers, usage: { tokensIn: 1, tokensOut: 1 } };
		});
		const named = (id: string) => ({ ...post(id), text: id });
		// Four calls fill what may be in flight; the rest wait, read ahead, in the order they came.
		const all = ['a', 'b', 'c', 'd', 'ahead 1', 'ahead 2'].map((id) =>
			analyzeFrom(x.id, named(id), HOME, false)
		);
		all.push(analyzeFrom(x.id, named('ahead 2'), HOME, true));
		await vi.waitFor(() => expect(asked).toHaveLength(4));
		open();
		await Promise.all(all);
		expect(asked.slice(4)).toEqual(['ahead 2', 'ahead 1']);
	});

	it('sends nothing that was waiting its turn once Barrunto is paused, and does not take it for trouble', async () => {
		let open!: () => void;
		const gate = new Promise<void>((resolve) => (open = resolve));
		vi.mocked(jev.ask).mockImplementation(async () => {
			await gate;
			return { answers, usage: { tokensIn: 1, tokensOut: 1 } };
		});
		const all = ['a', 'b', 'c', 'd', 'waiting 1', 'waiting 2'].map((id) => analyze(post(id)));
		await vi.waitFor(() => expect(jev.ask).toHaveBeenCalledTimes(4));
		await settings.setValue({ ...(await settings.getValue()), paused: true });
		open();

		const results = await Promise.all(all);
		expect(jev.ask).toHaveBeenCalledTimes(4);
		expect(results.slice(4)).toEqual([
			{ analyzed: false, reason: 'paused' },
			{ analyzed: false, reason: 'paused' }
		]);
		expect(await connection.getValue()).toEqual({ state: 'connected' });
	});

	it('lets a call that ends late say nothing over a later one', async () => {
		const ends: (() => void)[] = [];
		vi.mocked(jev.ask)
			.mockImplementationOnce(
				() => new Promise((_, reject) => ends.push(() => reject(new Error('late'))))
			)
			.mockResolvedValueOnce({ answers, usage: { tokensIn: 1, tokensOut: 1 } });
		const early = analyze(post('early'));
		await vi.waitFor(() => expect(ends).toHaveLength(1));
		await analyze(post('later'));
		ends[0]!();
		expect(await early).toEqual({ analyzed: false, reason: 'serviceDown' });
		expect(await connection.getValue()).toEqual({ state: 'connected' });
	});

	it("takes an item its pack cannot make sense of for the item's fault, not Jev's", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = { id: '11' } as Post;
		expect(await analyze(broken)).toEqual({ analyzed: false, reason: 'malformed' });
		expect(jev.ask).not.toHaveBeenCalled();
		expect(await connection.getValue()).toEqual({ state: 'connected' });
	});

	it('answers a pack only while it is on, and only for its own sites', async () => {
		answering();
		const off = { analyzed: false, reason: 'packOff' };
		expect(await analyzeFrom(hn.id, post('9'), 'https://news.ycombinator.com/item?id=9')).toEqual(
			off
		);
		expect(await analyzeFrom(x.id, post('9'), 'https://elsewhere.example/')).toEqual(off);
		expect(await analyzeFrom('unknown', post('9'), HOME)).toEqual(off);
		expect(jev.ask).not.toHaveBeenCalled();
	});

	it('keeps the answers of each pack apart, even for items of the same name', async () => {
		answering();
		await changePack(hn, () => ({ enabled: true }));
		await analyze(post('10'));
		const story = { title: 'A story', text: '' };
		const comment: Comment = {
			id: '10',
			text: 'made up',
			author: 'a',
			depth: 0,
			story,
			parent: null
		};
		await analyzeFrom(hn.id, comment, 'https://news.ycombinator.com/item?id=1');
		expect(jev.ask).toHaveBeenCalledTimes(2);
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
