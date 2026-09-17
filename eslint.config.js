import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

// Who may use whom (see "How the code is organised" in the README). Each piece lists what it may not import.
const chrome = {
	group: ['wxt', 'wxt/*', '@wxt-dev/*', '#imports'],
	message: 'This piece does not know Chrome.'
};
/** TypeSafe's SDK is for `src/jev` alone: every other piece lists it. */
const sdk = { group: ['@typesafe-ai/*'], message: 'Only src/jev knows the SDK.' };
const piece = (name, ...paths) => ({
	group: [`@/${name}`, `@/${name}/*`, ...paths.flatMap((path) => [`**/${path}`, `**/${path}/*`])],
	message: `This piece may not use ${name}.`
});
const packs = piece('packs', 'packs');
/** The half of each pack that reads the page, and the list of them: for the content script alone. */
const pages = {
	group: [
		'@/packs/*/page',
		'@/packs/*/page/*',
		'@/packs/pages',
		'**/page',
		'**/page/*',
		'**/pages'
	],
	message: 'Only the content script may use the half of a pack that reads the page.'
};
const jev = piece('jev', 'jev');
const storage = piece('storage', 'storage');
const messages = piece('messages', 'messages');
/** Local storage is closed to the pages Barrunto acts on: its content script takes the session half and the types alone. */
const closedStorage = {
	// However it is spelled: by its name or by a path that climbs to it, whole or any file of it but those two.
	regex: '^(@/|(\\.\\./)+)(.*/)?storage(/(?!(session|types)$).+)?$',
	message: 'The content script may use only @/storage/session and @/storage/types.'
};
const entrypoints = piece('entrypoints', 'entrypoints');
const content = piece('entrypoints/page.content', 'page.content');
const background = piece('entrypoints/background', 'background');
const popup = piece('entrypoints/popup', 'popup');

/** A pack keeps to itself: another pack is reached neither by its name nor by climbing out of one's own folder. */
const otherPacks = (climb) => ({
	group: ['@/packs', '@/packs/*', '@/packs/**', `${climb}/*`, `${climb}/**`],
	message: 'A pack may not use another pack, nor the lists of them.'
});

// Where two entries take in the same file, the later one is the one that holds.
const borders = {
	'src/engine/**': [chrome, sdk, packs, jev, storage, messages, entrypoints],
	// Whatever is in a pack, wherever in it; then its two known corners, which differ in one thing:
	// the half that reads the page is the only one that may be that half.
	'src/packs/*/**': [chrome, sdk, pages, jev, storage, messages, entrypoints, otherPacks('../..')],
	'src/packs/*/*.ts': [chrome, sdk, pages, jev, storage, messages, entrypoints, otherPacks('..')],
	'src/packs/*/page/**': [chrome, sdk, jev, storage, messages, entrypoints, otherPacks('../..')],
	'src/packs/index.ts': [chrome, sdk, pages, jev, storage, messages, entrypoints],
	'src/packs/pages.ts': [chrome, sdk, jev, storage, messages, entrypoints],
	'src/jev/**': [packs, storage, messages, entrypoints],
	'src/storage/**': [sdk, packs, jev, messages, entrypoints],
	'src/messages.ts': [sdk, packs, jev, entrypoints],
	'src/entrypoints/page.content/**': [sdk, jev, closedStorage, background, popup],
	'src/entrypoints/background/**': [sdk, pages, content, popup],
	'src/entrypoints/popup/**': [sdk, jev, pages, content, background]
};
const knowNoChrome = ['src/engine/**', 'src/packs/**'];
/** No page either: what is here runs in the background and in Barrunto's own pages as well. */
const knowNoPage = [
	'src/engine/**',
	'src/packs/*/rules/**',
	'src/packs/*/*.ts',
	'src/packs/index.ts'
];

export default ts.config(
	{ ignores: ['.output', '.wxt', 'node_modules'] },
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	// The scripts run in Node, and the page code inside the smoke test in a browser.
	{ files: ['scripts/**'], rules: { 'no-undef': 'off' } },
	...Object.entries(borders).map(([files, patterns]) => ({
		files: [files],
		rules: {
			'no-restricted-imports': ['error', { patterns }]
		}
	})),
	{
		files: knowNoChrome,
		rules: { 'no-restricted-globals': ['error', 'chrome', 'browser'] }
	},
	{
		files: knowNoPage,
		ignores: ['**/*.test.ts'],
		rules: { 'no-restricted-globals': ['error', 'chrome', 'browser', 'document', 'window'] }
	}
);
