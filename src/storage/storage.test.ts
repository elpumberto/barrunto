import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Pack } from '@/engine';
import {
	changePack,
	countItem,
	ITEMS_KEPT,
	resetCounters,
	sessionCounters,
	settings,
	storeAnswers,
	storedAnswers,
	totalCounters
} from '.';

beforeEach(() => fakeBrowser.reset());

/** A made-up pack with one control of its own, off as it ships, and one judgment of noise among two. */
const hn = {
	id: 'hn',
	controls: [{ id: 'loud', title: '', help: '', initial: false }],
	rules: {
		judgments: [
			{ id: 'snark', noise: true },
			{ id: 'insight', noise: false }
		]
	}
} as Pack;

const of = (itemId: string, wording = 'now', packId = 'x') => ({ packId, wording, itemId });

describe('stored answers', () => {
	it('come back for the same item, pack and wording of the questions, and no other', async () => {
		await storeAnswers(of('1'), { a: 0.9 });
		expect(await storedAnswers(of('1'))).toEqual({ a: 0.9 });
		expect(await storedAnswers(of('1', 'before'))).toBeNull();
		expect(await storedAnswers(of('1', 'now', 'hn'))).toBeNull();
		expect(await storedAnswers(of('2'))).toBeNull();
	});

	it('drops the oldest past the cap', async () => {
		for (let item = 0; item <= ITEMS_KEPT; item++) await storeAnswers(of(String(item)), { a: 1 });
		expect(await storedAnswers(of('0'))).toBeNull();
		expect(await storedAnswers(of('1'))).toEqual({ a: 1 });
		expect(await storedAnswers(of(String(ITEMS_KEPT)))).toEqual({ a: 1 });
	});
});

describe('what is chosen for a pack', () => {
	it('starts as the pack ships it, off, and changes one thing at a time', async () => {
		await changePack(hn, () => ({ enabled: true }));
		expect((await settings.getValue()).packs).toEqual({
			hn: {
				enabled: true,
				sensitivity: 'medium',
				treatments: { snark: 'fade' },
				options: { loud: false }
			}
		});
		await changePack(hn, ({ options }) => ({ options: { ...options, loud: true } }));
		expect((await settings.getValue()).packs.hn).toMatchObject({
			enabled: true,
			options: { loud: true }
		});
	});

	it('keeps what Barrunto 1 had stored: X.com on, at the sensitivity chosen', async () => {
		await fakeBrowser.storage.local.set({
			settings: { paused: true, sensitivity: 'high', tuning: false },
			settings$: { v: 1 },
			totalCounters: { posts: 7, tokensIn: 70, tokensOut: 7 },
			totalCounters$: { v: 1 }
		});
		await Promise.all([settings.migrate(), totalCounters.migrate()]);
		expect(await settings.getValue()).toEqual({
			paused: true,
			tuning: false,
			lookAhead: 3,
			packs: { x: { enabled: true, sensitivity: 'high', treatments: {}, options: {} } }
		});
		expect(await totalCounters.getValue()).toEqual({ items: 7, tokensIn: 70, tokensOut: 7 });
	});

	it('keeps Hacker News fading its noise for whoever had asked it to', async () => {
		const hnBefore = { enabled: true, sensitivity: 'low', options: { fade: true } };
		await fakeBrowser.storage.local.set({
			settings: { paused: false, tuning: false, lookAhead: 5, packs: { hn: hnBefore } },
			settings$: { v: 3 }
		});
		await settings.migrate();
		expect((await settings.getValue()).packs.hn).toEqual({
			enabled: true,
			sensitivity: 'low',
			treatments: { snark: 'fade', tangent: 'fade' },
			options: {}
		});
	});
});

describe('counters', () => {
	it('counts every item when many finish at once', async () => {
		await Promise.all(Array.from({ length: 20 }, () => countItem({ tokensIn: 100, tokensOut: 5 })));
		const counted = { items: 20, tokensIn: 2000, tokensOut: 100 };
		expect(await sessionCounters.getValue()).toEqual(counted);
		expect(await totalCounters.getValue()).toEqual(counted);
	});

	it('resets both', async () => {
		await countItem({ tokensIn: 1, tokensOut: 1 });
		await resetCounters();
		expect((await sessionCounters.getValue()).items).toBe(0);
		expect((await totalCounters.getValue()).items).toBe(0);
	});
});
