import type { PageHalf } from '@/engine';
import type { Post } from '../post';
import { findPosts, labelAnchor, labelPlace, postId, readPost, tuningAnchor } from './read';

export const page: PageHalf<Post> = {
	find: findPosts,
	idOf: postId,
	read: readPost,
	// Long enough that a post flying past on the scroll is not paid for.
	dwellMs: 700,
	labelAnchor,
	labelPlace,
	tuningAnchor,
	// In line with the post's words: past its padding, its author's picture and the gap after it.
	tuningInset: '64px',
	// Faded or hidden, it is everything X.com draws of the post. The labels hang from the box around it, and stay.
	parts(article) {
		const all = article.firstElementChild instanceof HTMLElement ? [article.firstElementChild] : [];
		return { faded: all, hidden: all };
	}
};
