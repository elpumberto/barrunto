import { clears, contributions, strength } from '@/engine';
import type { Answers, CardTexts, Item, Judgment, Rules, Sensitivity } from '@/engine';

/**
 * What a card shows about the one thing a page is about: whose card it is, what the page says of
 * the thing with nobody asked, and then that Jev is being asked, why nothing came of asking, or the
 * judgments that clear the user's sensitivity, each with what pushed it and what held it back.
 * Every word in it is one of the pack's own, or a name or a number off the page, shown as text.
 */
export type Card = Sheet &
	(
		| { state: 'asking'; asking: string }
		| { state: 'failed'; reason: string }
		| { state: 'told'; nothing: string; charges: Charge[]; headings: Headings }
	);

/** What is on a card whatever came of asking. */
export interface Sheet {
	letterhead: string;
	signature: string;
	title: string;
	stamp: string;
	subject: string;
	facts: { name: string; value: string }[];
	findings: string;
	caveat: string;
}

export interface Charge {
	judgment: Judgment;
	/** How the judgment reads on the card. */
	reads: string;
	strength: number;
	/** How strong the hunch is, in words. */
	hunch: string;
	/** What pushed it and what held it back, as the card says each, what weighed most first. */
	pushed: string[];
	heldBack: string[];
}

export interface Headings {
	pushed: string;
	heldBack: string;
	none: string;
}

/** What an ingredient put in is told from this much. */
const WORTH_TELLING = 0.05;

/** What a card of this pack's carries about this item, before anything is known of its judgments. */
export const sheetFor = (texts: CardTexts, item: Item, stamp: string): Sheet => ({
	letterhead: texts.letterhead,
	signature: texts.signature,
	title: texts.title(item),
	stamp,
	subject: texts.subject,
	facts: texts.facts(item),
	findings: texts.findings,
	caveat: texts.caveat
});

/**
 * The card for an item Jev has answered about. A judgment is on it if it clears the threshold of
 * this sensitivity, the strongest first. How strong a hunch is called goes by the judgment's own
 * thresholds: strong is what would show even on low, fair what shows from medium.
 */
export function cardFor(
	rules: Rules,
	texts: CardTexts,
	answers: Answers,
	item: Item,
	sensitivity: Sensitivity
): Card {
	const told = (judgment: Judgment): Charge[] => {
		const contributed = contributions(judgment, rules, answers, item);
		const total = strength(contributed);
		if (!clears(judgment, total, sensitivity)) return [];
		const said = (pushes: boolean) =>
			contributed
				.filter((c) => Math.abs(c.amount) >= WORTH_TELLING && c.amount > 0 === pushes)
				.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
				.map((c) => {
					const said = texts.evidence[c.ingredient.id] ?? c.ingredient.id;
					return typeof said === 'string' ? said : said.say(item, answers);
				})
				.filter(Boolean);
		const hunch = clears(judgment, total, 'low')
			? texts.hunches.strong
			: clears(judgment, total, 'medium')
				? texts.hunches.fair
				: texts.hunches.faint;
		return [
			{
				judgment,
				reads: texts.charges[judgment.id] ?? judgment.label.text,
				strength: total,
				hunch,
				pushed: said(true),
				heldBack: said(false)
			}
		];
	};
	const charges = rules.judgments.flatMap(told).sort((a, b) => b.strength - a.strength);
	return {
		...sheetFor(texts, item, charges.length ? texts.stamps.charged : texts.stamps.clear),
		state: 'told',
		nothing: texts.nothing,
		charges,
		headings: { pushed: texts.pushed, heldBack: texts.heldBack, none: texts.none }
	};
}
