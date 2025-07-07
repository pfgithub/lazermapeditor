import {
	writeFileSync,
	mkdirSync,
	unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

interface FileOperation {
	type: "create" | "update" | "delete";
	path: string;
	content?: string;
}

function parseOutput(output: string): FileOperation[] {
	const operations: FileOperation[] = [];

	const regex =
		/<(create-file|update-file|delete-file) path="([^"]+)"(?:\s*\/>|>([\s\S]*?)<\/\1>)/g;

	for (const match of output.matchAll(regex)) {
		const [, rawTag, path, content] = match;

		// The content might have leading/trailing newlines from the AI's formatting,
		// so we trim them. The first and last line of the content block specifically.
		const cleanedContent = content
			? content.replace(/^\s*\n|\n\s*$/g, "")
			: undefined;

		switch (rawTag) {
			case "create-file":
				operations.push({ type: "create", path, content: cleanedContent + "\n" });
				break;
			case "update-file":
				operations.push({ type: "update", path, content: cleanedContent + "\n" });
				break;
			case "delete-file":
				operations.push({ type: "delete", path });
				break;
		}
	}

	return operations;
}

function applyChanges(operations: FileOperation[]): void {
    let success = true;

	console.log(`Found ${operations.length} operation(s). Applying changes...`);

	for (const op of operations) {
		const dir = dirname(op.path);

        if(op.type === "create" || op.type === "update") {
            console.log(`[${op.type.toUpperCase()}] ${op.path}`);
            try {
                mkdirSync(dir, { recursive: true });
                writeFileSync(op.path, op.content ?? "", "utf-8");
            } catch (error) {
                console.error(`Failed to ${op.type} file: ${op.path}`, error);
                success = false;
            }
        }else if(op.type === "delete") {
            console.log(`[DELETE] ${op.path}`);
            try {
                unlinkSync(op.path);
            } catch (error) {
                console.error(`Failed to delete file: ${op.path}`, error);
                success = false;
            }
        }
	}

    if(!success) throw new Error("Some failures");
	console.log(`\nAll changes applied.`);
}

export function apply(prompt: string, output: string): void {
    // TODO: check if there are any git changes. if there are, abort
    applyChanges(parseOutput(output));
    // TODO: commit with message `[P] ${prompt}`
}
