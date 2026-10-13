import { DynamicIcon } from "./dynamic-icon";

// "nothing registered" and "lanyard didn't answer" must not look the same
export function AppsEmptyState({ unavailable }: { unavailable: boolean }) {
	return (
		<div className="mt-8 rounded-lg border border-dashed border-(--border) p-12 text-center">
			<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--muted)">
				<DynamicIcon
					name={unavailable ? "triangle-alert" : "box"}
					className={
						unavailable
							? "h-6 w-6 text-(--warning)"
							: "h-6 w-6 text-(--muted-foreground)"
					}
				/>
			</div>
			<p className="text-sm font-medium">
				{unavailable
					? "Your apps can't be loaded right now"
					: "No apps connected yet"}
			</p>
			<p className="mt-1 text-xs text-(--muted-foreground)">
				{unavailable
					? "Lanyard isn't answering. Reload in a moment."
					: "When services register with Lanyard, they'll appear here as apps you can access."}
			</p>
		</div>
	);
}
