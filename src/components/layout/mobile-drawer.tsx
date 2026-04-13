import { type ReactNode, useEffect, useRef } from "react";

interface Props {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
}

export function MobileDrawer({ open, onClose, children }: Props) {
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const drawerRef = useRef<HTMLElement | null>(null);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);

	// Lock body scroll while open
	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	// Focus management: move focus into drawer on open, restore on close
	useEffect(() => {
		if (open) {
			previousFocusRef.current = document.activeElement as HTMLElement | null;
			// Move focus into the drawer on next tick so the transition starts
			const timer = window.setTimeout(() => {
				const first = drawerRef.current?.querySelector<HTMLElement>(
					"a, button, [tabindex]:not([tabindex='-1'])",
				);
				first?.focus();
			}, 0);
			return () => window.clearTimeout(timer);
		}
		previousFocusRef.current?.focus();
		previousFocusRef.current = null;
		return undefined;
	}, [open]);

	return (
		<>
			{/* Backdrop */}
			<div
				aria-hidden="true"
				onClick={onClose}
				className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-[var(--duration)] ease-[var(--ease)] lg:hidden ${
					open ? "opacity-100" : "pointer-events-none opacity-0"
				}`}
			/>

			{/* Drawer panel */}
			<aside
				ref={drawerRef}
				aria-hidden={!open}
				inert={!open}
				className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--surface-1)] border-r border-[var(--border)] transform transition-transform duration-[var(--duration)] ease-[var(--ease)] lg:hidden ${
					open ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				{children}
			</aside>
		</>
	);
}
