import type { Trait } from '@/engine';

/**
 * Every question is about `comment.text`, the words of a comment in a Hacker News thread. The
 * thread is about `story`, and when the comment answers another, that one is in `parent`:
 * both are context, never what is being judged. Jev lets what the parent says rub off on a short
 * comment, a question most of all, so the questions that suffered from it say so in their `no`.
 */
export const traits: Trait[] = [
	{
		id: 'teaches',
		name: 'teaches',
		question:
			'Would a reader of the thread come away from `comment.text` having learned something useful or non-obvious: an explanation, a correction, a finding, a how-to or a point argued with reasons?',
		yes: 'There is substance to take away: the comment explains how something works, corrects a mistake with the facts, reports what was found or argues with reasons.',
		no: 'There is nothing to take away: agreement or disagreement with no reasons, a passing remark, a joke, a complaint, a short plain answer, or a question. A question teaches nothing, however much `parent` does: only the words of `comment.text` count.'
	},
	{
		id: 'expertise',
		name: 'expertise',
		question:
			'Does the author of `comment.text` show working knowledge of the subject: mechanisms, technical detail or precise terms used the way someone in the field would?',
		yes: 'The comment goes into how or why with the detail of someone who has done the work: specifics of an implementation, a trade-off, a number with its context.',
		no: 'The comment speaks in general terms that need no knowledge of the subject, or only claims authority without showing it.'
	},
	{
		id: 'firstHand',
		name: 'first-hand',
		question:
			'Is the author of `comment.text` speaking from their own first-hand experience: something they did, built, ran, saw or lived through?',
		yes: 'The author reports their own experience or work.',
		no: "The author relays, comments on or speculates about things they were not part of, or says nothing about experience at all. Asking someone about their experience is a no: the experience in `parent` is not this author's."
	},
	{
		id: 'concrete',
		name: 'concrete',
		question:
			'Does `comment.text` give concrete information: specific facts, figures, names, steps, sources or details a reader could check or use?',
		yes: 'It carries specifics, such as numbers, what was done and what happened, a reference or a precise claim.',
		no: 'It stays general: opinions, moods or vague statements with nothing specific in them.'
	},
	{
		id: 'dismissive',
		name: 'dismissive',
		question:
			"Does `comment.text` dismiss the story, someone's work or the comment it answers without engaging with it?",
		yes: 'A shallow put-down: "this is just X with extra steps", "nobody needs this", "why would anyone", a verdict with no reasons behind it.',
		no: 'Criticism that gives its reasons, however harsh; or no dismissal at all. A short plain answer, agreement or a question is a no, however brief: being brief is not dismissing.'
	},
	{
		id: 'attacks',
		name: 'attacks',
		question:
			'Does `comment.text` sneer at, insult, mock or show contempt for a person or a group, including the author of the story or of the comment it answers?',
		yes: 'Name-calling, ridicule, hostile sarcasm, or blaming a whole group.',
		no: 'Disagreement or criticism of ideas or work without hostility towards people, or no target at all.'
	},
	{
		id: 'quip',
		name: 'quip',
		question:
			'Is the whole of `comment.text` a joke, a pun, a meme or a wisecrack, and nothing else?',
		yes: 'The whole comment is the joke or the jab.',
		no: 'The comment says something besides, even if it is witty; or it is not a joke at all, however short.'
	},
	{
		id: 'meta',
		name: 'meta',
		question:
			'Is `comment.text` about the submission rather than its subject: its title, its wording or formatting, a paywall, the website it is on, whether it was written by AI, votes, flags or Hacker News itself?',
		yes: 'The comment talks about the wrapper: the headline, the site, how it was written, moderation or the forum.',
		no: 'The comment talks about what the story or the thread is about. A remark on how `parent` put something, or thanks for it, is a no: that is talking with its author, not about the wrapper.'
	},
	{
		id: 'offTopic',
		name: 'off topic',
		question:
			'Does `comment.text` leave behind what the conversation is about for an unrelated subject? The conversation is `parent` when there is one, and `story` otherwise.',
		yes: "The comment takes a word or a side detail as an excuse to talk about something that has nothing to do with `parent` nor with `story`: a pet topic, politics, a cause of the author's own.",
		no: "The comment answers, continues or gives an example of what `parent` says, even when the thread has drifted far from `story` by then: threads drift, and following one is staying on topic. An experience of the author's own or another product brought up as a case of what is being discussed is a no. So is staying on what `story` is about. With little to go by, such as a bare title, it is a no."
	}
];
