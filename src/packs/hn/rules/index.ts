import type { Presented, Rules } from '@/engine';
import type { Comment } from '../comment';
import { judgments } from './judgments';
import { signals } from './signals';
import { traits } from './traits';

/** No comment needs more than this to be judged, nor what surrounds it more than this to give it context. */
const MOST_CHARACTERS = { comment: 4000, context: 1500 };

/**
 * The comment as Jev reads it, and what it hangs from next to it, not inside it: the questions
 * point at these names, and what is inside `comment` is what is judged.
 */
function present({ text, story, parent }: Comment): Presented {
	return {
		story: {
			title: story.title,
			text: story.text.slice(0, MOST_CHARACTERS.context) || null
		},
		parent: parent && { text: parent.text.slice(0, MOST_CHARACTERS.context) },
		comment: { text: text.slice(0, MOST_CHARACTERS.comment) }
	};
}

/** Jev has to be this sure of a yes for a trait to count; see `Rules.doubt`. */
const doubt = 0.4;

export const rules: Rules<Comment> = { present, doubt, traits, signals, judgments };
