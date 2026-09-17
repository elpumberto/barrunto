import type { Trait } from '@/engine';

/**
 * Every question is about `post.text`, the words of a post on X.com. When the post quotes another,
 * that one is in `post.quotes`: it is context, never what is being judged.
 */
export const traits: Trait[] = [
	{
		id: 'asksReaction',
		name: 'asks reaction',
		question:
			'Does `post.text` explicitly ask its readers to react: to reply, comment, like, repost, follow, tag someone or vote?',
		yes: 'The post tells readers to do one of those things in so many words, such as "comment YES", "repost if you agree", "follow for more" or "tag a friend".',
		no: 'The post gives its readers no such instruction. A question alone, with no instruction to answer it, is a no.'
	},
	{
		id: 'fishesReplies',
		name: 'fishes replies',
		question:
			'Is `post.text` mainly a prompt thrown at the audience to collect replies: a poll-like or open question anyone could answer, asked to get people talking rather than because the author needs the answer?',
		yes: 'Crowd questions and this-or-that prompts: "What would you rather have?", "What is one book that changed your life?", "Would you still post tomorrow?", "Agree?".',
		no: 'The post states, tells or shows something; or asks a real question the author needs answered, such as help with a specific problem; or a rhetorical question inside an argument; or a reaction, in the form of a question, to the post in `post.quotes`.'
	},
	{
		id: 'overpromises',
		name: 'overpromises',
		question: 'Is `post.text` written as a hook that promises more than the post itself gives?',
		yes: 'Curiosity gaps, superlatives and teasers: "this will change your life", "nobody talks about this", "number 7 will shock you", a list or secret announced but not delivered.',
		no: 'The post says what it has to say without dressing it up, or delivers what it announces.'
	},
	{
		id: 'attacks',
		name: 'attacks',
		question: 'Does `post.text` attack, insult, mock or show contempt for a person or a group?',
		yes: 'Name-calling, ridicule, sweeping blame of a group, or hostile sarcasm aimed at someone.',
		no: 'Disagreement or criticism of ideas or work without hostility towards people, or no target at all.'
	},
	{
		id: 'templated',
		name: 'templated',
		question:
			'Does `post.text` read as formulaic: built on a stock engagement template or generated rather than written by a person in their own voice?',
		yes: 'Stock structures such as one-line hook, numbered tips and a closing call to follow; generic motivational phrasing; text that could be posted by anyone about anything.',
		no: 'The wording is particular to this author and this occasion.'
	},
	{
		id: 'concrete',
		name: 'concrete',
		question:
			'Does `post.text` give concrete information: specific facts, figures, names, steps or details a reader could check or use?',
		yes: 'It carries specifics, such as numbers, what was done and what happened, or a precise claim.',
		no: 'It stays general: opinions, moods, slogans or vague statements with nothing specific in them.'
	},
	{
		id: 'firstHand',
		name: 'first-hand',
		question:
			'Is the author of `post.text` speaking from their own first-hand experience: something they did, built, saw or lived through?',
		yes: 'The author reports their own experience or work.',
		no: 'The author relays, comments on or speculates about things they were not part of, or says nothing about experience at all.'
	},
	{
		id: 'teaches',
		name: 'teaches',
		question:
			'Would a reader come away from `post.text` having learned something useful or non-obvious: an explanation, a lesson drawn from experience, a finding, a how-to or a well-argued point?',
		yes: 'There is substance to take away: the post explains, shows how, reports what was found or argues a point with reasons.',
		no: 'There is nothing to take away: a passing remark, a mood, a brag, a joke, a bare number or milestone, an announcement, or a question.'
	},
	{
		id: 'careful',
		name: 'careful',
		question:
			'Is `post.text` carefully written: clear, coherent and considered, whatever its length?',
		yes: 'The ideas follow, the wording is precise and the author has plainly thought about what they are saying.',
		no: 'Dashed off, rambling, shouted, or careless about what it claims.'
	}
];
