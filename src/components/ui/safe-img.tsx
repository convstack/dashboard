import type { ImgHTMLAttributes } from "react";
import { isSafeImageSrc } from "~/lib/safe-url";
import { useServiceSlug } from "~/lib/service-slug-context";

// a service decides what the image is, the dashboard decides what loads
export function SafeImg({
	src,
	alt = "",
	...props
}: ImgHTMLAttributes<HTMLImageElement>) {
	const serviceSlug = useServiceSlug();
	if (!src || !isSafeImageSrc(src, serviceSlug)) return null;
	return <img src={src} alt={alt} {...props} />;
}
