import { jev, JevError } from '@/jev';
import type { KeyCheck } from '@/messages';
import { apiKey, connection } from '@/storage';

/** Tries the key against Jev. If it is good, it becomes the key and the connection is healthy. */
export async function checkKey(candidate: string): Promise<KeyCheck> {
	try {
		await jev.checkKey(candidate);
	} catch (error) {
		const failure = error instanceof JevError ? error.failure : 'serviceDown';
		// The popup has three things to say about a key that did not pass; the rest read as the service failing.
		if (failure === 'keyRejected' || failure === 'noNetwork') return { ok: false, failure };
		return { ok: false, failure: 'serviceDown' };
	}
	await apiKey.setValue(candidate);
	await connection.setValue({ state: 'connected' });
	return { ok: true };
}
