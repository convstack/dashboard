import { describe, expect, it } from "vitest";
import { mockStyle, previewBody, previewLogo, safeHex } from "./theme-preview";

describe("safeHex", () => {
	it.each(["#4f7bff", "#ABCDEF"])("keeps %s for the picker", (v) => {
		expect(safeHex(v, "#000000")).toBe(v.toLowerCase());
	});

	it.each(["", "#fff", "red", "#12345g"])("falls back for %j", (v) => {
		expect(safeHex(v, "#000000")).toBe("#000000");
	});
});

describe("previewBody", () => {
	it("sends only what the preview needs", () => {
		expect(
			previewBody({
				name: "FurCon",
				darkAccent: "#e11d48",
				heading: "x",
				logoUrl: "https://s/l.png",
			}),
		).toEqual({ darkAccent: "#e11d48" });
	});
});

describe("mockStyle", () => {
	it("keeps only custom properties with a colour value", () => {
		expect(
			mockStyle({
				"--bg": "#101820",
				"--evil": "url(x)",
				"--accent-glow": "rgba(1, 2, 3, 0.2)",
				color: "red",
			}),
		).toEqual({ "--bg": "#101820", "--accent-glow": "rgba(1, 2, 3, 0.2)" });
	});
});

describe("previewLogo", () => {
	const values = {
		logoUrl: "https://s.test/m.png",
		lightLogoUrl: "https://s.test/l.png",
	};

	it("shows the light logo on the light theme and the main one on dark", () => {
		expect(previewLogo(values, "dark")).toBe("https://s.test/m.png");
		expect(previewLogo(values, "light")).toBe("https://s.test/l.png");
	});

	it("falls back to the main logo when there is no light one", () => {
		expect(previewLogo({ logoUrl: "https://s.test/m.png" }, "light")).toBe(
			"https://s.test/m.png",
		);
		expect(
			previewLogo(
				{ logoUrl: "https://s.test/m.png", lightLogoUrl: "" },
				"light",
			),
		).toBe("https://s.test/m.png");
	});

	it("is nothing when there is no logo at all", () => {
		expect(previewLogo({}, "dark")).toBe("");
		expect(previewLogo({}, "light")).toBe("");
	});
});
