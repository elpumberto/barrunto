import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
	countPost,
	POSTS_KEPT,
	resetCounters,
	sessionCounters,
	storeAnswers,
	storedAnswers,
	totalCounters
} from '.';

beforeEach(() => fakeBrowser.reset());

describe('stored answers', () => {
	it('come back for the same post and the same wording of the questions, and no other', async () => {
		await storeAnswers('1', 'now', { a: 0.9 });
		expect(await storedAnswers('1', 'now')).toEqual({ a: 0.9 });
		expect(await storedAnswers('1', 'before')).toBeNull();
		expect(await storedAnswers('2', 'now')).toBeNull();
	});

	it('drops the oldest past the cap', async () => {
		for (let post = 0; post <= POSTS_KEPT; post++) await storeAnswers(String(post), 'w', { a: 1 });
		expect(await storedAnswers('0', 'w')).toBeNull();
		expect(await storedAnswers('1', 'w')).toEqual({ a: 1 });
		expect(await storedAnswers(String(POSTS_KEPT), 'w')).toEqual({ a: 1 });
	});
});

describe('counters', () => {
	it('counts every post when many finish at once', async () => {
		await Promise.all(Array.from({ length: 20 }, () => countPost({ tokensIn: 100, tokensOut: 5 })));
		const counted = { posts: 20, tokensIn: 2000, tokensOut: 100 };
		expect(await sessionCounters.getValue()).toEqual(counted);
		expect(await totalCounters.getValue()).toEqual(counted);
	});

	it('resets both', async () => {
		await countPost({ tokensIn: 1, tokensOut: 1 });
		await resetCounters();
		expect((await sessionCounters.getValue()).posts).toBe(0);
		expect((await totalCounters.getValue()).posts).toBe(0);
	});
});
