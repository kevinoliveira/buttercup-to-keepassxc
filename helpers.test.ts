import { expect, test, mock, spyOn } from "bun:test";
import {
	createGroupIndex,
	entriesToKeepassxcFileContent,
	extractExtraFields,
	extractLineObjects,
	formatEntries,
	getArguments,
	isGroupInTrash,
	logInformations,
	readAndParseButtercupCsv,
	splitEntryObjectLinesByDeletedStatus,
	structureExtraFields,
	writeKeepassXcCsvFile,
} from "./helpers";
import * as util from "util";
import * as csvParseSync from "csv-parse/sync";
import { LineObject } from "./types";

test("getArguments", () => {
	const spyParseArgs = spyOn(util, "parseArgs");

	// @ts-ignore
	spyParseArgs.mockImplementation(() => ({ values: {} }));
	expect(() => getArguments()).toThrow("missing arguments");

	// @ts-ignore
	spyParseArgs.mockImplementation(() => ({ values: { input: "input1" } }));
	expect(() => getArguments()).toThrow("missing arguments");

	// @ts-ignore
	spyParseArgs.mockImplementation(() => ({
		values: { input: "input1", output: "output1" },
	}));
	expect(() => getArguments()).not.toThrow("missing arguments");
	expect(getArguments()).toStrictEqual({ input: "input1", output: "output1" });

	expect(spyParseArgs).toHaveBeenCalledTimes(4);
	expect(spyParseArgs).lastCalledWith({
		args: Bun.argv,
		options: { input: { type: "string" }, output: { type: "string" } },
		strict: true,
		allowPositionals: true,
	});
});

test("readAndParseButtercupCsv", async () => {
	const spyParse = spyOn(csvParseSync, "parse");
	const spyBunFile = spyOn(global.Bun, "file");

	const fileContent = "FILE-CONTENT";
	const path = "random/path";

	// @ts-ignore
	spyBunFile.mockImplementationOnce(() => ({
		text: async () => Promise.resolve(fileContent),
	}));

	await readAndParseButtercupCsv(path);

	expect(spyParse).toHaveBeenCalledWith(fileContent);
	expect(spyParse).toHaveBeenCalledTimes(1);
	expect(spyBunFile).toHaveBeenCalledWith(path);
	expect(spyBunFile).toHaveBeenCalledTimes(1);
});

test("extractLineObjects", () => {
	const testMatrix = [
		["!header1", "!header2", "header 3"],
		["content1", "content2", "content3"],
		["content4", "content5", "content6"],
	];

	const lo = extractLineObjects(testMatrix);

	expect(lo.length).toBe(2);
	//@ts-ignore
	expect(lo[0]).toStrictEqual({
		header1: "content1",
		header2: "content2",
		"header 3": "content3",
	});
	//@ts-ignore
	expect(lo[1]).toStrictEqual({
		header1: "content4",
		header2: "content5",
		"header 3": "content6",
	});
});

test("createGroupIndex", () => {
	const lineObjectsTest: Array<LineObject> = [
		{
			type: "group",
			group_id: "id1",
			group_name: "group 1 name",
			group_parent: null,
			title: null,
			notes: null,
			id: null,
			password: null,
			username: null,
		},
		{
			type: "group",
			group_id: "id2",
			group_name: "group 2 name",
			group_parent: "id1",
			title: null,
			notes: null,
			id: null,
			password: null,
			username: null,
		},
		{
			type: "entry",
			group_id: "id2",
			group_name: null,
			group_parent: null,
			title: null,
			notes: null,
			id: "id3",
			password: null,
			username: null,
		},
	];

	const gIndex = createGroupIndex(lineObjectsTest);

	expect(gIndex).toStrictEqual({
		id1: {
			id: "id1",
			name: "group 1 name",
			parrentGroupId: null,
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parrentGroupId: "id1",
		},
	});
});

