const sourceForm = document.getElementById("source-form")! as HTMLFormElement;
const resultForm = document.getElementById("result-form")! as HTMLFormElement;
const resultFormDialog = document.getElementById("result-form-dialog") as HTMLDialogElement;
const closeDialogButton = document.getElementById("close-dialog")!;
const resultTextarea = document.getElementById("result-textarea") as HTMLTextAreaElement;

sourceForm.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(sourceForm);
    const files = await fetch("/prompt.txt");
    if(files.status !== 200) return alert("error " +files.status);
    const filesText = await files.text();
    const prompt = formData.get("prompt");
    const total = `<prompt>\n${prompt}\n</prompt>\n${filesText}`;
    await navigator.clipboard.writeText(total);
    resultTextarea.value = "";
    resultFormDialog.showModal();
});

resultForm.addEventListener("submit", async e => {
    e.preventDefault();
    const source = new FormData(sourceForm);
    const result = new FormData(resultForm);
    const merged = new FormData();
    merged.set("prompt", source.get("prompt"));
    merged.set("result", result.get("result"));
    const resp = await fetch("/api/apply", {
        method: "POST",
        body: merged,
    });
    if(resp.status !== 200) return alert("error " +resp.status);
    resultFormDialog.close();
});

// --- New code to handle closing the modal ---

// Close the dialog with the 'X' button
closeDialogButton.addEventListener("click", () => {
    resultFormDialog.close();
});

// Close the dialog when clicking on the backdrop
resultFormDialog.addEventListener("click", e => {
    if (e.target === resultFormDialog) {
        resultFormDialog.close();
    }
});

// Note: Pressing the 'Escape' key will also close the modal now,
// thanks to using showModal().