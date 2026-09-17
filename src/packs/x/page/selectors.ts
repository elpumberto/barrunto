/**
 * Where each thing sits on X.com's page. X.com changes these without notice:
 * when Barrunto stops seeing posts, this is the file to fix.
 */
export const selectors = {
	post: 'article[data-testid="tweet"]',
	/** The box of the timeline a post sits in. The line between posts is its edge, not the post's. */
	cell: '[data-testid="cellInnerDiv"]',
	/** Links whose address carries a post's id. The post's own is the one around its time. */
	permalink: 'a[href*="/status/"]',
	time: 'time',
	/** Every link to this very post. Besides the time, a post in a thread has one more: "Show this thread". */
	linkTo: (postId: string) => `a[href$="/status/${postId}"]`,
	text: '[data-testid="tweetText"]',
	/** The link that shows the rest of a long text. */
	showMore: '[data-testid="tweet-text-show-more-link"]',
	/** Inside the text, a link that leads out of X.com. */
	linkOut: 'a[href^="http"]:not([href*="x.com/"])',
	/** A post quoted inside another: what is in here belongs to the quoted post. */
	quoted: 'div[role="link"][tabindex]',
	/** The author's block: the name, then the handle, as links to the profile (plain text in a quoted post). */
	author: '[data-testid="User-Name"]',
	profileLink: 'a[href^="/"]',
	namePart: 'span',
	/** The padlock next to the name of an account whose posts only its followers can see. */
	protectedAccount: '[data-testid="icon-lock"]',
	media: '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"]',
	card: '[data-testid="card.wrapper"]',
	/** The row of buttons under the post, and the three whose counts Barrunto reads. */
	actions: 'div[role="group"]',
	replies: '[data-testid="reply"]',
	reposts: '[data-testid="retweet"], [data-testid="unretweet"]',
	likes: '[data-testid="like"], [data-testid="unlike"]'
};
