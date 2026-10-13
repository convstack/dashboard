// @vitest-environment jsdom
import { act, createElement, type FunctionComponent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppsEmptyState } from "../../src/components/layout/apps-empty-state";
import { RouteError } from "../../src/components/layout/route-error";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

async function render<P extends object>(
	component: FunctionComponent<P>,
	props: P,
) {
	const container = document.createElement("div");
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(component, props));
	});
	return container;
}

afterEach(async () => {
	for (const root of roots.splice(0)) {
		await act(async () => root.unmount());
	}
});

describe("the home page with no apps to show", () => {
	it("says the apps can't be loaded when lanyard failed", async () => {
		const view = await render(AppsEmptyState, { unavailable: true });
		expect(view.textContent).toContain("can't be loaded right now");
		expect(view.textContent).not.toContain("No apps connected yet");
	});

	it("says no apps are connected when the list really is empty", async () => {
		const view = await render(AppsEmptyState, { unavailable: false });
		expect(view.textContent).toContain("No apps connected yet");
		expect(view.textContent).not.toContain("can't be loaded");
	});

	it("marks the failure with the warning colour, not only different words", async () => {
		const failed = await render(AppsEmptyState, { unavailable: true });
		const empty = await render(AppsEmptyState, { unavailable: false });
		expect(failed.querySelector("svg")?.getAttribute("class")).toContain(
			"--warning",
		);
		expect(empty.querySelector("svg")?.getAttribute("class")).not.toContain(
			"--warning",
		);
	});
});

describe("the route error view", () => {
	it("shows the message a loader failed with", async () => {
		const view = await render(RouteError, {
			error: new Error(
				"Your apps can't be loaded right now. Reload in a moment.",
			),
			reset: () => {},
		});
		expect(view.textContent).toContain("Reload in a moment");
		expect(view.querySelector("button")?.textContent).toBe("Reload");
	});
});
