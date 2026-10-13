import { describe, expect, it, vi } from "vitest";
import { lanyardPathAllowed } from "./service-proxy";

vi.mock("./lanyard-client", () => ({
	LANYARD_URL: "http://host.test/lanyard",
	lanyardFetch: vi.fn(),
}));

describe("lanyardPathAllowed under a LANYARD_URL with a path", () => {
	it.each([
		["http://host.test/lanyard/api/user/departments", true],
		["http://host.test/lanyard/api/services/guidebook/permissions", false],
		["http://host.test/lanyard/API/Services/guidebook/Permissions/", false],
		["http://host.test/lanyard//api/services/guidebook/permissions", false],
		["http://host.test/lanyard/api/services/guidebook/permiss%09ions", false],
		["http://host.test/lanyard/../ledger/api/x", false],
		["http://host.test/lanyard-other/api/x", false],
		["http://host.test/ledger/api/x", false],
		["http://other.test/lanyard/api/user/departments", false],
		[
			"http://host.test/lanyard/api/user/..%2fservices/guidebook/permissions",
			false,
		],
		["http://host.test/lanyard/api/user%2f..%2f..%2fadmin", false],
		["http://host.test/lanyard/api/user%2f.%2fprofile", false],
		["http://host.test/lanyard/api/user/%2e%2e%2fservices", false],
		["http://host.test/lanyard/api/..%2f..%2fother-service/x", false],
		["http://host.test/lanyard/api/user/profile", true],
	])("%s: %s", (url, allowed) => {
		expect(lanyardPathAllowed(new URL(url))).toBe(allowed);
	});
});
