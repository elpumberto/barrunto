/**
 * What is read of one thing on a page: a post, a comment, a review. The engine needs only a name
 * to keep its answers under; the rest of its shape is the pack's own business.
 */
export interface Item {
	id: string;
}

/** One concrete thing Jev is asked about an item, with a yes/no answer. Never shown to the user. */
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
export interface PageSignal<I extends Item = Item> {
	id: string;
	name: string;
	from(item: I): number;
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

/** An item as put in front of Jev: plain text, or named fields the questions can point at. */
export type Presented = string | { [key: string]: Json };

export interface Rules<I extends Item = Item> {
	/** How an item is put in front of Jev: the material the questions are asked about. */
	present(item: I): Presented;
	/**
	 * How sure of a yes Jev has to be for an answer to count at all, from 0 to 1. An answer near the
	 * middle means Jev cannot tell, not that the trait is half there: answers up to here count as a
	 * no, and from here to 1 they count from nothing to everything.
	 */
	doubt: number;
	traits: Trait[];
	signals: PageSignal<I>[];
	judgments: Judgment[];
}

/** A switch a pack puts in front of the user, besides the ones every pack gets. */
export interface Control {
	id: string;
	title: string;
	help: string;
	/** How it stands until the user moves it. */
	initial: boolean;
}

/** How the user has left a pack's controls, by control id. */
export type Options = Record<string, boolean>;

/** What the user has chosen for one pack. */
export interface PackSettings {
	enabled: boolean;
	sensitivity: Sensitivity;
	options: Options;
}

/**
 * Everything specific to one site and one purpose, apart from the page itself: who it is, where it
 * acts, what it lets the user adjust and its rules. This half knows no page, so the background and
 * the extension's own pages can use it. The half that reads the page is a `PageHalf`.
 *
 * A pack is written for its own kind of item and used by an engine that knows none. The places an
 * item goes in are methods for that reason: TypeScript lets a `Pack<Post>` stand where a `Pack` is
 * asked for, and the engine hands each pack back only the items that pack read.
 */
export interface Pack<I extends Item = Item> {
	id: string;
	name: string;
	description: string;
	/** Where it acts, as match patterns: `https://x.com/*`. The user grants each pack its sites. */
	sites: string[];
	/** What it calls its items, for the counters: "posts", "comments". */
	items: string;
	controls: Control[];
	rules: Rules<I>;
}

/** An item as read, the reason in words it is not for analyzing, or nothing when the page is not understood. */
export type Reading<I extends Item = Item> = { item: I } | { skipped: string } | null;

/**
 * Where in their anchor the labels go: hanging from its top right corner, that far from it as CSS
 * lengths, where the page leaves that corner free; or in line at its end, where it does not.
 */
export type LabelPlace = { top: string; right: string } | 'inline';

/** The half of a pack that runs inside the page: where the items are, how one is read and what is done to it. */
export interface PageHalf<I extends Item = Item> {
	find(root: ParentNode): HTMLElement[];
	/** Which item an element shows. Cheap enough to ask on every change of the page. */
	idOf(element: HTMLElement): string | null;
	read(element: HTMLElement): Reading<I>;
	/** How long an item has to stay on screen before it is analyzed, in milliseconds. */
	dwellMs: number;
	/** The element the labels go in. */
	labelAnchor(element: HTMLElement): HTMLElement;
	labelPlace: LabelPlace;
	/** The element the tuning detail goes at the end of. */
	tuningAnchor(element: HTMLElement): HTMLElement;
	/**
	 * What the pack does to an item besides labelling it, given the labels it got and how the pack's
	 * controls stand. Called again whenever either changes, so it has to undo as well as do.
	 */
	act?(element: HTMLElement, labelled: Judgment[], options: Options): void;
}
