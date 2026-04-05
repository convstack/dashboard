import { marked } from "marked";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-");
}

const renderer: marked.RendererObject = {
	heading({ text, depth }) {
		const id = slugify(text);
		return `<h${depth} id="${id}">${text}</h${depth}>\n`;
	},
};

marked.use({ renderer });

/**
 * Preprocess markdown to fix task list items without trailing text.
 * marked requires text after [x]/[ ] to recognize them as checkboxes.
 * This adds a zero-width space so they render correctly.
 */
export function preprocessMarkdown(md: string): string {
	return md.replace(/^(\s*[-*+]\s+\[[ xX]\])$/gm, "$1\u200B");
}

export { marked };
