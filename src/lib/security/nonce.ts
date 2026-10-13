const nonces = new WeakMap<Request, string>();

export function nonceFor(request: Request): string {
	let nonce = nonces.get(request);
	if (!nonce) {
		nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
			"base64",
		);
		nonces.set(request, nonce);
	}
	return nonce;
}
