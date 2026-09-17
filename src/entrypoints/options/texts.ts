export const texts = {
	title: 'Rule packs',
	intro:
		'A rule pack is everything Barrunto knows about one site: how to read it, what to ask Jev about what it reads, and which labels come of it. Barrunto acts only where a pack is on, and asks Chrome for your leave for that site when you turn it on.',
	noKey:
		'Barrunto has no TypeSafe key yet, so it reads nothing. Click its icon in the toolbar to paste one.',
	actsOn: 'Acts on',
	labels: 'Its labels',
	on: (name: string) => `${name} on`,
	refused: 'Chrome did not give Barrunto leave to act on that site, so the pack stays off.',
	reload: 'Pages that were already open pick up a change of pack when they are reloaded.'
};
