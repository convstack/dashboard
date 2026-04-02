import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "~/server/functions/auth";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (session) {
			throw redirect({ to: "/home" });
		}
		throw redirect({ to: "/login" });
	},
});
