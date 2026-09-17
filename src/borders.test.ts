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
		['src/entrypoints/x.content/x.ts', "import type { Jev } from '@/jev/types';"],
		['src/entrypoints/x.content/x.ts', "import { analyze } from '../background/analyze';"],
		['src/entrypoints/x.content/x.ts', "import { settings } from '@/storage';"],
		['src/entrypoints/background/x.ts', "import { readPost } from '@/packs/x/page';"],
		['src/entrypoints/popup/x.ts', "import { labelsFor } from '@/engine';"],
		['src/entrypoints/popup/x.ts', "import { paintLabels } from '../x.content/paint';"]
	])('%s may not: %s', async (file, code) => expect(await crossings(file, code)).toBe(1));

	it.each([
		['src/packs/x/rules/x.ts', "import type { Trait } from '@/engine';"],
		['src/entrypoints/background/x.ts', "import { rules } from '@/packs/x/rules';"],
		['src/entrypoints/popup/x.ts', "import type { Settings } from '@/storage/types';"],
		['src/entrypoints/x.content/x.ts', "import { send } from '@/messages';"],
		['src/entrypoints/x.content/x.ts', "import { connection } from '@/storage/session';"]
	])('%s may: %s', async (file, code) => expect(await crossings(file, code)).toBe(0));
});
