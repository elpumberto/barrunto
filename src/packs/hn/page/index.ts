import type { PageHalf } from '@/engine';
import type { Comment } from '../comment';
import { FADE } from '../controls';
import { commentId, findComments, labelAnchor, readComment, tuningAnchor, wordsOf } from './read';

/** How much of itself a faded comment keeps: about what Hacker News leaves a downvoted one. */
const FADED = '0.45';
/** The labels that fade a comment, unless it also carries one that does not. */
const FADING = ['snark', 'tangent'];

export const page: PageHalf<Comment> = {
	find: findComments,
	idOf: commentId,
	read: readComment,
	// A thread is read slowly and shows many comments at once: a little longer than a glance.
	dwellMs: 1000,
	labelAnchor,
	// A comment's cell is only as wide as its words: a label hung from its corner would cover them.
	labelPlace: 'inline',
	tuningAnchor,

	/** Fades what is labelled as noise and nothing else, so that a wrong label is still there to be seen. */
	act(row, labelled, options) {
		const words = wordsOf(row);
		if (!words) return;
		const noise = labelled.length > 0 && labelled.every((j) => FADING.includes(j.id));
		words.style.opacity = options[FADE] && noise ? FADED : '';
	}
};
