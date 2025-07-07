import { readdirSync, readFileSync } from "node:fs";
import { extname } from "node:path";

export function genViewerPrompt(): string {
	let sourceFileList: string = "";
	let sourceFileContents: string = "";
	const all = readdirSync(`${import.meta.dir}/src`, { recursive: true })
		.filter((q) => typeof q === "string")
		.map((q) => q.replaceAll("\\", "/"));
	const sort: { name: string; length: number }[] = [];
	for (const file of all.sort()) {
		let contents: string;
		try {
			contents = readFileSync(`${import.meta.dir}/src/${file}`, "utf-8");
		} catch (_e) {
			continue;
		}
		const omitted = false;
		sourceFileList += omitted ? `- src/${file} (Omitted)\n` : `- src/${file}\n`;
		if (omitted) continue;
		sourceFileContents += `<source-file name="src/${file}">\n`;
		sourceFileContents += contents;
		sourceFileContents += "\n</source-file>\n";
		sort.push({ name: file, length: contents.length });
	}
	sort.sort((a, b) => a.length - b.length);
	console.log(sort.map((l) => `${l.length}: ${l.name}`).join("\n"));
	return `<source-file-list>\n${sourceFileList}</source-file-list>\n${sourceFileContents}\n<output-format>\nIMPORTANT: Output each affected file in one of the tags:\n- <create-file path="path/to/file">...full file contents</create-file>\n- <update-file path="path/to/file">...full file contents</update-file>\n- <delete-file path="path/to/file" />\n</output-format>\n`;
}