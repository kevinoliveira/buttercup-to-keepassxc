export interface Arguments {
	input: string;
	output: string;
}

export type CsvMatrix = Array<Array<string>>;

export interface LineObject extends Record<string, string | null> {
	type: "group" | "entry";
	group_id: string | null;
	group_name: string | null;
	group_parent: string | null;
	title: string | null;
	notes: string | null;
	id: string | null;
	password: string | null;
	username: string | null;
	URL: string | null;
}

export interface GroupInfo {
	id: string;
	name: string;
	parentGroupId: string | null;
}

export type GroupIndex = Record<string, GroupInfo>;

export interface ExtraFields {
	key: string;
	value: string;
}

export interface SplitObjectLinesByStatusRtn {
	active: Array<LineObject>;
	deleted: Array<LineObject>;
}

export type EntryParsed = Record<
	"id" | "name" | "username" | "password" | "URL" | "totp" | "group" | "notes",
	string | null
>;

export interface StructuredFields {
	totp: string | null;
	notes: string | null;
}
