import type { PageHalf } from '@/engine';
import type { Comment } from '../comment';
import {
	commentId,
	commentParts,
	findComments,
	labelAnchor,
	readComment,
	tuningAnchor
} from './read';

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
	parts: commentParts
};
