import { parseArgs } from "util";
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const { values } = parseArgs({
	args: Bun.argv,
	options: { input: { type: 'string' }, output: { type: 'string' } },
	strict: true,
	allowPositionals: true,
});

if(!values.input || !values.output) throw Error("missing arguments")
	
type EntryParsed = Record<
	'id' | 'name' | 'username' | 'password' | 'totp' | 'group' | 'notes',
	string
>

const optRegex = /^otpauth:\/\/./

const bcup = parse(await Bun.file(values.input).text())

const headers = bcup[0].map(h => h.replace("!", ""))
const content = bcup.slice(1)

const linesObj = content.map(p =>
	p.reduce((acc, cur, index) => ({
		[headers[index]]: cur, ...acc
	}), {})
)

const groupIndex: Record<string, string> =
	linesObj.filter(lo => lo.type === "group")
		.reduce((acc, cur) => ({
			[cur.group_id]: cur.group_name, ...acc
		}), {})

const getExtraFields = (lineObject: Record<string, string>) => {
	const fieldsToIgnore = ['password', 'username', 'id', 'title', 'group_parent', 'group_name', 'group_id', 'type']
	const fields: Array<Record<'key' | 'value', string>> = []

	for (const prop in lineObject) {
		if (fieldsToIgnore.includes(prop)) continue
		fields.push({ key: prop, value: lineObject[prop] })
	}

	return fields.filter(f => f.value)
}

const entries: Array<EntryParsed> =
	linesObj.filter(lo => lo.type === "entry")
		.map(lo => ({ ...lo, group_name: groupIndex[lo.group_id] }))
		.map(lo => {
			const fields = getExtraFields(lo);

			const totpFields = fields.filter(f => optRegex.test(f.value))
			const totp = totpFields[0]?.value;

			const noteFields = fields.filter(f => !optRegex.test(f.value))
			const notes = noteFields.map(nf => `${nf.key} : ${nf.value}`).join("\n")

			return {
				id: lo.id,
				name: lo.title || null,
				password: lo.password || null,
				username: lo.username || null,
				group: lo.group_name || null,
				notes: notes || null,
				totp: totp || null,
			}
		})


const keepassHeaders = ['Group', 'Title', 'Username', 'Password', 'URL', 'Notes', 'TOTP', 'Icon', 'Last Modified', 'Created']
const output = stringify([
	keepassHeaders,
	...entries.map(e => [
		e.group,
		e.name,
		e.username,
		e.password,
		"",
		e.notes,
		e.totp,
		"0",
		new Date().toISOString(),
		new Date().toISOString()
	])
])

Bun.write(values.output, output)
console.log(`${entries.length} entries exported`)