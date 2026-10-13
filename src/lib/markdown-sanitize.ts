import DOMPurify from "isomorphic-dompurify";
import { isSafeImageSrc } from "./safe-url";

// a callout needs layout, never positioning, stacking or remote loads
const STYLE_PROPERTY_DENY =
	/^(?:position|top|left|right|bottom|inset(?:-[a-z]+)*|z-index|transform|translate|float)$/i;
const STYLE_VALUE_DENY = /url\(|image-set\(|expression\(|@import|javascript:/i;

let currentSlug = "";

function safeStyle(style: string): string {
	return style
		.split(";")
		.map((declaration) => declaration.trim())
		.filter((declaration) => {
			const colon = declaration.indexOf(":");
			if (colon === -1) return false;
			const property = declaration.slice(0, colon).trim();
			return (
				!STYLE_PROPERTY_DENY.test(property) &&
				!STYLE_VALUE_DENY.test(declaration)
			);
		})
		.join(";");
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "IMG") {
		const src = node.getAttribute("src");
		if (src === null || !isSafeImageSrc(src, currentSlug))
			node.removeAttribute("src");
	}
	// only a checkbox is a harmless input; an image input loads its src
	if (node.tagName === "INPUT" && node.getAttribute("type") !== "checkbox") {
		node.parentNode?.removeChild(node);
	}
	if (node.hasAttribute("style")) {
		const style = safeStyle(node.getAttribute("style") ?? "");
		if (style) node.setAttribute("style", style);
		else node.removeAttribute("style");
	}
});

export function sanitizeMarkdownHtml(
	html: string,
	serviceSlug: string,
): string {
	currentSlug = serviceSlug;
	try {
		return DOMPurify.sanitize(html, {
			ADD_TAGS: ["input"],
			ADD_ATTR: ["checked", "disabled", "type"],
			FORBID_TAGS: [
				"form",
				"button",
				"select",
				"option",
				"textarea",
				"iframe",
				"frame",
				"frameset",
				"object",
				"embed",
				"style",
				"link",
				"meta",
				"base",
				"video",
				"audio",
				"source",
				"track",
				"picture",
				"svg",
				"math",
			],
			FORBID_ATTR: [
				"srcset",
				"formaction",
				"form",
				"action",
				"autofocus",
				"poster",
				"background",
			],
		});
	} finally {
		currentSlug = "";
	}
}
