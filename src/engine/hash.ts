/** A short, stable number for a text (FNV-1a, 32 bits). Not for secrets: for telling texts apart. */
export function fnv1a(text: string): number {
	let hash = 2166136261;
	for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
	return hash >>> 0;
}
