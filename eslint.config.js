import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

// Who may use whom (see "How the code is organised" in the README). Each piece lists what it may not import.
const chrome = { group: ['wxt', 'wxt/*', '#imports'], message: 'This piece does not know Chrome.' };
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
const ui = piece('ui', 'ui');
/** Local storage is closed to the pages Barrunto acts on: its content script takes the session half and the types alone. */
const closedStorage = {
	group: ['@/storage/*', '!@/storage/session', '!@/storage/types'],
	message: 'The content script may use only @/storage/session and @/storage/types.'
};
const wholeStorage = {
	name: '@/storage',
	message: 'This piece may not use the whole of @/storage.'
};
/** Drawing needs no Chrome: what draws takes the types of what is stored, and nothing else of it. */
const storageButTypes = {
	group: ['@/storage/*', '!@/storage/types'],
	message: 'This piece may use only the types of @/storage.'
};
const entrypoints = piece('entrypoints', 'entrypoints');
const content = piece('entrypoints/page.content', 'page.content');
const background = piece('entrypoints/background', 'background');
const popup = piece('entrypoints/popup', 'popup');
const options = piece('entrypoints/options', 'options');

const borders = {
	'src/engine/**': [chrome, packs, jev, storage, messages, ui, entrypoints],
	'src/packs/*/rules/**': [chrome, pages, jev, storage, messages, ui, entrypoints],
	'src/packs/*/page/**': [chrome, jev, storage, messages, ui, entrypoints],
	'src/packs/*/*.ts': [chrome, pages, jev, storage, messages, ui, entrypoints],
	'src/packs/*.ts': [chrome, jev, storage, messages, ui, entrypoints],
	'src/jev/**': [packs, storage, messages, ui, entrypoints],
	'src/storage/**': [packs, jev, messages, ui, entrypoints],
	'src/messages.ts': [packs, jev, ui, entrypoints],
	'src/ui/**': [chrome, pages, jev, storageButTypes, messages, entrypoints],
	'src/entrypoints/page.content/**': [jev, closedStorage, ui, background, popup, options],
	'src/entrypoints/background/**': [pages, ui, content, popup, options],
	'src/entrypoints/popup/**': [jev, pages, content, background, options],
	'src/entrypoints/options/**': [jev, pages, messages, content, background, popup]
};
const knowNoChrome = ['src/engine/**', 'src/packs/**'];

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
			'no-restricted-imports': [
				'error',
				{
					patterns,
					paths: patterns.some((p) => p === closedStorage || p === storageButTypes)
						? [wholeStorage]
						: []
				}
			]
		}
	})),
	{
		files: knowNoChrome,
		rules: { 'no-restricted-globals': ['error', 'chrome', 'browser'] }
	}
);
