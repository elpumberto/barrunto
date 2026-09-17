// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/** The borders between pieces are kept by lint rules. This is the check that the rules still bite. */
const eslint = new ESLint();
const crossings = async (file: string, code: string) => {
	const [result] = await eslint.lintText(code, { filePath: file });
	return result!.messages.filter((m) =>
		['no-restricted-imports', 'no-restricted-globals'].includes(m.ruleId ?? '')
	).length;
};

describe('the borders between pieces', () => {
	it.each([
		['src/engine/x.ts', "import { browser } from 'wxt/browser';"],
		['src/engine/x.ts', "import { rules } from '@/packs/x/rules';"],
		['src/engine/x.ts', 'export const id = chrome.runtime.id;'],
		['src/packs/x/rules/x.ts', "import { readPost } from '../page';"],
		['src/packs/x/page/x.ts', "import { send } from '@/messages';"],
		['src/jev/x.ts', "import { apiKey } from '@/storage';"],
		['src/storage/x.ts', "import { jev } from '../jev';"],
		['src/entrypoints/page.content/x.ts', "import type { Jev } from '@/jev/types';"],
		['src/entrypoints/page.content/x.ts', "import { analyze } from '../background/analyze';"],
		['src/entrypoints/page.content/x.ts', "import { settings } from '@/storage';"],
		['src/entrypoints/background/x.ts', "import { readPost } from '@/packs/x/page';"],
		['src/entrypoints/popup/x.ts', "import { page } from '@/packs/x/page';"],
		['src/entrypoints/options/x.ts', "import { pages } from '@/packs/pages';"],
		['src/entrypoints/options/x.ts', "import { send } from '@/messages';"],
		['src/ui/x.ts', "import { settings } from '@/storage';"],
		['src/ui/x.ts', "import { browser } from 'wxt/browser';"],
		['src/packs/hn/rules/x.ts', "import { readComment } from '../page/read';"],
		['src/packs/hn/x.ts', "import { page } from './page';"],
		['src/packs/hn/page/x.ts', "import { apiKey } from '@/storage';"],
		['src/entrypoints/popup/x.ts', "import { paintLabels } from '../page.content/paint';"]
	])('%s may not: %s', async (file, code) => expect(await crossings(file, code)).toBe(1));

	it.each([
		['src/packs/x/rules/x.ts', "import type { Trait } from '@/engine';"],
		['src/entrypoints/background/x.ts', "import { packById } from '@/packs';"],
		['src/entrypoints/page.content/x.ts', "import { pages } from '@/packs/pages';"],
		['src/entrypoints/popup/x.ts', "import { packs } from '@/packs';"],
		['src/entrypoints/options/x.ts', "import { packControls } from '@/ui/pack-controls';"],
		['src/ui/x.ts', "import type { Settings } from '@/storage/types';"],
		['src/packs/hn/page/x.ts', "import { FADE } from '../controls';"],
		['src/entrypoints/popup/x.ts', "import type { Settings } from '@/storage/types';"],
		['src/entrypoints/page.content/x.ts', "import { send } from '@/messages';"],
		['src/entrypoints/page.content/x.ts', "import { connection } from '@/storage/session';"]
	])('%s may: %s', async (file, code) => expect(await crossings(file, code)).toBe(0));
});
