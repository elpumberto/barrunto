import { clears, contributions, signalValue, strength } from '@/engine';
import type { Answers, Item, Judgment, Rules, Sensitivity } from '@/engine';

/** What the tuning detail shows for an item: everything that went into its judgments, or why nothing did. */
export type Tuning =
	| { analyzed: false; reason: string }
	| {
			analyzed: true;
			sensitivity: Sensitivity;
			doubt: number;
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
		inputs: [
			...rules.traits.map((t) => ({ name: t.name, value: answers[t.id] ?? 0, isSignal: false })),
			...rules.signals.map((s) => ({ name: s.name, value: signalValue(s, item), isSignal: true }))
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
