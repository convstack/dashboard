import { describe, expect, it } from "vitest";
import { dropPosition } from "./drop-position";

// cards a, b, c stacked 100px tall each, starting at y=0
const column = (ids: string[]) =>
	ids.map(
		(id, i) =>
			({
				getAttribute: () => id,
				getBoundingClientRect: () => ({ top: i * 100, height: 100 }),
			}) as unknown as Element,
	);

describe("dropPosition", () => {
	it("drops between the next two cards when dragging down", () => {
		// a dragged to between b and c: only b is above, among the others
		expect(dropPosition(column(["a", "b", "c"]), 200, "a")).toBe(1);
	});

	it("leaves a card where it is when it is dropped on itself", () => {
		expect(dropPosition(column(["a", "b", "c"]), 60, "a")).toBe(0);
		expect(dropPosition(column(["a", "b", "c"]), 160, "b")).toBe(1);
	});

	it("drops at the end below the last card", () => {
		expect(dropPosition(column(["a", "b", "c"]), 290, "a")).toBe(2);
	});

	it("drops above a card when dragging up", () => {
		expect(dropPosition(column(["a", "b", "c"]), 10, "c")).toBe(0);
		expect(dropPosition(column(["a", "b", "c"]), 120, "c")).toBe(1);
	});

	it("counts every card of another column", () => {
		expect(dropPosition(column(["d", "e"]), 160, "a")).toBe(2);
		expect(dropPosition(column([]), 50, "a")).toBe(0);
	});
});
