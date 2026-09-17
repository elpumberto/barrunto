/** What is read of a post. The id is the number X.com gives it, which sits in its link. */
export interface Post {
	id: string;
	text: string;
	author: { name: string; handle: string };
	metrics: Metrics;
	hasMedia: boolean;
	hasLink: boolean;
	inThread: boolean;
	/** Whether the page shows only the beginning of the text. */
	isCutShort: boolean;
	/** The post this one quotes, if it quotes one. */
	quoted: { author: string; text: string } | null;
}

export interface Metrics {
	replies: number;
	reposts: number;
	likes: number;
}

/** One concrete thing Jev is asked about a post, with a yes/no answer. Never shown to the user. */
export interface Trait {
	id: string;
	/** Short name, for the tuning detail. */
	name: string;
	question: string;
	/** What a yes means and what a no means, where the question alone leaves room for doubt. */
	yes?: string;
	no?: string;
}

/** A number from 0 to 1 that code draws from the page data without asking Jev. */
export interface PageSignal {
	id: string;
	name: string;
	from(post: Post): number;
}

/** For each trait, the probability of a yes, from 0 to 1. */
export type Answers = Record<string, number>;

export interface Ingredient {
	kind: 'trait' | 'signal';
	id: string;
	/** Positive pushes the judgment, negative holds it back. */
	weight: number;
}

export type Recipe = Ingredient[];

export const SENSITIVITIES = ['low', 'medium', 'high', 'ultra'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export interface Judgment {
	id: string;
	recipe: Recipe;
	/** The minimum strength to be painted, per sensitivity position. */
	thresholds: Record<Sensitivity, number>;
	label: Label;
}

/** How a judgment is painted. Colours and glyph are the pack's; the shape is the painter's. */
export interface Label {
	text: string;
	/** What the label says on hover. */
	hint: string;
	/** Inner markup of a 12 by 12 SVG, drawn in `currentColor`. */
	glyph: string;
	color: string;
	ink: string;
}

/** What Jev reports having spent on a call, in tokens. */
export interface Usage {
	tokensIn: number;
	tokensOut: number;
}

/** For each judgment, its strength from 0 to 1. */
export type Strengths = Record<string, number>;

/** What one ingredient put into a strength: its value, past the doubt if it is a trait, times its weight. */
export interface Contribution {
	ingredient: Ingredient;
	value: number;
	amount: number;
}

/** Plain data, as it travels to Jev. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** A post as put in front of Jev: plain text, or named fields the questions can point at. */
export type Presented = string | { [key: string]: Json };

export interface Rules {
	/** How a post is put in front of Jev: the material the questions are asked about. */
	present(post: Post): Presented;
	/**
	 * How sure of a yes Jev has to be for an answer to count at all, from 0 to 1. An answer near the
	 * middle means Jev cannot tell, not that the trait is half there: answers up to here count as a
	 * no, and from here to 1 they count from nothing to everything.
	 */
	doubt: number;
	traits: Trait[];
	signals: PageSignal[];
	judgments: Judgment[];
}
