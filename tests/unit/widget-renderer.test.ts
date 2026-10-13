// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetRenderer } from "../../src/components/widgets/widget-renderer";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const service = {
	id: "svc-id",
	name: "Svc",
	slug: "svc",
	type: "service",
	description: null,
	version: null,
	baseUrl: "http://svc.test",
	status: "active",
	lastHealthCheck: null,
	lastHealthStatus: null,
	uiManifest: null,
};

const roots: Root[] = [];

async function renderWidget(endpoint: string) {
	const container = document.createElement("div");
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(WidgetRenderer, {
				widget: { id: "w", type: "stat", label: "Open", endpoint, size: "sm" },
				service,
			}),
		);
	});
	return container;
}

afterEach(async () => {
	for (const root of roots.splice(0)) {
		await act(async () => root.unmount());
	}
	vi.unstubAllGlobals();
});

describe("WidgetRenderer", () => {
	it("never fetches an endpoint that leaves the service's proxy route", async () => {
		const fetchSpy = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);

		const container = await renderWidget("/../other/x");

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Invalid endpoint");
	});

	it("fetches exactly the checked path", async () => {
		const fetchSpy = vi.fn(async (_path: string) => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);

		await renderWidget("/api/stats?range=7d");

		expect(fetchSpy.mock.calls).toEqual([
			["/api/proxy/svc/api/stats?range=7d"],
		]);
	});
});
