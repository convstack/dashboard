import { afterEach, describe, expect, it, vi } from "vitest";
import {
	__resetBranding,
	brandingCss,
	brandLogos,
	DEFAULT_VIEW,
	forgetBranding,
	getBranding,
	safeBrandImage,
} from "./branding";

const lanyardFetch = vi.fn();
vi.mock("./lanyard-client", () => ({
	lanyardFetch: (...args: unknown[]) => lanyardFetch(...args),
}));

const view = {
	name: "FurCon",
	logoUrl: null,
	lightLogoUrl: null,
	faviconUrl: null,
	dark: { "--bg": "#101820", "--accent-glow": "rgba(1, 2, 3, 0.24)" },
	light: null,
};

afterEach(() => {
	lanyardFetch.mockReset();
	vi.useRealTimers();
	__resetBranding();
});

describe("brandingCss", () => {
	it("is empty when nothing differs from the default", () => {
		expect(brandingCss(DEFAULT_VIEW)).toBe("");
	});

	it("scopes dark to :root and light to :root:not(.dark)", () => {
		const css = brandingCss({ ...view, light: { "--bg": "#fafafa" } });

		expect(css).toBe(
			":root{--bg:#101820;--accent-glow:rgba(1, 2, 3, 0.24);}:root:not(.dark){--bg:#fafafa;}",
		);
	});

	it("drops anything that is not a known token with a colour value", () => {
		const css = brandingCss({
			...view,
			dark: {
				"--bg": "#101820",
				"--evil": "#000000",
				"--fg": "url(x)",
				"--accent": "red;}body{",
			},
		});

		expect(css).toBe(":root{--bg:#101820;}");
	});
});

describe("safeBrandImage", () => {
	it.each([
		"https://s.test/branding/a.png",
		"http://127.0.0.1:9002/lanyard/branding/a.png",
	])("keeps %s", (url) => expect(safeBrandImage(url)).toBe(url));

	it.each([
		null,
		"",
		"javascript:alert(1)",
		"http://evil.test/a.png",
		"/branding/a.png",
	])("drops %j", (url) => expect(safeBrandImage(url)).toBeNull());
});

describe("getBranding", () => {
	it("asks lanyard once however many renders come in", async () => {
		lanyardFetch.mockImplementation(async () => Response.json(view));

		for (let i = 0; i < 20; i++) {
			expect((await getBranding()).name).toBe("FurCon");
		}

		expect(lanyardFetch).toHaveBeenCalledTimes(1);
	});

	it("asks again after a minute, or at once after forgetBranding", async () => {
		vi.useFakeTimers();
		lanyardFetch.mockImplementation(async () => Response.json(view));

		await getBranding();
		vi.advanceTimersByTime(61_000);
		await getBranding();
		expect(lanyardFetch).toHaveBeenCalledTimes(2);

		forgetBranding();
		await getBranding();
		expect(lanyardFetch).toHaveBeenCalledTimes(3);
	});

	it("shows the default look when lanyard fails, and tries again in five seconds", async () => {
		vi.useFakeTimers();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
		lanyardFetch.mockImplementation(async () => Response.json(view));

		expect(await getBranding()).toEqual(DEFAULT_VIEW);
		vi.advanceTimersByTime(6_000);
		expect((await getBranding()).name).toBe("FurCon");
	});

	it("does not trust an answer of the wrong shape", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockImplementation(async () => Response.json({ name: 5 }));

		expect(await getBranding()).toEqual(DEFAULT_VIEW);
	});
});

describe("the light logo", () => {
	it("is nothing by default", () => {
		expect(DEFAULT_VIEW.lightLogoUrl).toBeNull();
	});

	it("is read from lanyard, and a lanyard that does not send one means none", async () => {
		lanyardFetch.mockImplementation(async () =>
			Response.json({ ...view, lightLogoUrl: "https://s.test/branding/l.png" }),
		);
		expect((await getBranding()).lightLogoUrl).toBe(
			"https://s.test/branding/l.png",
		);

		__resetBranding();
		const { lightLogoUrl: _omitted, ...older } = view;
		lanyardFetch.mockImplementation(async () => Response.json(older));
		expect((await getBranding()).lightLogoUrl).toBeNull();
	});

	it("is offered as a pair with the main logo, each only when it is safe to show", () => {
		const main = "https://s.test/branding/m.png";
		const light = "http://127.0.0.1:9002/lanyard/branding/l.png";

		expect(brandLogos({ ...view, logoUrl: main, lightLogoUrl: light })).toEqual(
			{
				main,
				light,
			},
		);
		expect(
			brandLogos({
				...view,
				logoUrl: "javascript:alert(1)",
				lightLogoUrl: "http://evil.test/l.png",
			}),
		).toEqual({ main: null, light: null });
		expect(brandLogos(view)).toEqual({ main: null, light: null });
	});
});
