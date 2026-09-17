import { browser } from 'wxt/browser';
import { MatchPattern } from 'wxt/utils/match-patterns';
import type { Pack } from '@/engine';
import { send } from '@/messages';
import { packById, packs } from '@/packs';
import {
	apiKey,
	changePack,
	connection,
	sessionCounters,
	settings,
	totalCounters
} from '@/storage';
import './style.css';
import type { PopupActions, PopupState } from './view';
import { closedForm, renderPopup, tailOf } from './view';

const root = document.getElementById('popup')!;

/** The pack of the page the popup was opened over. Opening the popup is what lets Barrunto see that page's address. */
async function packOfThisTab(): Promise<Pack | null> {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	const address = tab?.url;
	if (!address) return null;
	return (
		packs.find(({ sites }) => sites.some((site) => new MatchPattern(site).includes(address))) ??
		null
	);
}

let state: PopupState = {
	connection: await connection.getValue(),
	settings: await settings.getValue(),
	packs,
	pack: await packOfThisTab(),
	view: 'home',
	about: null,
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
	setSensitivity: (packId, sensitivity) => {
		const pack = packById(packId);
		if (pack) void changePack(pack, () => ({ sensitivity }));
	},
	setOption: (packId, controlId, on) => {
		const pack = packById(packId);
		if (pack)
			void changePack(pack, ({ options }) => ({ options: { ...options, [controlId]: on } }));
	},
	setTuning: (tuning) => void settings.setValue({ ...state.settings, tuning }),
	setLookAhead: (lookAhead) => void settings.setValue({ ...state.settings, lookAhead }),
	resetCounters: () => void send({ type: 'resetCounters' }),
	go: (view) => set({ view }),
	showAbout: (packId) => set({ about: state.about === packId ? null : packId }),
	async setEnabled(packId, on) {
		const pack = packById(packId);
		if (!pack) return;
		if (!on) {
			await changePack(pack, () => ({ enabled: false }));
			// A pack that is off keeps no leave over its site. Leave that cannot be given back (the
			// stand-in build holds it for good) does no harm.
			await browser.permissions.remove({ origins: pack.sites }).catch(() => {});
			return;
		}
		// Chrome takes a request for leave only straight from the user's click, and its question may
		// close the popup before it is answered: the background turns the pack on when leave arrives.
		// Leave already held raises no question, and then turning the pack on is for here.
		if (await browser.permissions.request({ origins: pack.sites })) {
			await changePack(pack, () => ({ enabled: true }));
		}
	}
};

// Whatever is stored and shown here reaches the popup the same way it reaches everyone else.
connection.watch((next) => set({ connection: next }));
settings.watch((next) => set({ settings: next }));
sessionCounters.watch((next) => set({ session: next }));
totalCounters.watch((next) => set({ total: next }));
apiKey.watch((next) => set({ keyTail: tailOf(next) }));

set({});
