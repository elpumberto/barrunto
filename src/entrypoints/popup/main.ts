import { browser } from 'wxt/browser';
import { MatchPattern } from 'wxt/utils/match-patterns';
import type { Pack } from '@/engine';
import { send } from '@/messages';
import { packById, packs } from '@/packs';
import {
	apiKey,
	changePack,
	changeSettings,
	connection,
	sessionCounters,
	settings,
	totalCounters
} from '@/storage';
import './style.css';
import type { PopupActions, PopupState } from './view';
import { closedForm, renderPopup, tailOf } from './view';

const root = document.getElementById('popup')!;

/** For each pack, whether Chrome holds the user's leave for its sites. */
async function leaveHeld(): Promise<Record<string, boolean>> {
	const held = await Promise.all(
		packs.map((pack) => browser.permissions.contains({ origins: pack.sites }))
	);
	return Object.fromEntries(packs.map((pack, i) => [pack.id, held[i]!]));
}

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

// Everything it shows is read at once, not one thing after another: the popup is blank until then.
const [connected, stored, pack, leave, session, total, key] = await Promise.all([
	connection.getValue(),
	settings.getValue(),
	packOfThisTab(),
	leaveHeld(),
	sessionCounters.getValue(),
	totalCounters.getValue(),
	apiKey.getValue()
]);

let state: PopupState = {
	connection: connected,
	settings: stored,
	packs,
	pack,
	leave,
	view: 'home',
	about: null,
	session,
	total,
	keyTail: tailOf(key),
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
	// From what is stored now, not from what the popup last saw: two switches moved one after the
	// other, or the background turning a pack on meanwhile, would otherwise undo each other.
	setPaused: (paused) => void changeSettings({ paused }),
	setSensitivity: (packId, sensitivity) => {
		const pack = packById(packId);
		if (pack) void changePack(pack, () => ({ sensitivity }));
	},
	setTreatment: (packId, judgmentId, treatment) => {
		const pack = packById(packId);
		if (!pack) return;
		void changePack(pack, ({ treatments }) => ({
			treatments: { ...treatments, [judgmentId]: treatment }
		}));
	},

	setTuning: (tuning) => void changeSettings({ tuning }),
	setLookAhead: (lookAhead) => void changeSettings({ lookAhead }),
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
		// Chrome may also refuse to ask at all; either way the pack stays off, and the switch shows it.
		if (await browser.permissions.request({ origins: pack.sites }).catch(() => false)) {
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
const leaveChanged = () => void leaveHeld().then((leave) => set({ leave }));
browser.permissions.onAdded.addListener(leaveChanged);
browser.permissions.onRemoved.addListener(leaveChanged);

set({});
