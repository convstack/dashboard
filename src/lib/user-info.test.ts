import { afterEach, describe, expect, it, vi } from "vitest";

const lanyardFetch = vi.fn();

vi.mock("./oidc-discovery", () => ({
	discoverOidc: async () => ({ userinfoEndpoint: "http://idp.test/userinfo" }),
	publicHostHeaders: () => ({}),
}));
vi.mock("./lanyard-client", () => ({
	LANYARD_URL: "http://lanyard.test",
	lanyardFetch: (...args: unknown[]) => lanyardFetch(...args),
}));

afterEach(() => {
	lanyardFetch.mockReset();
	vi.unstubAllGlobals();
});

async function imageFor(picture: string) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json({ sub: "u1", name: "Ada", email: "ada@x.dev", picture }),
		),
	);
	lanyardFetch.mockResolvedValue(Response.json({}));
	const { fetchUserInfo } = await import("./auth");
	return (await fetchUserInfo("token"))?.image;
}

describe("fetchUserInfo avatar", () => {
	it("keeps an https picture", async () => {
		expect(await imageFor("https://cdn.test/a.png")).toBe(
			"https://cdn.test/a.png",
		);
	});

	it("keeps a picture served over plain http from this machine", async () => {
		expect(await imageFor("http://127.0.0.1:9002/lanyard/a.png")).toBe(
			"http://127.0.0.1:9002/lanyard/a.png",
		);
	});

	it.each([
		["an http picture", "http://cdn.test/a.png"],
		["a data uri", "data:image/png;base64,AAAA"],
		[
			"a relative default avatar",
			"/static/dist/assets/images/user_default.png",
		],
		["a placeholder dash", "—"],
		["a lookalike of localhost", "http://localhost.evil.test/a.png"],
	])("drops %s", async (_label, picture) => {
		expect(await imageFor(picture)).toBeUndefined();
	});
});
