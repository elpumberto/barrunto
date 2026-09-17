import type { KeyFailure } from '@/messages';
import type { Sensitivity, Treatment } from '@/engine';
import type { Trouble } from '@/storage/types';

const meanwhile =
	'Nothing gets a label meanwhile; Barrunto tries again with the next thing it reads.';

export const texts = {
	status: {
		noKey: 'No key',
		checking: 'Checking…',
		connected: 'Connected',
		paused: 'Paused',
		keyRejected: 'Key rejected',
		trouble: 'Trouble'
	},
	key: {
		title: 'Key',
		label: 'Your TypeSafe key',
		placeholder: 'Paste it here',
		connect: 'Connect',
		checking: 'Asking Jev…',
		promise:
			'The key stays in this browser and goes nowhere but api.typesafe.ai. Until it works, Barrunto reads nothing.',
		cancel: 'Keep the current key',
		change: 'Change',
		remove: 'Remove',
		failure: {
			keyRejected: 'TypeSafe rejected this key. Check it was copied whole, or create a new one.',
			noNetwork: 'Could not reach TypeSafe. Check your connection and try again.',
			serviceDown: 'TypeSafe is not answering right now. Try again in a moment.'
		} satisfies Record<KeyFailure, string>
	},
	/** The names of the two blocks; the first takes the name of the pack of the page, when there is one. */
	analysis: 'Analysis',
	api: 'Jev API',
	/** What the switch at the top is called. */
	reading: 'Reading',
	packs: {
		open: 'Rule packs',
		back: 'Back',
		/** What a pack's switch is called: the pack. That it is on or off, the switch says itself. */
		on: (name: string) => name,
		noneOn: 'No rule pack is on, so Barrunto reads nothing. Turn one on in Rule packs.',
		notHere: 'There is no rule pack for this page.',
		off: { title: 'This pack is off', help: 'Turn it on and Barrunto reads this site.' },
		noLeave: {
			title: 'This pack needs your leave',
			help: 'Chrome no longer lets Barrunto read this site. Turn the pack on again.'
		},
		leave:
			'Barrunto reads a site only while its pack is on. Chrome asks your leave when you turn one on.'
	},
	sensitivity: {
		title: 'Sensitivity',
		stops: { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' } satisfies Record<
			Sensitivity,
			string
		>,
		help: {
			low: 'Only the clear cases. Few labels, few misses.',
			medium: 'A balance.',
			high: 'Labels more, and gets more wrong.',
			ultra: 'Labels at the faintest hunch. Many misses.'
		} satisfies Record<Sensitivity, string>
	},
	counters: {
		title: 'Usage',
		brief: (items: string, tokens: string) => `${items} analyzed · ${tokens} tokens`,
		session: 'This session',
		total: 'Total',
		items: 'Analyzed',
		tokensIn: 'Tokens in',
		tokensOut: 'Tokens out',
		reset: 'Reset'
	},
	noise: {
		title: 'Noise',
		treatments: { label: 'Label', fade: 'Fade', hide: 'Hide' } satisfies Record<Treatment, string>,
		brief: (faded: number, hidden: number) =>
			[faded && `${faded} faded`, hidden && `${hidden} hidden`].filter(Boolean).join(' · ') ||
			'only labelled'
	},
	ahead: {
		title: 'Read ahead',
		help: 'Items read before you get to them.',
		none: 'With 0, Barrunto asks only about what stays on screen for a moment.'
	},
	tuning: {
		title: 'Tuning mode',
		help: "Shows Jev's answers on the page."
	},
	/** One line each: the band is up exactly when there is least room for it. What happens meanwhile is said on hover. */
	trouble: {
		meanwhile,
		tooManyCalls: 'Jev is asking Barrunto to slow down.',
		serviceDown: 'Jev is not answering.',
		noNetwork: 'No connection.'
	} satisfies Record<Trouble | 'meanwhile', string>
};
