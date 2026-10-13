import type { ErrorComponentProps } from "@tanstack/react-router";

export function RouteError({ error }: ErrorComponentProps) {
	return (
		<div className="flex items-center justify-center py-16">
			<div className="max-w-md space-y-4 text-center">
				<h1 className="text-xl font-bold">Something went wrong</h1>
				<p className="text-sm text-(--muted-foreground)">
					{error instanceof Error
						? error.message
						: "An unexpected error occurred."}
				</p>
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
				>
					Reload
				</button>
			</div>
		</div>
	);
}
