import { fnv1a } from '@/engine';
import type { DraftsHalf, Reading } from '@/engine';
import type { Post } from '../post';
import { selectors } from './selectors';

/** Fewer characters than this say nothing worth a call: a word or two, a name. */
const FEWEST_CHARACTERS = 15;

export function findDrafts(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(selectors.draft)];
}

/**
 * The column a draft sits in, next to its author's picture: the box, what is attached to it and
 * nothing of another draft in the same thread. Where the page is not as expected, the box's own parent.
 */
export function draftColumn(box: HTMLElement): HTMLElement {
	for (let inside = box; inside.parentElement; inside = inside.parentElement) {
		const around = inside.parentElement;
		if (findDrafts(around).length > 1) break;
		const picture = around.querySelector(selectors.ownPicture);
		if (picture && !inside.contains(picture)) return inside;
	}
	return box.parentElement ?? box;
}

/** The words as written, a line for each paragraph of the editor. */
function written(box: HTMLElement): string {
	const lines = [...box.querySelectorAll(selectors.draftLine)];
	return (
		lines.length ? lines.map((line) => line.textContent ?? '').join('\n') : (box.textContent ?? '')
	).trim();
}

/**
 * What is being written, as the post it would be: nobody has answered or liked it yet. Its id is
 * made of its words, so that the same words are asked about only once.
 */
export function readDraft(box: HTMLElement): Reading<Post> {
	const text = written(box);
	if (text.length < FEWEST_CHARACTERS) return { skipped: 'too short to tell' };

	const column = draftColumn(box);
	const picture = column.parentElement?.querySelector(selectors.ownPicture);
	const named = picture?.getAttribute('data-testid')?.match(/^UserAvatar-Container-(.+)$/)?.[1];
	const handle = named ? `@${named}` : '';
	const around = box.closest(selectors.composer) ?? document;
	return {
		item: {
			id: `draft-${text.length}-${fnv1a(text)}`,
			text,
			author: { name: handle || 'the author', handle },
			metrics: { replies: 0, reposts: 0, likes: 0 },
			hasMedia: column.querySelector(selectors.attached) !== null,
			hasLink: /\bhttps?:\/\/\S+/i.test(text),
			inThread: findDrafts(around).length > 1,
			isCutShort: false,
			quoted: null
		}
	};
}

export const drafts: DraftsHalf<Post> = { find: findDrafts, read: readDraft, anchor: draftColumn };
