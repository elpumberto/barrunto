import type { Presented, Rules } from '@/engine';
import type { Post } from '../post';
import { judgments } from './judgments';
import { signals } from './signals';
import { traits } from './traits';

/** No post needs more than this to be judged, and a page could otherwise make a call as dear as it liked. */
const MOST_CHARACTERS = 4000;
const cut = (text: string) => text.slice(0, MOST_CHARACTERS);

/** The post as Jev reads it: who, what, and the numbers around it. The questions point at these names. */
function present(post: Post): Presented {
	const { author, text, metrics, hasMedia, hasLink, inThread, isCutShort, quoted } = post;
	return {
		post: {
			author: author.handle ? `${author.name} (${author.handle})` : author.name,
			text: cut(text),
			text_is_cut_short: isCutShort,
			replies: metrics.replies,
			reposts: metrics.reposts,
			likes: metrics.likes,
			carries_image_or_video: hasMedia,
			carries_link: hasLink,
			part_of_thread: inThread,
			quotes: quoted && { author: quoted.author, text: cut(quoted.text) }
		}
	};
}

/** Jev has to be this sure of a yes for a trait to count; see `Rules.doubt`. */
const doubt = 0.4;

export const rules: Rules<Post> = { present, doubt, traits, signals, judgments };
