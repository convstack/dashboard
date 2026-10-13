import { AsyncLocalStorage } from "node:async_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientSession } from "../../src/lib/session-view";

const getSessionFn = vi.fn();
const getServiceCatalogFn = vi.fn();

vi.mock("../../src/server/functions/auth", () => ({
	getSessionFn: (...args: unknown[]) => getSessionFn(...args),
}));

vi.mock("../../src/server/functions/catalog", () => ({
	getServiceCatalogFn: (...args: unknown[]) => getServiceCatalogFn(...args),
}));

const requestSession = new AsyncLocalStorage<ClientSession>();

function sessionFor(sub: string): ClientSession {
	return {
		expiresAt: Math.floor(Date.now() / 1000) + 200,
		user: { id: sub, name: sub, email: `${sub}@x.dev`, role: "user" },
	};
}

afterEach(() => {
	getSessionFn.mockReset();
	getServiceCatalogFn.mockReset();
});

describe("_authenticated beforeLoad", () => {
	it("never hands one user's service list to another on the server", async () => {
		const sessionA = sessionFor("a");
		const sessionB = sessionFor("b");
		const listA = [{ slug: "a-only", baseUrl: "http://a.test" }];
		let failB: (err: Error) => void = () => {};
		const catalogB = new Promise((_, reject) => {
			failB = reject;
		});
		let markBAsked: () => void = () => {};
		const bAsked = new Promise<void>((resolve) => {
			markBAsked = resolve;
		});
		getSessionFn.mockImplementation(async () => requestSession.getStore());
		getServiceCatalogFn.mockImplementation(() => {
			const session = requestSession.getStore();
			if (session === sessionA) return Promise.resolve(listA);
			if (session === sessionB) {
				markBAsked();
				return catalogB;
			}
			throw new Error("catalog asked outside a signed-in request");
		});
		const { Route } = await import("../../src/routes/_authenticated");

		const forB = requestSession.run(sessionB, () => Route.options.beforeLoad());
		await bAsked;
		const forA = await requestSession.run(sessionA, () =>
			Route.options.beforeLoad(),
		);
		failB(new Error("lanyard down"));

		expect(forA.services).toEqual(listA);
		const failed = await forB;
		expect(failed.services).toEqual([]);
		expect(failed.servicesUnavailable).toBe(true);
		expect(forA.servicesUnavailable).toBe(false);
		expect(getServiceCatalogFn.mock.calls).toEqual([[], []]);
	});

	it("never hands one user's service list to another whose own list is empty", async () => {
		const sessionA = sessionFor("a");
		const sessionB = sessionFor("b");
		const listA = [{ slug: "a-only", baseUrl: "http://a.test" }];
		let answerB: (services: unknown[]) => void = () => {};
		const catalogB = new Promise((resolve) => {
			answerB = resolve;
		});
		let markBAsked: () => void = () => {};
		const bAsked = new Promise<void>((resolve) => {
			markBAsked = resolve;
		});
		getSessionFn.mockImplementation(async () => requestSession.getStore());
		getServiceCatalogFn.mockImplementation(() => {
			const session = requestSession.getStore();
			if (session === sessionA) return Promise.resolve(listA);
			if (session === sessionB) {
				markBAsked();
				return catalogB;
			}
			throw new Error("catalog asked outside a signed-in request");
		});
		const { Route } = await import("../../src/routes/_authenticated");

		const forB = requestSession.run(sessionB, () => Route.options.beforeLoad());
		await bAsked;
		const forA = await requestSession.run(sessionA, () =>
			Route.options.beforeLoad(),
		);
		answerB([]);

		expect(forA.services).toEqual(listA);
		const empty = await forB;
		expect(empty.services).toEqual([]);
		expect(empty.servicesUnavailable).toBe(false);
		expect(getServiceCatalogFn.mock.calls).toEqual([[], []]);
	});
});
