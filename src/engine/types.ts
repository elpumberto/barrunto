/**
 * What is read of one thing on a page: a post, a comment, a review. The engine needs only a name
 * to keep its answers under; the rest of its shape is the pack's own business.
 */
export interface Item {
	id: string;
}

/**
 * One concrete thing Jev is asked about an item. Never shown to the user. As a rule it is a yes/no
 * question; with `options` it asks which of them fits, as which kind of thing a part of the item is.
 */
export interface Trait {
	id: string;
	/** Short name, for the tuning detail. */
	name: string;
	question: string;
	/** What a yes means and what a no means, where the question alone leaves room for doubt. */
	yes?: string;
	no?: string;
	/** What there is to choose from, each by its id with what it means: one of them fits. */
	options?: Record<string, string>;
}

/**
 * A number from 0 to 1 that code works out without asking Jev: from the page data, as a rule. It is
 * handed Jev's answers too, for what only counting them tells: of how many parts of an item Jev
 * said one thing.
 */
export interface PageSignal<I extends Item = Item> {
	id: string;
	name: string;
	from(item: I, answers?: Answers): number;
}

/**
 * For each trait, the probability of a yes, from 0 to 1. A trait with options has one for each,
 * under the trait's id, a dot and the option's: `post3.advert`. They add up to 1.
 */
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
	/** Whether it is a kind of thing the user may rather not see: only those can be faded or hidden. */
	noise: boolean;
}

/** What is done to an item that gets the label of a noise judgment: label it and no more, fade it, or fold it away. */
export const TREATMENTS = ['label', 'fade', 'hide'] as const;
export type Treatment = (typeof TREATMENTS)[number];
/** What is done to noise until the user says otherwise: enough to tell it apart at a glance, and nothing out of sight. */
export const DEFAULT_TREATMENT: Treatment = 'fade';

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
	/**
	 * What else is asked about this item, in the same call, where that depends on the item: one
	 * question for each of its parts, as for each post of a profile.
	 */
	traitsOf?(item: I): Trait[];
	signals: PageSignal<I>[];
	judgments: Judgment[];
}

/** What the user has chosen for one pack. */
export interface PackSettings {
	enabled: boolean;
	sensitivity: Sensitivity;
	/** What is done to what each noise judgment labels, by judgment id. */
	treatments: Record<string, Treatment>;
}

/**
 * Everything specific to one site and one purpose, apart from the page itself: who it is, where it
 * acts and its rules. This half knows no page, so the background and
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
	rules: Rules<I>;
	/** Whether its page half reads what the user writes on the site too; see `DraftsHalf`. */
	readsDrafts?: boolean;
}

/** An item as read, the reason in words it is not for analyzing, or nothing when the page is not understood. */
export type Reading<I extends Item = Item> = { item: I } | { skipped: string } | null;

/**
 * Where in their anchor the labels go: hanging from its top right corner, that far from it as CSS
 * lengths, where the page leaves that corner free; or in line at its end, where it does not.
 */
export type LabelPlace = { top: string; right: string } | 'inline';

/** The half of a pack that runs inside the page: where the items are, how one is read, and where what Barrunto adds to it goes. */
export interface PageHalf<I extends Item = Item> {
	find(root: ParentNode): HTMLElement[];
	/** Which item an element shows. Cheap enough to ask on every change of the page. */
	idOf(element: HTMLElement): string | null;
	read(element: HTMLElement): Reading<I>;
	/** How long an item has to stay on screen before it is analyzed, in milliseconds. */
	dwellMs: number;
	/**
	 * The element the labels go in. It may be outside the item's own element, where that one would
	 * clip them; whatever was left in it by an item the page has since taken away is cleared.
	 */
	labelAnchor(element: HTMLElement): HTMLElement;
	/** Where in the anchor they go: the same for every item, or worked out for each where the page is not regular. */
	labelPlace: LabelPlace | ((element: HTMLElement) => LabelPlace);
	/** The element the tuning detail goes at the end of, and how far in from its left edge, as a CSS length. */
	tuningAnchor(element: HTMLElement): HTMLElement;
	tuningInset?: string;
	/**
	 * What of the item goes when the user would rather not see it, which is the pack's to choose.
	 * Faded, as a rule, its words and what goes with them. Hidden, all of it, with who wrote it: a line saying that it is hidden takes its
	 * place, at the end of the parent of the first of these. Labels that are hidden with it are
	 * named in that line.
	 */
	parts(element: HTMLElement): { faded: HTMLElement[]; hidden: HTMLElement[] };
	/** What the user writes on this site, for a pack that can tell them how it would be read. */
	drafts?: DraftsHalf<I>;
}

/**
 * What the user is writing on the page, read as one more item of the pack's: the same questions are
 * asked of it as of everyone else's, and the answer is shown to its author alone, before it is posted.
 */
export interface DraftsHalf<I extends Item = Item> {
	/** The boxes the user writes in that are on the page now. */
	find(root: ParentNode): HTMLElement[];
	/**
	 * What is written in a box, as an item. Its id has to change with its words: the answers are kept
	 * under it. Too little to say anything about is skipped.
	 */
	read(box: HTMLElement): Reading<I>;
	/** The element the hunch about it goes at the end of. */
	anchor(box: HTMLElement): HTMLElement;
}
