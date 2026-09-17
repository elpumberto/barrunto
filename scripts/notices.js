// Writes public/THIRD-PARTY-NOTICES.txt, which travels inside the built extension: the packages whose
// code ends up in it, each with its licence as its own files state it. Run it when one of them
// changes: `npm run notices`.
import { readdir, readFile, writeFile } from 'node:fs/promises';

/** What is bundled into the extension. Everything else in package.json only builds or tests it. */
const BUNDLED = [
	'@typesafe-ai/sdk',
	'wxt',
	'@wxt-dev/browser',
	'@wxt-dev/storage',
	'@webext-core/match-patterns'
];

const urlOf = (repository) =>
	(typeof repository === 'string' ? repository : (repository?.url ?? ''))
		.replace(/^git\+/, '')
		.replace(/\.git$/, '');
const nameOf = (author) => (typeof author === 'string' ? author : (author?.name ?? ''));

const notices = await Promise.all(
	BUNDLED.map(async (name) => {
		const folder = `node_modules/${name}`;
		const { version, license, author, repository, homepage } = JSON.parse(
			await readFile(`${folder}/package.json`, 'utf8')
		);
		const file = (await readdir(folder)).find((entry) => /^licen[cs]e/i.test(entry));
		const text = file ? (await readFile(`${folder}/${file}`, 'utf8')).trim() : null;
		return [
			`${name} ${version}`,
			`Licence: ${license}`,
			nameOf(author) ? `Author: ${nameOf(author)}` : null,
			`Source: ${urlOf(repository) || homepage}`,
			'',
			text ?? `This package ships no licence file of its own; its licence text is at its source.`
		]
			.filter((line) => line !== false && line !== undefined && line !== null)
			.join('\n');
	})
);

const rule = `\n\n${'-'.repeat(72)}\n\n`;
const head =
	'Barrunto is under the MIT licence (see LICENSE in its repository). Code of these packages is bundled in it:';
await writeFile('public/THIRD-PARTY-NOTICES.txt', `${head}${rule}${notices.join(rule)}\n`);
console.log(`public/THIRD-PARTY-NOTICES.txt: ${BUNDLED.length} packages`);
