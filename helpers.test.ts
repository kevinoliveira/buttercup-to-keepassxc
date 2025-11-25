import { expect, test, mock, spyOn, afterEach } from "bun:test";
import {
	createGroupIndex,
	entriesToKeepassxcFileContent,
	extractExtraFields,
	extractLineObjects,
	formatEntries,
	getArguments,
	isGroupInTrash,
	logInformations,
	main,
	readAndParseButtercupCsv,
	splitEntryObjectLinesByDeletedStatus,
	structureExtraFields,
	writeKeepassXcCsvFile,
} from "./helpers";
import * as util from "util";
import * as csvParseSync from "csv-parse/sync";
import { LineObject } from "./types";

afterEach(() => {
	mock.restore();
});

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
			group_parent: "0",
			title: null,
			notes: null,
			id: null,
			password: null,
			username: null,
			URL: null,
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
			URL: null,
		},
		{
			type: "entry",
			group_id: "id2",
			group_name: null,
			group_parent: "0",
			title: null,
			notes: null,
			id: "id3",
			password: null,
			username: null,
			URL: null,
		},
	];

	const gIndex = createGroupIndex(lineObjectsTest);

	expect(gIndex).toStrictEqual({
		id1: {
			id: "id1",
			name: "group 1 name",
			parentGroupId: null,
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parentGroupId: "id1",
		},
	});
});

