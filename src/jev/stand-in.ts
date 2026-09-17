import { fnv1a } from '@/engine';
import type { Answers } from '@/engine';
import { JevError } from './types';
import type { Jev } from './types';

/** How long the stand-in takes to answer, in milliseconds: from this, up to this much more. */
const ASK_MS = { least: 300, spread: 600 };
const CHECK_MS = 700;

/** How often an answer comes out as a clear yes; the rest come out as a clear no. */
const YES_RATE = 0.3;

/** A small seeded generator (mulberry32), so the same content always gets the same answers. */
function random(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Roughly four characters to a token. */
const tokens = (text: string) => Math.ceil(text.length / 4);

/**
 * A Jev that is not Jev: it takes any key, makes its answers up and takes about as long.
 * Most answers come out as a clear no (up to 0.4) and some as a clear yes (from 0.75), as a
 * model's would, so that labels turn up about as often as they should. A key that starts with
 * "bad" is rejected.
 */
export const standIn: Jev = {
	async ask(apiKey, content, traits) {
		if (apiKey.startsWith('bad')) throw new JevError('keyRejected');
		const text = JSON.stringify(content);
		const next = random(fnv1a(text));
		await wait(ASK_MS.least + next() * ASK_MS.spread);

		const answers: Answers = {};
		for (const trait of traits) {
			answers[trait.id] = next() < YES_RATE ? 0.75 + next() * 0.25 : next() ** 2 * 0.4;
		}
		const questions = traits.map((t) => t.question).join(' ');
		return {
			answers,
			usage: { tokensIn: tokens(text) + tokens(questions), tokensOut: traits.length * 2 }
		};
	},

	async checkKey(apiKey) {
		await wait(CHECK_MS);
		if (apiKey.startsWith('bad')) throw new JevError('keyRejected');
	}
};
