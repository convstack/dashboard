export interface UIManifest {
	name: string;
	icon: string;
	version: string;
	navigation: NavigationItem[];
	widgets: WidgetDefinition[];
	pages: PageDefinition[];
	permissions: string[];
}

export interface NavigationItem {
	label: string;
	path: string;
	icon: string;
	href?: string;
	badge?: { endpoint: string };
	children?: NavigationItem[];
	requiredPermission?: string;
}

export interface WidgetDefinition {
	id: string;
	type: "stat" | "chart" | "table" | "list" | "progress";
	label: string;
	description?: string;
	endpoint: string;
	refreshInterval?: number;
	size: "sm" | "md" | "lg" | "full";
	requiredPermission?: string;
}

export interface PageDefinition {
	path: string;
	title: string;
	layout: "default" | "full-width" | "split";
	sections: PageSection[];
	requiredPermission?: string;
	showBack?: boolean;
}

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export interface RowAction {
	label: string;
	endpoint: string;
	method: "POST" | "PUT" | "DELETE";
	variant?: "default" | "danger";
	confirm?: string;
	link?: string;
}

export interface DataTableConfig {
	title?: string;
	rowLink?: string;
	rowActions?: RowAction[];
	createLink?: string;
	createLabel?: string;
}

export interface DetailConfig {
	title?: string;
}

export interface FormConfig {
	title?: string;
	fields: Array<{
		key: string;
		label: string;
		type:
			| "text"
			| "number"
			| "email"
			| "select"
			| "textarea"
			| "password"
			| "file"
			| "search";
		required?: boolean;
		placeholder?: string;
		options?: Array<{ label: string; value: string }>;
		uploadEndpoint?: string;
		accept?: string;
		searchEndpoint?: string;
		searchResultLabel?: string;
		searchResultValue?: string;
	}>;
	submitLabel?: string;
	submitEndpoint?: string;
	method?: string;
}

export interface PageSection {
	type:
		| "data-table"
		| "form"
		| "detail"
		| "widget-grid"
		| "action-bar"
		| "two-factor"
		| "passkey-manager"
		| "custom";
	endpoint: string;
	config: Record<string, JsonValue>;
}
