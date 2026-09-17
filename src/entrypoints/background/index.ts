import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { listen } from '@/messages';
import { pack as x } from '@/packs/x';
import { apiKey, changePack, connection, pageSettings, resetCounters, settings } from '@/storage';
import { analyze } from './analyze';
import { checkKey } from './check-key';
import { keepIconCurrent } from './icon';
import { keepPacksCurrent, reachOpenTabs } from './packs';

export default defineBackground(() => {
	// Chrome starts the background only for something it listens to. Without this, reopening the
	// browser would wake nobody, and the session would begin without its connection status.
	browser.runtime.onStartup.addListener(() => {});
	// Barrunto 1 read X.com from the start, with no pack to turn on. Whoever comes from it wants X
	// on, whether or not they ever changed a setting. Chrome's leave for the site is not carried
	// over, and cannot be asked for from here: the icon and the popup say that it is missing.
	browser.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
		if (reason === 'update' && previousVersion?.startsWith('1.')) {
			void changePack(x, () => ({ enabled: true }));
		}
		if (reason === 'update') void reachOpenTabs();
	});

	listen({
		analyze: ({ packId, item, urgent }, from) => analyze(packId, item, from, urgent),
		checkKey: ({ apiKey: candidate }) => checkKey(candidate),
		forgetKey: async () => {
			await apiKey.removeValue();
			await connection.setValue({ state: 'noKey' });
		},
		resetCounters
	});

	settings.watch((next) => void pageSettings.setValue(next));
	keepIconCurrent();
	keepPacksCurrent();
	void startSession().catch((error) =>
		console.error('[barrunto] could not start the session', error)
	);
});

/** What has to be in place each time the background starts, which is at least once per session. */
async function startSession() {
	const tried = (what: string) => (error: unknown) =>
		console.error(`[barrunto] could not ${what}`, error);
	// The key is in local storage, so the content script inside a page is shut out of it. Session
	// storage is opened to it instead, once its copy of the settings is there to be found: that is
	// where it finds them and the status. One of these failing does not keep the others from being tried.
	await browser.storage.local
		.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
		.catch(tried('close local storage to pages'));
	await settings
		.getValue()
		.then((stored) => pageSettings.setValue(stored))
		.catch(tried('copy the settings for pages'));
	await browser.storage.session
		.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
		.catch(tried('open session storage to pages'));

	// A new session knows nothing of the connection: a stored key is taken as good until Jev says otherwise.
	const [stored, status] = await Promise.all([apiKey.getValue(), connection.getValue()]);
	if (stored && status.state === 'noKey') await connection.setValue({ state: 'connected' });
}
