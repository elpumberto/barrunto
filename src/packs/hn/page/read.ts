import type { Reading } from '@/engine';
import type { Comment } from '../comment';
import { selectors } from './selectors';

export function findComments(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(selectors.comment)];
}

export const commentId = (row: HTMLElement): string | null => row.id || null;

/** Words as the reader sees them: paragraphs apart, and without the reply link. */
function visibleText(node: Element): string {
	let text = '';
	for (const child of node.childNodes) {
		if (!(child instanceof Element)) text += child.textContent ?? '';
		else if (!child.matches(selectors.reply)) {
			text += (child.tagName === 'P' ? '\n\n' : '') + visibleText(child);
		}
	}
	return text;
}

const textIn = (node: Element | null | undefined) => (node ? visibleText(node).trim() : '');

function depthOf(row: HTMLElement): number {
	const indent = row.querySelector(selectors.indent);
	// Newer pages say it outright; older ones only push the comment 40 pixels per level.
	const said = Number(indent?.getAttribute('indent'));
	if (Number.isInteger(said) && indent?.hasAttribute('indent')) return said;
	return Math.round(Number(indent?.querySelector('img')?.getAttribute('width') ?? 0) / 40);
}

/** The comment a row answers: the nearest one above it that sits less deep. */
function parentOf(row: HTMLElement, depth: number): Comment['parent'] {
	let above = row.previousElementSibling;
	while (depth > 0 && above instanceof HTMLElement) {
		if (above.matches(selectors.comment) && depthOf(above) < depth) {
			const text = textIn(above.querySelector(selectors.text));
			return text ? { author: textIn(above.querySelector(selectors.author)), text } : null;
		}
		above = above.previousElementSibling;
	}
	// On a page that shows one branch of a thread, the top comments answer the comment that heads it.
	const head = row.ownerDocument.querySelector(selectors.head);
	const text = depth === 0 ? textIn(head?.querySelector(selectors.text)) : '';
	return text ? { author: textIn(head?.querySelector(selectors.author)), text } : null;
}

function storyOf(row: HTMLElement): Comment['story'] {
	const head = row.ownerDocument.querySelector(selectors.head);
	const title =
		head?.querySelector(selectors.storyTitle) ??
		head?.querySelector(selectors.onStory) ??
		row.querySelector(selectors.onStory);
	// Named from a comment, a long title is cut short on the page and whole in the link's own title.
	return {
		title: title?.getAttribute('title') || textIn(title),
		text: textIn(head?.querySelector(selectors.storyText))
	};
}

/** What Hacker News writes where a comment was. */
const GONE = /^\[(flagged|dead|deleted)\]$/i;

export function readComment(row: HTMLElement): Reading<Comment> {
	const id = commentId(row);
	const author = row.querySelector(selectors.author);
	if (!id || !row.querySelector(selectors.body)) return null;
	// A folded comment shows no words. It is not skipped for good: unfolded, it is read like any other.
	if (row.classList.contains(selectors.foldedClass)) return null;

	const text = textIn(row.querySelector(selectors.text));
	// A deleted or flagged comment keeps its place in the thread, with no words of its own left.
	if (!text || !author || GONE.test(text)) return { skipped: 'no text' };

	const depth = depthOf(row);
	return {
		item: {
			id,
			text,
			author: textIn(author),
			depth,
			story: storyOf(row),
			parent: parentOf(row, depth)
		}
	};
}

/** Where the labels go: at the end of the comment's header, after the links to move about. */
export const labelAnchor = (row: HTMLElement): HTMLElement =>
	row.querySelector<HTMLElement>(selectors.header) ??
	row.querySelector<HTMLElement>(selectors.body) ??
	row;

/** Where the tuning detail goes: at the end of the comment, under its reply link. */
export const tuningAnchor = (row: HTMLElement): HTMLElement =>
	row.querySelector<HTMLElement>(selectors.content) ?? row;

/** The words of the comment, which is what fades. */
export const wordsOf = (row: HTMLElement) => row.querySelector<HTMLElement>(selectors.text);
