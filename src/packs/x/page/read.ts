import type { LabelPlace, Reading } from '@/engine';
import type { Post } from '../post';
import { parseCount } from './count';
import { selectors } from './selectors';

export function findPosts(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(selectors.post)];
}

/** What belongs to the post itself and not to a post quoted inside it. */
function own<T extends Element>(
	article: HTMLElement,
	selector: string,
	fits: (found: T) => boolean = () => true
): T | null {
	for (const found of article.querySelectorAll<T>(selector)) {
		if (!found.closest(selectors.quoted) && fits(found)) return found;
	}
	return null;
}

/** The number X.com gives the post, from its link. Cheap enough to ask on every change of the page. */
export function postId(article: HTMLElement): string | null {
	const link = own<HTMLAnchorElement>(
		article,
		selectors.permalink,
		(a) => a.querySelector(selectors.time) !== null
	);
	return link?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1] ?? null;
}

function count(article: HTMLElement, selector: string): number {
	const button = own<HTMLElement>(article, selector);
	if (!button) return 0;
	// The button's spoken name carries the whole number; what is on screen is shortened.
	return (
		parseCount(button.getAttribute('aria-label') ?? '') || parseCount(button.textContent ?? '')
	);
}

/** Words as the reader sees them: emoji are images on X.com, with the character in their alt. */
function visibleText(node: Element): string {
	let text = '';
	for (const child of node.childNodes) {
		if (child instanceof HTMLImageElement) text += child.alt;
		else if (child instanceof Element) text += visibleText(child);
		else text += child.textContent ?? '';
	}
	return text;
}

function authorIn(block: HTMLElement): { name: string; handle: string } {
	// The post's own author: the first link to a profile holds the name, and its address the handle.
	const profile = block.querySelector<HTMLAnchorElement>(selectors.profileLink);
	if (profile) {
		const handle = `@${profile.getAttribute('href')!.slice(1)}`;
		return { name: visibleText(profile).trim() || handle, handle };
	}
	// A quoted post's author is plain text: the handle is the part that starts with "@".
	const parts = [...block.querySelectorAll(selectors.namePart)]
		.map((part) => visibleText(part).trim())
		.filter(Boolean);
	const handle = parts.find((part) => part.startsWith('@')) ?? '';
	return { name: parts.find((part) => part !== handle) ?? handle, handle };
}

export function readPost(article: HTMLElement): Reading<Post> {
	const id = postId(article);
	const author = own<HTMLElement>(article, selectors.author);
	// An ad shows the word "Ad" where a post shows its time, so it has no link of its own.
	if (!id) return author ? { skipped: 'ad' } : null;
	if (!author) return null;
	// What someone shows only to their followers is not Barrunto's to send anywhere.
	if (author.querySelector(selectors.protectedAccount)) return { skipped: 'protected account' };

	const textNode = own<HTMLElement>(article, selectors.text);
	const text = textNode ? visibleText(textNode).trim() : '';
	if (!text) return { skipped: 'no text' };

	const quotedPost = article.querySelector<HTMLElement>(selectors.quoted);
	const quotedText = quotedPost?.querySelector(selectors.text);
	const quotedAuthor = quotedPost?.querySelector<HTMLElement>(selectors.author);
	const quotedIsProtected = quotedPost?.querySelector(selectors.protectedAccount) != null;

	return {
		item: {
			id,
			text,
			author: authorIn(author),
			metrics: {
				replies: count(article, selectors.replies),
				reposts: count(article, selectors.reposts),
				likes: count(article, selectors.likes)
			},
			hasMedia: own(article, selectors.media) !== null,
			hasLink:
				own(article, selectors.card) !== null || textNode?.querySelector(selectors.linkOut) != null,
			inThread: article.querySelectorAll(selectors.linkTo(id)).length > 1,
			isCutShort: own(article, selectors.showMore) !== null,
			quoted:
				quotedText && !quotedIsProtected
					? {
							author: quotedAuthor ? authorIn(quotedAuthor).handle : '',
							text: visibleText(quotedText).trim()
						}
					: null
		}
	};
}

/**
 * Where the labels hang: from the line above the post. That line is the edge of the timeline's box,
 * and the post starts a little under it, how far depending on what comes before. The post clips
 * what sticks out of it, so the labels go in the box, not in the post. If X.com's layout changes,
 * this and the pack's `labelPlace` are what move.
 */
export const labelAnchor = (article: HTMLElement): HTMLElement =>
	article.closest<HTMLElement>(selectors.cell) ?? article;

/** Clear of X.com's own two buttons in that corner: Grok's and the menu. */
const FROM_THE_RIGHT = '84px';
/** A box this short with nothing in it is a gap X.com leaves, after a module such as "Who to follow". */
const GAP_AT_MOST = 24;
/** Inside a gap, the line is an element this thin at most. */
const LINE_AT_MOST = 2;

/**
 * The line above a post is, as a rule, the lower edge of the box right above, and the post's own box
 * starts under it. But after a module X.com leaves an empty box as a gap, and draws the line inside
 * it, with air on both sides: there the labels hang from wherever that line turns out to be.
 */
export function labelPlace(article: HTMLElement): Exclude<LabelPlace, 'inline'> {
	const cell = article.closest(selectors.cell);
	const above = cell?.previousElementSibling;
	const hangsFromThePost = { top: '0', right: FROM_THE_RIGHT };
	// What is above is nearly always a post: that is told by its words, without measuring anything.
	if (!cell || !above || above.textContent?.trim()) return hangsFromThePost;
	const height = above.getBoundingClientRect().height;
	if (height <= 0 || height > GAP_AT_MOST) return hangsFromThePost;
	const line = [...above.querySelectorAll('*')].find((inside) => {
		const thickness = inside.getBoundingClientRect().height;
		return thickness > 0 && thickness <= LINE_AT_MOST;
	});
	const from = (line ?? above).getBoundingClientRect().top - cell.getBoundingClientRect().top;
	return { top: `${Math.round(from)}px`, right: FROM_THE_RIGHT };
}

/**
 * Where the tuning detail goes: under the post, outside what is faded or hidden with it, so that
 * why a post was hidden can be seen without showing the post. Not in the post itself: X.com lays a
 * post out as a row, and whatever is put in it lands beside its content, not under it.
 */
export function tuningAnchor(article: HTMLElement): HTMLElement {
	const around = article.parentElement;
	// X.com gives each post an element of its own around it. Where it did not, posts would share
	// one detail between them: better beside the post than that.
	return around && findPosts(around).length === 1 ? around : article;
}
