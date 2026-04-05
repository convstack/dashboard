import { marked } from "marked";

/**
 * Preprocess markdown to fix task list items without trailing text.
 * marked requires text after [x]/[ ] to recognize them as checkboxes.
 * This adds a zero-width space so they render correctly.
 */
export function preprocessMarkdown(md: string): string {
	return md.replace(/^(\s*[-*+]\s+\[[ xX]\])$/gm, "$1\u200B");
}

export { marked };
