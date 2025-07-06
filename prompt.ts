import { readdirSync, readFileSync } from "node:fs";
import { extname } from "node:path";

export function genViewerPrompt(): string {
	let allFiles: string = "";
	allFiles += "# All files\n\n";
	let res: string = "";
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
		const omitted = file.startsWith("data/");
		allFiles += omitted ? `- src/${file} (Omitted)\n` : `- src/${file}\n`;
		if (omitted) continue;
		res += `# src/${file}\n\n`;
		res += `\`\`\`${extname(file).slice(1)}\n`;
		res += contents;
		res += "\n```\n\n";
		sort.push({ name: file, length: contents.length });
	}
	sort.sort((a, b) => a.length - b.length);
	console.log(sort.map((l) => `${l.length}: ${l.name}`).join("\n"));
	return `${allFiles}\n${res}\n\n# Output Format\n\nOutput the affected files. Do not output diffs. You can add, modify, and delete files.`;
}