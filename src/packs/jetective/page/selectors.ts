/**
 * Where each thing sits on a profile page of X.com. X.com changes these without notice: when the
 * case file stops turning up, this is the file to fix.
 */
export const selectors = {
	/** The middle column: the profile and its posts, and not who to follow or what is trending. */
	column: '[data-testid="primaryColumn"]',
	/** The name, its badges and, under them, the handle. */
	name: '[data-testid="UserName"]',
	/** Inside it, the name as written: the first run of text, before the badges. */
	nameWords: 'div[dir="ltr"] > span > span',
	bio: '[data-testid="UserDescription"]',
	/** The padlock next to the name of an account whose posts only its followers can see. Not seen on a real page yet. */
	protectedAccount: '[data-testid="icon-lock"]',
	/**
	 * What X.com puts where there is nothing to show. An account with no posts has one too, under its
	 * tabs: with no tabs, it is the account itself that is not there, suspended or never opened. Not
	 * seen on a real page yet.
	 */
	nothingHere: '[data-testid="emptyState"]',
	/** A tab of the profile. Every profile has this one, whatever the language. */
	tab: 'a[role="tab"][href$="/with_replies"]',
	tabs: 'nav',
	/**
	 * What X.com tells search engines about the profile, as data: when the account was opened and
	 * its counts, whole and in no language. X.com leaves the one of the profile the tab was opened on
	 * and adds one for each profile gone to since: the one to read names the handle.
	 */
	data: 'script[type="application/ld+json"]',
	post: 'article[data-testid="tweet"]',
	text: '[data-testid="tweetText"]',
	time: 'time[datetime]',
	/** Inside the text, a link that leads out of X.com; under it, the card X.com makes of one. */
	linkOut: 'a[href^="http"]:not([href*="x.com/"])',
	card: '[data-testid="card.wrapper"]',
	/** The author's block of a post: the first link in it leads to their profile. */
	author: '[data-testid="User-Name"]',
	profileLink: 'a[href]',
	/** A post quoted inside another, which has an author of its own. A badge next to a name looks the same, and has none. */
	quoted: 'div[role="link"][tabindex]',
	/** What X.com says over a post: that it is pinned, as plain words; that it was reposted, as a link to who did. */
	context: '[data-testid="socialContext"]'
};
