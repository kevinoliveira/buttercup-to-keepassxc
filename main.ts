import {
	createGroupIndex,
	entriesToKeepassxcFileContent,
	extractLineObjects,
	formatEntries,
	getArguments,
	logInformations,
	readAndParseButtercupCsv,
	splitEntryObjectLinesByDeletedStatus,
	writeKeepassXcCsvFile,
} from "./helpers";

async function main() {
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

main();
