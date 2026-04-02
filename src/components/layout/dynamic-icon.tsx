import type { LucideProps } from "lucide-react";
import { icons } from "lucide-react";

function toPascalCase(str: string): string {
	return str
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

export function DynamicIcon({
	name,
	...props
}: { name: string } & LucideProps) {
	const pascalName = toPascalCase(name);
	const IconComponent = icons[pascalName as keyof typeof icons];

	if (!IconComponent) return null;
	return <IconComponent {...props} />;
}
