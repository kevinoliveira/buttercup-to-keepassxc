import { parseArgs } from "util";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

import {
	Arguments,
	CsvMatrix,
	EntryParsed,
	ExtraFields,
	GroupIndex,
	LineObject,
	SplitObjectLinesByStatusRtn,
	StructuredFields,
} from "./types";

const TRASH_BIN_GROUP_NAME = "Trash";
const OPT_REGEX = /^otpauth:\/\/./;
const RECURSIVE_LIMIT = 200;

export const getArguments = (): Arguments => {
	const { values } = parseArgs({
		args: Bun.argv,
		options: { input: { type: "string" }, output: { type: "string" } },
		strict: true,
		allowPositionals: true,
	});
	if (!values.input || !values.output) throw Error("missing arguments");

	return {
		input: values.input,
		output: values.output,
	};
};

export const readAndParseButtercupCsv = async (
	path: string,
): Promise<CsvMatrix> => {
	return parse(await Bun.file(path).text());
};

export const extractLineObjects = (csvMatrix: CsvMatrix): LineObject[] => {
	const headers = csvMatrix[0].map((h) => h.replace("!", ""));
	const content = csvMatrix.slice(1);

	return content.map((p) =>
		p.reduce(
			(acc, cur, index) => ({
				[headers[index]]: cur,
				...acc,
			}),
			{} as LineObject,
		),
	);
};

export const createGroupIndex = (lineObjects: LineObject[]): GroupIndex => {
	const groupLineObjects = lineObjects.filter((lo) => lo.type === "group");

	return groupLineObjects.reduce(
		(acc, cur) => ({
			[cur.group_id!]: {
				id: cur.group_id!,
				parentGroupId: cur.group_parent === "0" ? null : cur.group_parent,
				name: cur.group_name!,
			},
			...acc,
		}),
		{} as GroupIndex,
	);
};

export const isGroupInTrash = (
	groupIndex: GroupIndex,
	groupId: string,
	recursiveCount: number = 0,
): boolean => {
	if (recursiveCount > RECURSIVE_LIMIT)
		throw Error("maximum recursion depth reached");
	if (
		groupIndex[groupId].name === TRASH_BIN_GROUP_NAME &&
		groupIndex[groupId].parentGroupId === null
	)
		return true;
	if (groupIndex[groupId].parentGroupId)
		return isGroupInTrash(
			groupIndex,
			groupIndex[groupId].parentGroupId,
			recursiveCount + 1,
		);
	return false;
};

export const extractExtraFields = (lineObject: LineObject): ExtraFields[] => {
	// notes is a default field, but should not be put here, otherwise buttercup notes will not be exported
	const fieldsToIgnore = [
		"password",
		"username",
		"id",
		"title",
		"group_parent",
		"group_name",
		"group_id",
		"type",
		"URL",
	];
	const fields: Array<ExtraFields> = [];

	for (const prop in lineObject) {
		if (fieldsToIgnore.includes(prop)) continue;
		if (lineObject[prop]) fields.push({ key: prop, value: lineObject[prop] });
	}

	return fields;
};

export const splitEntryObjectLinesByDeletedStatus = (
	lineObjects: Array<LineObject>,
	groupIndex: GroupIndex,
): SplitObjectLinesByStatusRtn => {
	const entryObjectLines = lineObjects.filter((lo) => lo.type === "entry");

	const active: Array<LineObject> = [];
	const deleted: Array<LineObject> = [];

	for (const lo of entryObjectLines) {
		if (isGroupInTrash(groupIndex, lo.group_id!)) deleted.push(lo);
		else active.push(lo);
	}

	return { deleted, active };
};

export const structureExtraFields = (
	fields: Array<ExtraFields>,
): StructuredFields => {
	const totpFields: Array<ExtraFields> = [];
	const noteFields: Array<ExtraFields> = [];

	for (const f of fields) {
		if (OPT_REGEX.test(f.value)) totpFields.push(f);
		else noteFields.push(f);
	}

	// if there is more than one will be ignored
	const totp = totpFields[0]?.value;
	const notes = noteFields.map((nf) => `${nf.key} : ${nf.value}`).join("\n");

	return {
		totp: totp || null,
		notes: notes || null,
	};
};

export const formatEntries = (
	lineObjects: Array<LineObject>,
	groupIndex: GroupIndex,
): Array<EntryParsed> => {
	return lineObjects.map((lo) => {
		const extraFields = extractExtraFields(lo);
		const { totp, notes } = structureExtraFields(extraFields);
		const groupName = groupIndex[lo.group_id!].name;

		return {
			id: lo.id,
			name: lo.title || null,
			password: lo.password || null,
			username: lo.username || null,
			url: lo.URL || null,
			group: groupName || null,
			notes: notes || null,
			totp: totp || null,
		};
	});
};

export const entriesToKeepassxcFileContent = (
	entries: Array<EntryParsed>,
): string => {
	const keepassHeaders = [
		"Group",
		"Title",
		"Username",
		"Password",
		"URL",
		"Notes",
		"TOTP",
		"Icon",
		"Last Modified",
		"Created",
	];
	return stringify([
		keepassHeaders,
		...entries.map((e) => [
			e.group,
			e.name,
			e.username,
			e.password,
			e.url,
			e.notes,
			e.totp,
			"0",
			new Date().toISOString(),
			new Date().toISOString(),
		]),
	]);
};

export const writeKeepassXcCsvFile = async (path: string, content: string) => {
	await Bun.write(path, content);
};

export const logInformations = (
	totalDeleted: number,
	totalExported: number,
) => {
	console.log(`Found ${totalExported + totalDeleted} entries`);
	console.log(`${totalDeleted} ignored`);
	console.log(`${totalExported} exported`);
};

export async function main() {
	const paths = getArguments();
	const bcup = await readAndParseButtercupCsv(paths.input);
	const lineObjs = extractLineObjects(bcup);
	const gIdx = createGroupIndex(lineObjs);
	const entries = splitEntryObjectLinesByDeletedStatus(lineObjs, gIdx);
	const formatedEntries = formatEntries(entries.active, gIdx);
	const kpassContent = entriesToKeepassxcFileContent(formatedEntries);
	await writeKeepassXcCsvFile(paths.output, kpassContent);
	logInformations(entries.deleted.length, entries.active.length);
}
