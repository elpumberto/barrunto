import { clears, contributions, signalValue, strength, traitsFor } from '@/engine';
import type { Answers, Item, Judgment, Rules, Sensitivity, Trait } from '@/engine';

/** What the tuning detail shows for an item: everything that went into its judgments, or why nothing did. */
export type Tuning =
	| { analyzed: false; reason: string }
	| {
			analyzed: true;
			sensitivity: Sensitivity;
			doubt: number;
			/** What was asked of each part of the item, part by part, told in a line: how many of each. */
			tallies: string[];
			inputs: TuningInput[];
			judgments: TuningJudgment[];
	  };

/** A trait with Jev's answer, or a page signal with what the page says. */
export interface TuningInput {
	name: string;
	value: number;
	isSignal: boolean;
}

export interface TuningJudgment {
	judgment: Judgment;
	strength: number;
	labelled: boolean;
	parts: { name: string; amount: number }[];
}

/**
 * A trait with options is asked of one part of an item after another, as of each post of a profile:
 * a row for each would bury the rest. They are told together, by what their names have in common:
 * which option Jev found likeliest, for how many. "post: made 4 · stock 2".
 */
function talliesOf(traits: Trait[], answers: Answers): string[] {
	const tallies = new Map<string, Map<string, number>>();
	for (const trait of traits) {
		const [likeliest] = Object.keys(trait.options ?? {})
			.map((id) => ({ id, value: answers[`${trait.id}.${id}`] ?? 0 }))
			.sort((a, b) => b.value - a.value);
		if (!likeliest) continue;
		const group = trait.name.replace(/\s*\d+$/, '');
		const tally = tallies.get(group) ?? new Map<string, number>();
		tallies.set(group, tally.set(likeliest.id, (tally.get(likeliest.id) ?? 0) + 1));
	}
	return [...tallies].map(
		([group, tally]) =>
			`${group}: ${[...tally]
				.sort((a, b) => b[1] - a[1])
				.map(([option, times]) => `${option} ${times}`)
				.join(' · ')}`
	);
}

export function tuningFor(
	rules: Rules,
	answers: Answers,
	item: Item,
	sensitivity: Sensitivity
): Tuning {
	const nameOf = (id: string) =>
		[...rules.traits, ...rules.signals].find((input) => input.id === id)?.name ?? id;

	return {
		analyzed: true,
		sensitivity,
		doubt: rules.doubt,
		tallies: talliesOf(traitsFor(rules, item), answers),
		inputs: [
			...rules.traits.map((t) => ({ name: t.name, value: answers[t.id] ?? 0, isSignal: false })),
			...rules.signals.map((s) => ({
				name: s.name,
				value: signalValue(s, item, answers),
				isSignal: true
			}))
		],
		judgments: rules.judgments.map((judgment) => {
			const contributed = contributions(judgment, rules, answers, item);
			const total = strength(contributed);
			return {
				judgment,
				strength: total,
				labelled: clears(judgment, total, sensitivity),
				parts: contributed.map((c) => ({ name: nameOf(c.ingredient.id), amount: c.amount }))
			};
		})
	};
}