test("isGroupInTrash", () => {
	const groupIndex = {
		id1: {
			id: "id1",
			name: "group 1 name",
			parrentGroupId: "trashid",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parrentGroupId: "id1",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parrentGroupId: null,
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parrentGroupId: "id3",
		},
		trashid: {
			id: "trashid",
			name: "Trash",
			parrentGroupId: null,
		},
	};

	expect(isGroupInTrash(groupIndex, "trashid")).toBe(true);
	expect(isGroupInTrash(groupIndex, "id1")).toBe(true);
	expect(isGroupInTrash(groupIndex, "id2")).toBe(true);
	expect(isGroupInTrash(groupIndex, "id3")).toBe(false);
	expect(isGroupInTrash(groupIndex, "id4")).toBe(false);

	const groupIndexCircularReference = {
		id1: {
			id: "id1",
			name: "group 1 name",
			parrentGroupId: "id2",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parrentGroupId: "id3",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parrentGroupId: "id4",
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parrentGroupId: "id1",
		},
	};

	expect(() => isGroupInTrash(groupIndexCircularReference, "id4")).toThrow(
		"maximum recursion depth reached",
	);
});

test("extractExtraFields", () => {
	const baseLineObject: LineObject = {
		type: "entry",
		group_id: "group_id content",
		group_name: "group_name content",
		group_parent: "group_parent content",
		title: "title content",
		notes: "notes content",
		id: "id content",
		password: "password content",
		username: "username content",
	};

	expect(extractExtraFields(baseLineObject)).toStrictEqual([
		{
			key: "notes",
			value: "notes content",
		},
	]);

	expect(
		extractExtraFields({
			...baseLineObject,
			OTHER_FIELD: "some content",
			"another field": "more content",
		}),
	).toStrictEqual([
		{
			key: "notes",
			value: "notes content",
		},
		{
			key: "OTHER_FIELD",
			value: "some content",
		},
		{
			key: "another field",
			value: "more content",
		},
	]);
});

test("splitEntryObjectLinesByDeletedStatus", () => {
	const groupIndex = {
		id1: {
			id: "id1",
			name: "group 1 name",
			parrentGroupId: "trashid",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parrentGroupId: "id1",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parrentGroupId: null,
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parrentGroupId: "id3",
		},
		trashid: {
			id: "trashid",
			name: "Trash",
			parrentGroupId: null,
		},
	};

	const lineObjects: Array<LineObject> = [
		{
			type: "entry",
			group_id: "id3",
			group_name: null,
			group_parent: null,
			title: null,
			notes: "notas ahahah",
			id: "entry1",
			password: null,
			username: null,
		},
		{
			type: "entry",
			group_id: "id4",
			group_name: null,
			group_parent: null,
			title: null,
			notes: null,
			id: "entry2",
			password: null,
			username: null,
		},
		{
			type: "entry",
			group_id: "id2",
			group_name: null,
			group_parent: null,
			title: null,
			notes: null,
			id: "entry3",
			password: null,
			username: null,
		},
	];

	const rtn = splitEntryObjectLinesByDeletedStatus(lineObjects, groupIndex);

	expect(rtn).toStrictEqual({
		deleted: [lineObjects[2]],
		active: [lineObjects[0], lineObjects[1]],
	});
});

test("structureExtraFields", () => {
	const input1 = [
		{
			key: "author",
			value: "Eugène Ionesco",
		},
		{
			key: "book",
			value: "Rhinocéros",
		},
	];

	const input2 = [
		{
			key: "ONE TIME PASSWORD",
			value: "otpauth://TOPT _DATA",
		},
	];

	const rtn1 = structureExtraFields(input1);
	const rtn2 = structureExtraFields(input2);
	const rtn3 = structureExtraFields([...input1, ...input2]);

	expect(rtn1).toStrictEqual({
		totp: null,
		notes: "author : Eugène Ionesco\nbook : Rhinocéros",
	});

	expect(rtn2).toStrictEqual({
		totp: "otpauth://TOPT _DATA",
		notes: null,
	});

	expect(rtn3).toStrictEqual({
		totp: "otpauth://TOPT _DATA",
		notes: "author : Eugène Ionesco\nbook : Rhinocéros",
	});
});

