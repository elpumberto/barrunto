import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { jev, JevError } from '@/jev';
import { apiKey, connection } from '@/storage';
import { checkKey } from './check-key';

vi.mock('@/jev', async (original) => ({
	...(await original<typeof import('@/jev')>()),
	jev: { ask: vi.fn(), checkKey: vi.fn() }
}));

beforeEach(() => fakeBrowser.reset());

describe('checkKey', () => {
	it('keeps a good key and sets the connection healthy', async () => {
		vi.mocked(jev.checkKey).mockResolvedValue();
		expect(await checkKey('good')).toEqual({ ok: true });
		expect(await apiKey.getValue()).toBe('good');
		expect(await connection.getValue()).toEqual({ state: 'connected' });
	});

	it('does not keep a key that did not pass, and says why', async () => {
		vi.mocked(jev.checkKey).mockRejectedValue(new JevError('keyRejected'));
		expect(await checkKey('bad')).toEqual({ ok: false, failure: 'keyRejected' });
		expect(await apiKey.getValue()).toBeNull();
	});

	it('reads any other failure as the service failing', async () => {
		vi.mocked(jev.checkKey).mockRejectedValue(new JevError('tooManyCalls'));
		expect(await checkKey('k')).toEqual({ ok: false, failure: 'serviceDown' });
	});
});
