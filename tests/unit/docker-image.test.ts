import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
	readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("production image", () => {
	it("copies every local file server.ts imports into the runner stage", () => {
		const server = read("server.ts");
		const imports = [...server.matchAll(/from "\.\/([^"]+)"/g)]
			.map((match) => match[1])
			.filter((path) => !path.startsWith("dist/"));
		const runner = read("deploy/docker/Dockerfile").split("FROM ").pop() ?? "";
		const copied = [
			...runner.matchAll(/COPY --from=builder (?:--chown=\S+ )?(\S+)/g),
		].map((match) => match[1]);

		expect(imports.length).toBeGreaterThan(0);
		for (const path of imports) {
			const withExtension = /\.[a-z]+$/.test(path) ? path : `${path}.ts`;
			expect(copied, `${withExtension} is imported by server.ts`).toContain(
				`/app/${withExtension}`,
			);
		}
	});
});
