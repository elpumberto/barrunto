import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { version } from '../package.json';

// A release takes its notes from the changelog's section for its version, and fails without one:
// better to hear of it here than from a tag already pushed.
describe('the changelog', () => {
	it('has a section for the version the extension says it is, the first of them', () => {
		const sections = readFileSync('CHANGELOG.md', 'utf8').match(/^## .+$/gm) ?? [];
		expect(sections[0]).toBe(`## ${version}`);
	});
});