test("isGroupInTrash", () => {
	const groupIndex = {
		id1: {
			id: "id1",
			name: "group 1 name",
			parentGroupId: "trashid",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parentGroupId: "id1",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parentGroupId: null,
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parentGroupId: "id3",
		},
		trashid: {
			id: "trashid",
			name: "Trash",
			parentGroupId: null,
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
			parentGroupId: "id2",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parentGroupId: "id3",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parentGroupId: "id4",
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parentGroupId: "id1",
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
		URL: "URL content",
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
			parentGroupId: "trashid",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parentGroupId: "id1",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parentGroupId: null,
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parentGroupId: "id3",
		},
		trashid: {
			id: "trashid",
			name: "Trash",
			parentGroupId: null,
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
			URL: null,
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
			URL: null,
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
			URL: null,
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
			parentGroupId: "trashid",
		},
		id2: {
			id: "id2",
			name: "group 2 name",
			parentGroupId: "id1",
		},
		id3: {
			id: "id3",
			name: "group 3 name",
			parentGroupId: null,
		},
		id4: {
			id: "id4",
			name: "group 4 name",
			parentGroupId: "id3",
		},
		trashid: {
			id: "trashid",
			name: "Trash",
			parentGroupId: null,
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
			URL: null,
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
			URL: null,
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
			URL: null,
		},
	];

	const rtn = formatEntries(lineObjects, groupIndex);

	expect(rtn).toStrictEqual([
		{
			id: "entry1",
			name: null,
			password: null,
			username: null,
			url: null,
			group: "group 3 name",
			notes: "random field name : random field value",
			totp: null,
		},
		{
			id: "entry2",
			name: null,
			password: null,
			username: null,
			url: null,
			group: "group 4 name",
			notes: "notes : lorem ipsum\nprime numbers : 2, 3, 5, 7, 11, 13,",
			totp: "otpauth://TOPT _DATA_1",
		},
		{
			id: "entry3",
			name: null,
			password: null,
			username: null,
			url: null,
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
			URL: null,
			totp: null,
		},
		{
			password: "some-password",
			group: "Group 01",
			notes: "lorem ipsum",
			id: "id-01",
			username: "example@domain.com",
			name: "provider",
			URL: null,
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

test("writeKeepassXcCsvFile", async () => {
	const spyWrite = spyOn(global.Bun, "write");

	spyWrite.mockImplementationOnce(() => Promise.resolve(1));
	await writeKeepassXcCsvFile("filepath", "file content");

	expect(spyWrite).toHaveBeenCalledTimes(1);
	expect(spyWrite).toHaveBeenCalledWith("filepath", "file content");
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

test("main", async () => {
	const input = `!type,!group_id,!group_name,!group_parent,title,username,password,id,type,cvv,valid_from,expiry,url,note,publicKey,privateKey,one time password,another one,city 1,city 2,city 3,city 4,city 5\ngroup,abd68c99-484c-4c84-a39c-3fd35bff0c55,General,0,,,,,,,,,,,,,,,,,,,\ngroup,04e78395-809e-4aea-bca0-96f55fc0ede0,subgroup,abd68c99-484c-4c84-a39c-3fd35bff0c55,,,,,,,,,,,,,,,,,,,\ngroup,8406a69e-227a-46ca-b4d0-c9a3bff44084,Trash,0,,,,,,,,,,,,,,,,,,,\nentry,abd68c99-484c-4c84-a39c-3fd35bff0c55,,,www.example.com,random-username-12,random-password,437344d6-c67a-43f9-b339-f7520ba9cf61,,,,,,,,,,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,anoter service,not-really-a-user-name,longlonglonglonglonglonglonglonglongpassword,3ebadcaa-2c46-4f95-a66a-a992a55fa1fa,,,,,,,,,,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,my secret mastercard,Maik Knotten,5240885772506575,f943aca2-6aa7-49dd-ae91-238564f113d1,mastercard,497,102016,102026,,,,,,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,Example webpage,username123,password123,9ef2f2c6-56c5-4141-bc48-1e0ff8098df1,,,,,www.example.com,,,,,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,THIS is a secret NOTE,,,65952465-22f6-41f9-8e30-a0a2a1689cf7,,,,,,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus a scelerisque purus. Nulla sed nunc non nisl iaculis tempor. Cras in velit mollis sapien elementum sagittis sit amet vel purus. Vestibulum suscipit turpis nec justo sodales lacinia. Duis quis imperdiet ante, vel pellentesque dui. Vivamus non viverra purus, sed tempor nisl. Praesent quis sodales augue. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nullam elementum neque at nisi dignissim, eu cursus nibh gravida. Fusce rutrum neque eget nisl aliquet fermentum. Nunc vel nulla ullamcorper, convallis lorem quis, auctor nisi. Nunc vestibulum at nulla et posuere. Nullam ac accumsan nisi. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Fusce efficitur risus eget sagittis fermentum. Phasellus cursus, eros sit amet eleifend malesuada, quam sapien suscipit ligula, a interdum risus eros id eros.",,,,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,random public key,,,d35d9f57-52d2-438e-8141-fec90d4c02ef,,,,,,,-----BEGIN PUBLIC KEY----- MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCi9/rSUbbr9TT7UnnlAe7dYku0 WV74foYEPJKJBN9N2ujkf6sr6+u2+RooZv39r+q30BiDP7TRMeUh3BKkpA0iIHWm tinPJPk3j60IRELzEFoIbIbGxVHCM5cHR5U+YjpqveuK9XciRIAOMcIFYuHUQegs YSstv0SQdqmJKN87hQIDAQAB -----END PUBLIC KEY-----,this key is a key,,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,Entry with TOTP,username987,password987,a32f7ba6-7f6b-44a5-8567-2bf2d3f8bb4f,,,,,,,,,otpauth://totp/Issuer  (Somrthing):mark@example.com?secret=JBSWY3DPEHPK3PXP&issuer=RandomIssuer,,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,some title,useruser,passwordpassword,9f79e2a0-7973-4a42-9bb4-e3c67d738398,,,,,,,,,,second password field,,,,,\nentry,04e78395-809e-4aea-bca0-96f55fc0ede0,,,entry with all the fields,user123,pass321,a802a129-69b5-4894-aa7d-a9aa3c524d00,,,,,,,,,,,Kaufman,Mkokotoni,Salto,Isangel,Navoiy\nentry,8406a69e-227a-46ca-b4d0-c9a3bff44084,,,deleted entry,useruser,password,045e594a-7e93-4dae-8054-73388f39f918,,,,,,,,,,,,,,,`;
	const output = `Group,Title,Username,Password,URL,Notes,TOTP,Icon,Last Modified,Created\nGeneral,www.example.com,random-username-12,random-password,,,,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,anoter service,not-really-a-user-name,longlonglonglonglonglonglonglonglongpassword,,,,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,my secret mastercard,Maik Knotten,5240885772506575,,\"expiry : 102026\nvalid_from : 102016\ncvv : 497\",,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,Example webpage,username123,password123,,url : www.example.com,,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,THIS is a secret NOTE,,,,\"note : Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus a scelerisque purus. Nulla sed nunc non nisl iaculis tempor. Cras in velit mollis sapien elementum sagittis sit amet vel purus. Vestibulum suscipit turpis nec justo sodales lacinia. Duis quis imperdiet ante, vel pellentesque dui. Vivamus non viverra purus, sed tempor nisl. Praesent quis sodales augue. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nullam elementum neque at nisi dignissim, eu cursus nibh gravida. Fusce rutrum neque eget nisl aliquet fermentum. Nunc vel nulla ullamcorper, convallis lorem quis, auctor nisi. Nunc vestibulum at nulla et posuere. Nullam ac accumsan nisi. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Fusce efficitur risus eget sagittis fermentum. Phasellus cursus, eros sit amet eleifend malesuada, quam sapien suscipit ligula, a interdum risus eros id eros.\",,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,random public key,,,,\"privateKey : this key is a key\npublicKey : -----BEGIN PUBLIC KEY----- MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCi9/rSUbbr9TT7UnnlAe7dYku0 WV74foYEPJKJBN9N2ujkf6sr6+u2+RooZv39r+q30BiDP7TRMeUh3BKkpA0iIHWm tinPJPk3j60IRELzEFoIbIbGxVHCM5cHR5U+YjpqveuK9XciRIAOMcIFYuHUQegs YSstv0SQdqmJKN87hQIDAQAB -----END PUBLIC KEY-----\",,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,Entry with TOTP,username987,password987,,,otpauth://totp/Issuer  (Somrthing):mark@example.com?secret=JBSWY3DPEHPK3PXP&issuer=RandomIssuer,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,some title,useruser,passwordpassword,,another one : second password field,,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\nsubgroup,entry with all the fields,user123,pass321,,\"city 5 : Navoiy\ncity 4 : Isangel\ncity 3 : Salto\ncity 2 : Mkokotoni\ncity 1 : Kaufman\",,0,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z\n`;
	const inputFleName = "input-fn";
	const outputFilename = "output-fn";

	// mocks
	const spyParseArgs = spyOn(util, "parseArgs");
	// @ts-ignore
	spyParseArgs.mockImplementation(() => ({
		values: { input: inputFleName, output: outputFilename },
	}));

	const spyBunFile = spyOn(global.Bun, "file");
	// @ts-ignore
	spyBunFile.mockImplementationOnce(() => ({
		text: async () => Promise.resolve(input),
	}));

	const spyWrite = spyOn(global.Bun, "write");
	spyWrite.mockImplementationOnce(() => Promise.resolve(0));

	const skyConsole = spyOn(global.console, "log");
	skyConsole.mockImplementation(() => {});

	const dateMock = "1970-01-01T00:00:00.000Z";
	const spyDate = spyOn(Date.prototype, "toISOString");
	spyDate.mockImplementation(() => dateMock);

	await main();

	expect(spyBunFile).toHaveBeenCalledTimes(1);
	expect(spyBunFile).toHaveBeenCalledWith(inputFleName);

	expect(spyWrite).toHaveBeenCalledTimes(1);
	expect(spyWrite).toHaveBeenNthCalledWith(1, outputFilename, output);

	expect(skyConsole).toHaveBeenCalledTimes(3);
	expect(skyConsole).toHaveBeenCalledWith("Found 10 entries");
	expect(skyConsole).toHaveBeenCalledWith("1 ignored");
	expect(skyConsole).toHaveBeenCalledWith("9 exported");
});
