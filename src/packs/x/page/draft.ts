import { fnv1a } from '@/engine';
import type { DraftsHalf, Reading } from '@/engine';
import type { Post } from '../post';
import { visibleText } from './read';
import { selectors } from './selectors';

/** Fewer characters than this say nothing worth a call: a word or two, a name. */
const FEWEST_CHARACTERS = 15;

export function findDrafts(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(selectors.draft)];
}

/**
 * The column a draft sits in, next to its author's picture: the box, what is attached to it and
 * nothing of another draft in the same thread. The picture comes before the box: one after it is
 * somebody else's, in a post quoted under what is written.
 */
export function draftColumn(box: HTMLElement): HTMLElement | null {
	for (let inside = box; inside.parentElement; inside = inside.parentElement) {
		const around = inside.parentElement;
		if (findDrafts(around).length > 1) return null;
		const picture = around.querySelector(selectors.ownPicture);
		const before =
			picture && picture.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING;
		if (picture && before && !inside.contains(picture)) return inside;
	}
	return null;
}

/**
 * Where the hunch goes: around the box alone, inside its column, since at the top of the timeline
 * the column holds the buttons too. Where the page is not as expected, around the editor, never in it.
 */
export function draftAnchor(box: HTMLElement): HTMLElement {
	const column = draftColumn(box);
	const inColumn = [...(column?.children ?? [])].find((child) => child.contains(box));
	if (inColumn instanceof HTMLElement && inColumn !== box) return inColumn;
	return box.closest<HTMLElement>(selectors.draftLabel)?.parentElement ?? box.parentElement ?? box;
}

/** The words as written, a line for each paragraph of the editor. */
function written(box: HTMLElement): string {
	const lines = [...box.querySelectorAll(selectors.draftLine)];
	return (lines.length ? lines : [box]).map(visibleText).join('\n').trim();
}

/**
 * What is being written, as the post it would be: nobody has answered or liked it yet. Its id is
 * made of everything Jev is told of it, so that the same draft is asked about only once.
 */
export function readDraft(box: HTMLElement): Reading<Post> {
	const text = written(box);
	if (text.length < FEWEST_CHARACTERS) return { skipped: 'too short to tell' };

	const composer = box.closest(selectors.composer);
	const hasMedia =
		(draftColumn(box) ?? draftAnchor(box)).querySelector(selectors.attached) !== null;
	// Only in its window is a thread written: the box at the top of the timeline holds one post.
	const inThread = composer !== null && findDrafts(composer).length > 1;
	return {
		item: {
			id: `draft-${text.length}-${fnv1a(`${text}\n${hasMedia}${inThread}`)}`,
			text,
			// Whose it is says nothing of how it reads, and is nobody's business yet.
			author: { name: 'the author', handle: '' },
			metrics: { replies: 0, reposts: 0, likes: 0 },
			hasMedia,
			hasLink: /\bhttps?:\/\/\S+/i.test(text),
			inThread,
			isCutShort: false,
			quoted: null
		}
	};
}

export const drafts: DraftsHalf<Post> = { find: findDrafts, read: readDraft, anchor: draftAnchor };
