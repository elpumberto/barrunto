import type { Presented, Rules } from '@/engine';
import type { Profile } from '../profile';
import { judgments } from './judgments';
import { asked, postTraits } from './kinds';
import { signals } from './signals';
import { traits } from './traits';

/** No account needs more than this to be judged, and a page could otherwise make a call as dear as it liked. */
const MOST_IN_A_POST = 400;
const MOST_IN_A_BIO = 400;
const MOST_IN_A_NAME = 80;

/**
 * The account as Jev reads it: the least that has to be read. Not its handle, whose shape code looks
 * at, nor its numbers and dates, which are the page signals' business.
 */
function present(profile: Profile): Presented {
	const { name, bio } = profile;
	return {
		profile: {
			name: name.slice(0, MOST_IN_A_NAME),
			bio: bio.slice(0, MOST_IN_A_BIO),
			posts: asked(profile).map((post) => post.text.slice(0, MOST_IN_A_POST))
		}
	};
}

/** Jev has to be this sure of a yes for a trait to count; see `Rules.doubt`. */
const doubt = 0.4;

export const rules: Rules<Profile> = {
	present,
	doubt,
	traits,
	// What kind of thing each post is, asked post by post in the same call.
	traitsOf: postTraits,
	signals,
	judgments
};
