import type {
	Answers,
	Contribution,
	Item,
	Judgment,
	PageSignal,
	Rules,
	Strengths,
	Trait
} from './types';

export const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** What a page signal says about an item, held between 0 and 1. What it cannot work out is nothing. */
export const signalValue = (signal: PageSignal, item: Item, answers: Answers = {}) =>
	clamp(signal.from(item, answers) || 0);

/** Everything Jev is asked about an item: what it is asked of every one, and what of this one alone. */
export const traitsFor = (rules: Rules, item: Item): Trait[] => [
	...rules.traits,
	...(rules.traitsOf?.(item) ?? [])
];

/** What each ingredient of a judgment's recipe puts in for this item. Unknown ingredients put in nothing. */
export function contributions(
	judgment: Judgment,
	rules: Rules,
	answers: Answers,
	item: Item
): Contribution[] {
	return judgment.recipe.map((ingredient) => {
		let value = 0;
		if (ingredient.kind === 'trait') {
			value = clamp(((answers[ingredient.id] ?? 0) - rules.doubt) / (1 - rules.doubt));
		} else {
			const signal = rules.signals.find((s) => s.id === ingredient.id);
			if (signal) value = signalValue(signal, item, answers);
		}
		return { ingredient, value, amount: value * ingredient.weight };
	});
}

/** The weighted sum of a recipe, clamped between 0 and 1. */
export function strength(contributed: Contribution[]): number {
	return clamp(contributed.reduce((sum, c) => sum + c.amount, 0));
}

export function strengthsFor(rules: Rules, answers: Answers, item: Item): Strengths {
	return Object.fromEntries(
		rules.judgments.map((j) => [j.id, strength(contributions(j, rules, answers, item))])
	);
}
