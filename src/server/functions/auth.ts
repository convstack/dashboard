import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readSession } from "~/lib/auth";
import { type ClientSession, toClientSession } from "~/lib/session-view";

export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ClientSession | null> => {
		const session = await readSession(getRequest());
		return session ? toClientSession(session) : null;
	},
);
