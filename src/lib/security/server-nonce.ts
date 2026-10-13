import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { nonceFor } from "./nonce";

export const getServerNonce = createServerOnlyFn(() => nonceFor(getRequest()));
