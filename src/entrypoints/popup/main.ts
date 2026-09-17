import { send } from '@/messages';
import { apiKey, connection, sessionCounters, settings, totalCounters } from '@/storage';
import type { PopupActions, PopupState } from './view';
import { closedForm, renderPopup, tailOf } from './view';

const root = document.getElementById('popup')!;

let state: PopupState = {
	connection: await connection.getValue(),
	settings: await settings.getValue(),
	session: await sessionCounters.getValue(),
	total: await totalCounters.getValue(),
	keyTail: tailOf(await apiKey.getValue()),
	form: closedForm
};

function set(next: Partial<PopupState>) {
	state = { ...state, ...next };
	renderPopup(root, state, actions);
}

const actions: PopupActions = {
	async connect(candidate) {
		set({ form: { ...state.form, checking: true, failure: null, typed: candidate } });
		// A background that fails to answer leaves nothing to say but that the service is failing.
		const check = (await send({ type: 'checkKey', apiKey: candidate }).catch(() => undefined)) ?? {
			ok: false as const,
			failure: 'serviceDown' as const
		};
		set({
			form: check.ok ? closedForm : { ...state.form, checking: false, failure: check.failure }
		});
	},
	typed: (text) => {
		state = { ...state, form: { ...state.form, typed: text } };
	},
	changeKey: () => set({ form: { ...closedForm, open: true } }),
	cancelKey: () => set({ form: closedForm }),
	removeKey: () => void send({ type: 'forgetKey' }),
	setPaused: (paused) => void settings.setValue({ ...state.settings, paused }),
	setSensitivity: (sensitivity) => void settings.setValue({ ...state.settings, sensitivity }),
	setTuning: (tuning) => void settings.setValue({ ...state.settings, tuning }),
	resetCounters: () => void send({ type: 'resetCounters' })
};

// Whatever is stored and shown here reaches the popup the same way it reaches everyone else.
connection.watch((next) => set({ connection: next }));
settings.watch((next) => set({ settings: next }));
sessionCounters.watch((next) => set({ session: next }));
totalCounters.watch((next) => set({ total: next }));
apiKey.watch((next) => set({ keyTail: tailOf(next) }));

set({});
