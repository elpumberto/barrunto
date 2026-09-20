import { describe, expect, it } from 'vitest';
import { profileAt } from './address';

describe('profileAt', () => {
	it('takes a profile and its tabs for the same account, whatever the case of its handle', () => {
		for (const path of [
			'/Ada_Nobody',
			'/ada_nobody/',
			'/ada_nobody/with_replies',
			'/ada_nobody/media?lang=en',
			'/ada_nobody/reposts#top',
			'/ada_nobody/photo'
		]) {
			expect(profileAt(`https://x.com${path}`), path).toBe('ada_nobody');
		}
	});

	it("takes X.com's own sections for no account", () => {
		for (const path of [
			'/',
			'/home',
			'/explore',
			'/notifications',
			'/messages',
			'/i/bookmarks',
			'/settings/profile',
			'/search?q=ada_nobody',
			'/compose/post'
		]) {
			expect(profileAt(`https://x.com${path}`), path).toBeNull();
		}
	});

	it('takes what hangs from an account and is not its profile for none', () => {
		for (const path of [
			'/ada_nobody/status/1234567890',
			'/ada_nobody/following',
			'/ada_nobody/verified_followers',
			'/ada_nobody/lists',
			'/ada_nobody/media/more'
		]) {
			expect(profileAt(`https://x.com${path}`), path).toBeNull();
		}
	});

	it('takes what cannot be a handle for none', () => {
		expect(profileAt('https://x.com/a-b')).toBeNull();
		expect(profileAt('https://x.com/much_too_long_a_handle')).toBeNull();
		expect(profileAt('not an address')).toBeNull();
	});
});
