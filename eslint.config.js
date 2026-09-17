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
const page = piece('packs/x/page', 'page');
const jev = piece('jev', 'jev');
const storage = piece('storage', 'storage');
const messages = piece('messages', 'messages');
const engine = piece('engine', 'engine');
/** Local storage is closed to the X.com page: its content script takes the session half and the types alone. */
const closedStorage = {
	group: ['@/storage/*', '!@/storage/session', '!@/storage/types'],
	message: 'The content script may use only @/storage/session and @/storage/types.'
};
const wholeStorage = { name: '@/storage', message: closedStorage.message };
const entrypoints = piece('entrypoints', 'entrypoints');
const content = piece('entrypoints/x.content', 'x.content');
const background = piece('entrypoints/background', 'background');
const popup = piece('entrypoints/popup', 'popup');

const borders = {
	'src/engine/**': [chrome, packs, jev, storage, messages, entrypoints],
	'src/packs/x/rules/**': [chrome, page, jev, storage, messages, entrypoints],
	'src/packs/x/page/**': [chrome, jev, storage, messages, entrypoints],
	'src/jev/**': [packs, storage, messages, entrypoints],
	'src/storage/**': [packs, jev, messages, entrypoints],
	'src/messages.ts': [packs, jev, entrypoints],
	'src/entrypoints/x.content/**': [jev, closedStorage, background, popup],
	'src/entrypoints/background/**': [page, content, popup],
	'src/entrypoints/popup/**': [jev, engine, packs, content, background]
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
				{ patterns, paths: patterns.includes(closedStorage) ? [wholeStorage] : [] }
			]
		}
	})),
	{
		files: knowNoChrome,
		rules: { 'no-restricted-globals': ['error', 'chrome', 'browser'] }
	}
);
