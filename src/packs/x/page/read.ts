import type { Reading } from '@/engine';
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
 * Where the label hangs: from the post itself, which is where X.com leaves room for it.
 * If X.com's layout changes, this and the pack's `labelPlace` are what move.
 */
export const labelAnchor = (article: HTMLElement): HTMLElement => article;

/** Where the tuning detail goes: at the end of the post's content, under the row of buttons. */
export function tuningAnchor(article: HTMLElement): HTMLElement {
	return own<HTMLElement>(article, selectors.actions)?.parentElement ?? article;
}
