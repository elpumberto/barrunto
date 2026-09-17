import type { Presented, Rules } from '@/engine';
import type { Comment } from '../comment';
import { judgments } from './judgments';
import { signals } from './signals';
import { traits } from './traits';

/** No comment needs more than this to be judged, nor what surrounds it more than this to give it context. */
const MOST_CHARACTERS = { comment: 4000, context: 1500 };

/** The comment as Jev reads it, with what it hangs from. The questions point at these names. */
function present({ author, text, depth, story, parent }: Comment): Presented {
	return {
		story: {
			title: story.title,
			text: story.text.slice(0, MOST_CHARACTERS.context) || null
		},
		comment: {
			author,
			text: text.slice(0, MOST_CHARACTERS.comment),
			depth_in_thread: depth,
			answers: parent && {
				author: parent.author,
				text: parent.text.slice(0, MOST_CHARACTERS.context)
			}
		}
	};
}

/** Jev has to be this sure of a yes for a trait to count; see `Rules.doubt`. */
const doubt = 0.4;

export const rules: Rules<Comment> = { present, doubt, traits, signals, judgments };
