// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleEvent } from "../../src/lib/schedule/types";
import { useDragToMove } from "../../src/lib/schedule/use-drag-to-move";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function event(links: Record<string, string>): ScheduleEvent {
	return {
		id: "e1",
		title: "Panel",
		start: "2026-10-10T10:00:00.000Z",
		end: "2026-10-10T11:00:00.000Z",
		_links: links,
	} as unknown as ScheduleEvent;
}

async function drag(serviceSlug: string, link: string) {
	let api: ReturnType<typeof useDragToMove> | undefined;
	const Probe = () => {
		api = useDragToMove(serviceSlug);
		return null;
	};
	const root = createRoot(document.createElement("div"));
	await act(async () => root.render(createElement(Probe)));
	await act(async () => api?.beginDrag(event({ update: link })));
	await act(async () => api?.commit("e1"));
	await act(async () => root.unmount());
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("drag-to-move update calls", () => {
	it("send a service's relative link through its proxy prefix", async () => {
		const fetchSpy = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);

		await drag("schedule", "/api/events/e1");

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0][0]).toBe("/api/proxy/schedule/api/events/e1");
	});

	it("keeps a protocol-relative link on the dashboard, under the service's prefix", async () => {
		const fetchSpy = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);

		await drag("schedule", "//evil.test/x");

		const url = new URL(
			fetchSpy.mock.calls[0][0] as string,
			"http://dashboard.test",
		);
		expect(url.origin).toBe("http://dashboard.test");
		expect(url.pathname.startsWith("/api/proxy/schedule/")).toBe(true);
	});

	it.each([
		["an absolute url", "https://evil.test/api/events/e1"],
		["a climb out of the prefix", "/../../api/auth/logout"],
		["an encoded climb", "/%2e%2e/%2e%2e/api/auth/logout"],
		["a backslash climb", "/..\\..\\api\\auth\\logout"],
	])("make no request for %s", async (_label, link) => {
		const fetchSpy = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);

		await drag("schedule", link);

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
