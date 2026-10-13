import { useEffect, useState } from "react";
import { SafeImg } from "~/components/ui/safe-img";
import { proxyPath } from "~/lib/proxy-path";
import { mockStyle, previewBody, previewLogo } from "~/lib/theme-preview";

interface Derived {
	dashboard: Record<string, string>;
	signIn: Record<string, string>;
}
interface Answer {
	dark: Derived;
	light: Derived;
	warnings: { theme: string; pair: string; ratio: number; needed: number }[];
}

interface Props {
	values: Record<string, string>;
	endpoint: string;
	serviceSlug: string;
}

export function ThemePreview({ values, endpoint, serviceSlug }: Props) {
	const [theme, setTheme] = useState<"dark" | "light">("dark");
	const [answer, setAnswer] = useState<Answer | null>(null);
	const body = JSON.stringify(previewBody(values));

	useEffect(() => {
		const path = proxyPath(serviceSlug, endpoint);
		if (!path) return;
		const controller = new AbortController();
		const timer = setTimeout(() => {
			fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
				signal: controller.signal,
			})
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => data && setAnswer(data))
				.catch(() => {});
		}, 250);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [body, endpoint, serviceSlug]);

	if (!answer) {
		return <p className="text-sm text-(--fg-muted)">Loading preview...</p>;
	}
	const shown = answer[theme];
	const logo = previewLogo(values, theme);
	const warnings = answer.warnings.filter((w) => w.theme === theme);

	return (
		<div className="space-y-3 lg:sticky lg:top-4">
			<div
				role="tablist"
				aria-label="Preview theme"
				className="inline-flex rounded-(--radius) border border-(--border) p-0.5"
			>
				{(["dark", "light"] as const).map((name) => (
					<button
						key={name}
						type="button"
						role="tab"
						aria-selected={theme === name}
						onClick={() => setTheme(name)}
						className="h-11 rounded-sm px-4 text-sm capitalize text-(--fg-muted) aria-selected:bg-(--accent-muted) aria-selected:text-(--fg) lg:h-auto lg:px-3 lg:py-1"
					>
						{name}
					</button>
				))}
			</div>

			<div
				style={mockStyle(shown.signIn)}
				className="rounded-(--radius-lg) border border-(--border) bg-(--cs-canvas) p-4"
			>
				<p className="mb-2 text-xs text-(--cs-muted)">Sign-in</p>
				<div className="mx-auto max-w-xs space-y-3 rounded-(--radius) border border-(--cs-border) bg-(--cs-panel) p-4 text-(--cs-text)">
					<p className="text-base font-semibold">
						{values.heading || "Sign in"}
					</p>
					<div className="rounded-sm border border-(--cs-field-border) bg-(--cs-field) px-3 py-2 text-sm text-(--cs-muted)">
						Email or username
					</div>
					<div className="rounded-sm bg-(--cs-button) px-3 py-2 text-center text-sm font-medium text-white">
						Log in
					</div>
					<p className="text-xs text-(--cs-muted)">
						Need an account? <span className="text-(--cs-link)">Sign up</span>
					</p>
				</div>
			</div>

			<div
				style={mockStyle(shown.dashboard)}
				className="overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--bg) text-(--fg)"
			>
				<p className="px-4 pt-3 text-xs text-(--fg-muted)">Dashboard</p>
				<div className="flex min-h-40">
					<div className="w-1/3 space-y-2 border-r border-(--border) bg-(--surface-1) p-3">
						<div className="flex items-center gap-2 text-sm font-semibold">
							{logo && (
								<SafeImg src={logo} alt="" className="h-5 w-5 object-contain" />
							)}
							<span className="truncate">{values.name || "ConvStack"}</span>
						</div>
						<div className="rounded-sm bg-(--accent-muted) px-2 py-1 text-xs text-(--fg)">
							Home
						</div>
						<div className="px-2 py-1 text-xs text-(--fg-muted)">Schedule</div>
					</div>
					<div className="flex-1 space-y-2 p-3">
						<div className="rounded-(--radius) border border-(--border) bg-(--surface-2) p-3">
							<p className="text-sm font-medium">A card</p>
							<p className="text-xs text-(--fg-muted)">Muted text sits here</p>
						</div>
						<div className="inline-block rounded-sm bg-(--accent) px-3 py-1 text-xs font-medium text-(--accent-fg)">
							Primary
						</div>
					</div>
				</div>
			</div>

			{warnings.length > 0 ? (
				<ul className="space-y-1 text-xs text-(--warning)">
					{warnings.map((w) => (
						<li key={w.pair}>
							{w.pair}: {w.ratio}:1, aim for {w.needed}:1
						</li>
					))}
				</ul>
			) : (
				<p className="text-xs text-(--fg-muted)">
					Every checked pair is readable.
				</p>
			)}
		</div>
	);
}
