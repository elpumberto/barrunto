/**
 * First steps of an address on X.com that are not an account: its own sections. X.com keeps these
 * names from being taken as handles. One that is missing here does little harm: a page that is
 * not a profile shows no profile to read.
 */
const NOT_ACCOUNTS = new Set([
	'about',
	'account',
	'communities',
	'compose',
	'download',
	'explore',
	'hashtag',
	'help',
	'home',
	'i',
	'intent',
	'jobs',
	'login',
	'logout',
	'messages',
	'notifications',
	'privacy',
	'search',
	'settings',
	'share',
	'signup',
	'tos'
]);

/**
 * What may follow the handle with the profile still there: its tabs, and its two pictures, which
 * open over it. Not a post of the account's, nor the lists of who it follows.
 */
const PARTS_OF_A_PROFILE = new Set([
	'',
	'with_replies',
	'reposts',
	'highlights',
	'articles',
	'media',
	'likes',
	'affiliates',
	'superfollows',
	'photo',
	'header_photo'
]);

const HANDLE = /^[a-z0-9_]{1,15}$/i;

/** The account whose profile the page at this address is, as its handle in lower case; or null where it is no profile. */
export function profileAt(address: string): string | null {
	let path: string;
	try {
		path = new URL(address).pathname;
	} catch {
		return null;
	}
	const [handle = '', part = '', ...more] = path.split('/').filter(Boolean);
	if (more.length || !HANDLE.test(handle) || NOT_ACCOUNTS.has(handle.toLowerCase())) return null;
	return PARTS_OF_A_PROFILE.has(part) ? handle.toLowerCase() : null;
}
