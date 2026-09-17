import type { KeyFailure } from '@/messages';
import type { Sensitivity, Trouble } from '@/storage/types';

const meanwhile = 'Posts stay unlabelled meanwhile; Barrunto tries again with the next one.';

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
	reading: {
		on: { title: 'Reading posts on X.com', help: 'Asks Jev once per post.' },
		off: { title: 'Paused', help: 'Reads nothing, asks nothing. Labels already up stay.' }
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
			ultra: 'Labels at the faintest hunch. Expect plenty of misses.'
		} satisfies Record<Sensitivity, string>
	},
	counters: {
		session: 'This session',
		total: 'Total',
		posts: 'Posts analyzed',
		tokensIn: 'Tokens in',
		tokensOut: 'Tokens out',
		reset: 'Reset counters'
	},
	tuning: { title: 'Tuning mode', help: 'Shows trait answers and strengths under each post.' },
	trouble: {
		tooManyCalls: `Jev is asking Barrunto to slow down. ${meanwhile}`,
		serviceDown: `Jev is not answering (service down). ${meanwhile}`,
		noNetwork: `No connection. ${meanwhile}`
	} satisfies Record<Trouble, string>
};
