import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { listen } from '@/messages';
import { apiKey, connection, pageSettings, resetCounters, settings } from '@/storage';
import { analyze } from './analyze';
import { checkKey } from './check-key';
import { keepIconCurrent } from './icon';

export default defineBackground(() => {
	// Chrome starts the background only for something it listens to. Without this, reopening the
	// browser would wake nobody, and the session would begin without its connection status.
	browser.runtime.onStartup.addListener(() => {});

	listen({
		analyzePost: ({ post }) => analyze(post),
		checkKey: ({ apiKey: candidate }) => checkKey(candidate),
		forgetKey: async () => {
			await apiKey.removeValue();
			await connection.setValue({ state: 'noKey' });
		},
		resetCounters
	});

	settings.watch((next) => void pageSettings.setValue(next));
	keepIconCurrent();
	void startSession();
});

/** What has to be in place each time the background starts, which is at least once per session. */
async function startSession() {
	// The key is in local storage, so the X.com page's content script is shut out of it. Session
	// storage is opened to it instead: that is where it finds the status and its copy of the settings.
	await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
	await browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
	await pageSettings.setValue(await settings.getValue());

	// A new session knows nothing of the connection: a stored key is taken as good until Jev says otherwise.
	const [stored, status] = await Promise.all([apiKey.getValue(), connection.getValue()]);
	if (stored && status.state === 'noKey') await connection.setValue({ state: 'connected' });
}
