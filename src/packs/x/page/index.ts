import type { PageHalf } from '@/engine';
import type { Post } from '../post';
import { findPosts, labelAnchor, postId, readPost, tuningAnchor } from './read';

export const page: PageHalf<Post> = {
	find: findPosts,
	idOf: postId,
	read: readPost,
	// Long enough that a post flying past on the scroll is not paid for.
	dwellMs: 700,
	labelAnchor,
	// Clear of X.com's own two buttons in that corner: Grok's and the menu.
	labelPlace: { top: '0', right: '84px' },
	tuningAnchor
};
