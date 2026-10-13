import { Link, useLoaderData } from "@tanstack/react-router";
import { SafeImg } from "~/components/ui/safe-img";
import { brandLogos } from "~/lib/branding";

export function BrandMark() {
	const branding = useLoaderData({ from: "__root__" });
	const { main, light } = brandLogos(branding);
	return (
		<Link
			to="/home"
			className="flex items-center gap-2 text-base font-semibold tracking-tight text-(--fg)"
		>
			{main && (
				<SafeImg
					src={main}
					alt=""
					className={`h-7 w-7 object-contain ${light ? "brand-logo-dark" : ""}`}
				/>
			)}
			{light && (
				<SafeImg
					src={light}
					alt=""
					className="brand-logo-light h-7 w-7 object-contain"
				/>
			)}
			<span className="truncate">
				{main || light ? branding.name : "Dashboard"}
			</span>
		</Link>
	);
}
