import { describe, expect, it } from 'vitest';
import { SENSITIVITIES } from '@/engine';
import { packs } from '.';
import { pages } from './pages';

describe('the packs', () => {
	it('have a name of their own each, and a half that reads the page', () => {
		const ids = packs.map((pack) => pack.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(Object.keys(pages).sort()).toEqual([...ids].sort());
	});

	it('say that they read what the user writes exactly when their page half does', () => {
		for (const pack of packs) {
			expect(Boolean(pack.readsDrafts), pack.id).toBe(Boolean(pages[pack.id]?.drafts));
		}
	});

	it('act on sites Chrome can be asked leave for', () => {
		for (const pack of packs) {
			expect(pack.sites.length).toBeGreaterThan(0);
			expect(new Set(pack.sites).size).toBe(pack.sites.length);
			// A whole site, named outright: the simplest thing Chrome can be asked leave for. Two packs
			// may name the same one: each is turned on and off by itself.
			for (const site of pack.sites) expect(site).toMatch(/^https:\/\/[^/*]+\/\*$/);
		}
	});

	describe.each(packs)('$name', ({ rules }) => {
		it('counts an answer from somewhere short of certainty', () => {
			expect(rules.doubt).toBeGreaterThanOrEqual(0);
			expect(rules.doubt).toBeLessThan(1);
		});

		it('names in every recipe a trait or a page signal that exists, once', () => {
			const ids = [...rules.traits, ...rules.signals].map((input) => input.id);
			expect(new Set(ids).size).toBe(ids.length);
			for (const judgment of rules.judgments) {
				for (const { kind, id } of judgment.recipe) {
					const among = kind === 'trait' ? rules.traits : rules.signals;
					expect(
						among.map((input) => input.id),
						`${judgment.id}: ${id}`
					).toContain(id);
				}
			}
		});

		it('asks for less strength at each step up in sensitivity', () => {
			for (const { thresholds } of rules.judgments) {
				const steps = SENSITIVITIES.map((s) => thresholds[s]);
				expect(steps).toEqual([...steps].sort((a, b) => b - a));
				expect(new Set(steps).size).toBe(steps.length);
			}
		});

		it('names each judgment once', () => {
			const ids = rules.judgments.map((j) => j.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});
});
