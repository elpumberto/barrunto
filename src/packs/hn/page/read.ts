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

/** What Hacker News writes where a comment was. */
const GONE = /^\[(flagged|dead|deleted)\]$/i;

const textIn = (node: Element | null | undefined) => (node ? visibleText(node).trim() : '');

function depthOf(row: HTMLElement): number {
	const indent = row.querySelector(selectors.indent);
	// Newer pages say it outright; older ones only push the comment 40 pixels per level.
	const said = Number(indent?.getAttribute('indent'));
	if (Number.isInteger(said) && indent?.hasAttribute('indent')) return said;
	return Math.round(Number(indent?.querySelector('img')?.getAttribute('width') ?? 0) / 40);
}

/** What a comment says, as what another one answers; nothing if its words are gone. */
function said(words: Element | null | undefined): Comment['parent'] {
	const text = textIn(words);
	return text && !GONE.test(text) ? { text } : null;
}

/** The comment a row answers: the nearest one above it that sits less deep. */
function parentOf(row: HTMLElement, depth: number): Comment['parent'] {
	let above = row.previousElementSibling;
	while (depth > 0 && above instanceof HTMLElement) {
		if (above.matches(selectors.comment) && depthOf(above) < depth) {
			return said(above.querySelector(selectors.text));
		}
		above = above.previousElementSibling;
	}
	// On a page that shows one branch of a thread, the top comments answer the comment that heads it.
	const head = row.ownerDocument.querySelector(selectors.head);
	return depth === 0 ? said(head?.querySelector(selectors.text)) : null;
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

export function readComment(row: HTMLElement): Reading<Comment> {
	const id = commentId(row);
	const author = row.querySelector(selectors.author);
	if (!id || !row.querySelector(selectors.body)) return null;
	// A folded comment shows no words. It is not skipped for good: unfolded, it is read like any other.
	if (row.classList.contains(selectors.foldedClass)) return null;

	const text = textIn(row.querySelector(selectors.text));
	// A deleted or flagged comment keeps its place in the thread, with no words of its own left.
	if (!text || !author || GONE.test(text)) return { skipped: 'no text' };

	// Away from its thread, in a list of someone's comments, a comment comes with no story to set it
	// against: whether it keeps to the subject cannot be told, and that is half of what is asked.
	const story = storyOf(row);
	if (!story.title) return { skipped: 'no story to set it against' };

	return { item: { id, text, story, parent: parentOf(row, depthOf(row)) } };
}

/** Where the labels go: at the end of the comment's header, after the links to move about. */
export const labelAnchor = (row: HTMLElement): HTMLElement =>
	row.querySelector<HTMLElement>(selectors.header) ??
	row.querySelector<HTMLElement>(selectors.body) ??
	row;

/**
 * Where the tuning detail goes: at the end of the comment's cell, outside what is faded or hidden
 * with it, so that why a comment was hidden can be seen without showing the comment.
 */
export const tuningAnchor = (row: HTMLElement): HTMLElement =>
	row.querySelector<HTMLElement>(selectors.body) ?? row;

/**
 * Faded, a comment loses its words and keeps its header, labels and all. Hidden, it loses everything
 * in its cell, header too. Its place in the thread stays: the push to the right and the vote arrow.
 */
export function commentParts(row: HTMLElement): { faded: HTMLElement[]; hidden: HTMLElement[] } {
	const words = row.querySelector<HTMLElement>(selectors.content);
	const cell = row.querySelector<HTMLElement>(selectors.body);
	const mine = (child: Element): child is HTMLElement =>
		child instanceof HTMLElement && !child.hasAttribute('data-barrunto');
	return { faded: words ? [words] : [], hidden: cell ? [...cell.children].filter(mine) : [] };
}
