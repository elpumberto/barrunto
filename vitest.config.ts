import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
	// Brings WXT's aliases and a fake browser in place of Chrome's extension APIs.
	plugins: [WxtVitest()],
	test: { environment: 'happy-dom', include: ['src/**/*.test.ts'], mockReset: true }
});
