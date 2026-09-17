import { browser } from 'wxt/browser';
import { packById, packs } from '@/packs';
import { changePack, connection, settings } from '@/storage';
import '@/ui/style.css';
import './style.css';
import type { OptionsActions, OptionsState } from './view';
import { renderOptions } from './view';

const root = document.getElementById('options')!;

let state: OptionsState = {
	packs,
	settings: await settings.getValue(),
	connection: await connection.getValue(),
	refused: null
};

function set(next: Partial<OptionsState>) {
	state = { ...state, ...next };
	renderOptions(root, state, actions);
}

const actions: OptionsActions = {
	async setEnabled(packId, on) {
		const pack = packById(packId);
		if (!pack) return;
		// Chrome takes a request for leave only straight from the user's click: nothing may be awaited before it.
		const granted = on && (await browser.permissions.request({ origins: pack.sites }));
		set({ refused: on && !granted ? packId : null });
		if (on && !granted) return;
		await changePack(pack, () => ({ enabled: on }));
		// A pack that is off keeps no leave over its site. The background takes its script off the site by itself.
		// Leave that cannot be given back (the stand-in build holds it for good) does no harm.
		if (!on) await browser.permissions.remove({ origins: pack.sites }).catch(() => {});
	},
	setSensitivity: (packId, sensitivity) => {
		const pack = packById(packId);
		if (pack) void changePack(pack, () => ({ sensitivity }));
	},
	setOption: (packId, controlId, on) => {
		const pack = packById(packId);
		if (pack)
			void changePack(pack, ({ options }) => ({ options: { ...options, [controlId]: on } }));
	}
};

settings.watch((next) => set({ settings: next }));
connection.watch((next) => set({ connection: next }));

set({});
