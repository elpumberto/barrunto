// Cuts the PNGs Chrome asks for from src/assets/icon.svg: in colour, and in grey for when Barrunto is stopped.
import { Buffer } from 'node:buffer';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const SIZES = [16, 32, 48, 128];
const INDIGO = '#3D46A8';
const GREY = '#8A8D98';

const source = await readFile('src/assets/icon.svg', 'utf8');
if (!source.includes(INDIGO)) throw new Error(`The icon's tile is no longer ${INDIGO}`);

await mkdir('public/icon', { recursive: true });
for (const [suffix, svg] of [
	['', source],
	['-grey', source.replace(INDIGO, GREY)]
]) {
	for (const size of SIZES) {
		await sharp(Buffer.from(svg), { density: ((72 * size) / 128) * 4 })
			.resize(size, size)
			.png()
			.toFile(`public/icon/${size}${suffix}.png`);
	}
}
