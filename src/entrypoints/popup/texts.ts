import type { KeyFailure } from '@/messages';
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
		on: { title: 'Reading', help: 'Asks Jev once about each thing it reads.' },
		off: { title: 'Paused', help: 'Reads nothing, asks nothing. Labels already up stay.' }
	},
	packs: {
		open: 'Rule packs',
		noneOn: 'No rule pack is on, so Barrunto reads nothing. Choose where it should act.',
		notHere: 'No rule pack is on for this page.'
	},
	counters: {
		session: 'This session',
		total: 'Total',
		items: 'Analyzed',
		tokensIn: 'Tokens in',
		tokensOut: 'Tokens out',
		reset: 'Reset counters'
	},
	tuning: {
		title: 'Tuning mode',
		help: 'Shows trait answers and strengths under each thing it reads.'
	},
	trouble: {
		tooManyCalls: `Jev is asking Barrunto to slow down. ${meanwhile}`,
		serviceDown: `Jev is not answering (service down). ${meanwhile}`,
		noNetwork: `No connection. ${meanwhile}`
	} satisfies Record<Trouble, string>
};