test("formatEntries", () => {
	const groupIndex = {
		id1: {
			id: "id1",
			name: "group 1 name",
			parrentGroupId: "trashid",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parrentGroupId: "id1",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parrentGroupId: null,
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parrentGroupId: "id3",
		},
		trashid: {
			id: "trashid",
			name: "Trash",
			parrentGroupId: null,
		},
	};

	const lineObjects: Array<LineObject> = [
		{
			type: "entry",
			group_id: "id3",
			group_name: null,
			group_parent: null,
			title: null,
			notes: null,
			id: "entry1",
			password: null,
			username: null,
			"random field name": "random field value",
		},
		{
			type: "entry",
			group_id: "id4",
			group_name: null,
			group_parent: null,
			title: null,
			notes: "lorem ipsum",
			id: "entry2",
			password: null,
			username: null,
			"prime numbers": "2, 3, 5, 7, 11, 13,",
			"ONE TIME PWD": "otpauth://TOPT _DATA_1",
		},
		{
			type: "entry",
			group_id: "id2",
			group_name: null,
			group_parent: null,
			title: null,
			notes: null,
			id: "entry3",
			password: null,
			username: null,
		},
	];

	const rtn = formatEntries(lineObjects, groupIndex);

	expect(rtn).toStrictEqual([
		{
			id: "entry1",
			name: null,
			password: null,
			username: null,
			group: "group 3 name",
			notes: "random field name : random field value",
			totp: null,
		},
		{
			id: "entry2",
			name: null,
			password: null,
			username: null,
			group: "group 4 name",
			notes: "notes : lorem ipsum\nprime numbers : 2, 3, 5, 7, 11, 13,",
			totp: "otpauth://TOPT _DATA_1",
		},
		{
			id: "entry3",
			name: null,
			password: null,
			username: null,
			group: "group 2 name",
			notes: null,
			totp: null,
		},
	]);
});

test("entriesToKeepassxcFileContent", () => {
	const input = [
		{
			password: null,
			group: null,
			notes: null,
			id: "id-00",
			username: null,
			name: null,
			totp: null,
		},
		{
			password: "some-password",
			group: "Group 01",
			notes: "lorem ipsum",
			id: "id-01",
			username: "example@domain.com",
			name: "provider",
			totp: "TOPT string",
		},
	];

	const dateMock = "1970-01-01T00:00:00.000Z";

	const spyDate = spyOn(Date.prototype, "toISOString");
	spyDate.mockImplementation(() => dateMock);

	const rtn = entriesToKeepassxcFileContent(input);

	spyDate.mockClear();

	expect(typeof rtn).toBe("string");
	expect(rtn).toBe(
		"Group,Title,Username,Password,URL,Notes,TOTP,Icon,Last Modified,Created\n,,,,,,,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nGroup 01,provider,example@domain.com,some-password,,lorem ipsum,TOPT string,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\n",
	);
});

test("writeKeepassXcCsvFile", () => {
	const spyWrite = spyOn(global.Bun, "write");

	spyWrite.mockImplementationOnce(()=>Promise.resolve(1))
	writeKeepassXcCsvFile("filepath", "file content");

	expect(spyWrite).toHaveBeenCalledTimes(1);
	expect(spyWrite).toHaveBeenCalledWith("file content", "filepath");
});

test("logInformations", () => {
	const skyConsole = spyOn(global.console, "log");
	skyConsole.mockImplementation(() => {});

	logInformations(4, 6);

	expect(skyConsole).toHaveBeenCalledTimes(3);
	expect(skyConsole).toHaveBeenCalledWith("Found 10 entries");
	expect(skyConsole).toHaveBeenCalledWith("4 ignored");
	expect(skyConsole).toHaveBeenCalledWith("6 exported");
});
