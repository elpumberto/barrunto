import type { PageSignal } from '@/engine';
import type { Post } from '../post';

/**
 * Many replies for so few likes: from half a reply per like, up to two. With a handful of replies the
 * ratio says nothing (one reply and no likes is not a pile-up), so it counts in full only from twenty.
 */
const replyRatio: PageSignal<Post> = {
	id: 'replyRatio',
	name: 'reply ratio',
	from: ({ metrics }) =>
		((metrics.replies / (metrics.likes + 1) - 0.5) / 1.5) * Math.min(1, metrics.replies / 20)
};

/** Room to say something: nothing up to 80 characters, everything from 280. */
const length: PageSignal<Post> = {
	id: 'length',
	name: 'length',
	from: ({ text }) => (text.length - 80) / 200
};

export const signals: PageSignal<Post>[] = [replyRatio, length];
