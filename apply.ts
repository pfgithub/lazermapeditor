import {
	writeFileSync,
	mkdirSync,
	unlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";

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
			? content.replace(/^\s*\n(```.+?\n)?|(\n```)?\n\s*$/g, "")
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

    if(!success) throw new Error("Some file operations failed.");
	console.log(`\nAll changes applied to the filesystem.`);
}

export function apply(prompt: string, output: string): void {
    // Check if there are any git changes (unstaged or staged). if there are, abort.
    try {
        const gitStatus = execSync("git status --porcelain").toString();
        if (gitStatus.trim() !== "") {
            console.error(
                "Error: Git working directory is not clean. Please commit or stash your changes before proceeding."
            );
            throw new Error("Dirty git working directory.");
        }
    } catch (error) {
        console.error("Failed to check git status. Is git installed and are you in a git repository?", error);
        throw error;
    }

    const operations = parseOutput(output);
    
    if (operations.length === 0) {
        console.log("No file operations found in the output. Nothing to do.");
        return;
    }

    applyChanges(operations);

    // Commit with message `[P] ${prompt}`
    try {
        // Stage all changes (new, modified, deleted files). -A ensures deletions are included.
        execSync("git add -A");

        // Check if staging produced any changes.
        // This is important because applying changes might result in no actual modifications
        // (e.g., overwriting a file with identical content).
        const stagedStatus = execSync("git status --porcelain").toString();
        if (stagedStatus.trim() === "") {
            console.log("\nApplied changes resulted in no difference. Nothing to commit.");
            return;
        }

        // Commit the staged changes.
        // Using `-F -` and piping the message via `input` is the safest way to handle
        // arbitrary prompt content, including newlines and special shell characters.
        const commitMessage = `[P] ${prompt}`;
        execSync("git commit -F -", { input: commitMessage });

        console.log(`\nChanges committed successfully.`);

    } catch (error) {
        console.error("Failed to commit changes to git.", error);
        // If commit fails, you might want to unstage the changes
        // execSync("git reset");
        throw error;
    }
}