export const LOGIN_ERRORS = {
	state: "Sign-in could not be verified. Please try again.",
	denied: "Sign-in was cancelled or refused.",
	exchange: "Sign-in could not be completed. Please try again.",
	unreachable: "The identity provider could not be reached.",
} as const;

export type LoginError = keyof typeof LOGIN_ERRORS;

/** /login only renders when it has something to say, so a failed sign-in never loops. */
export function loginOutcome(
	error: LoginError | undefined,
	lanyardReachable: boolean,
): "sign-in" | "show-error" | "show-unreachable" {
	if (error) return "show-error";
	return lanyardReachable ? "sign-in" : "show-unreachable";
}
