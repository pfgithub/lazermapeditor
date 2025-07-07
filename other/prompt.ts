const sourceForm = document.getElementById("source-form")! as HTMLFormElement;
const resultForm = document.getElementById("result-form")! as HTMLFormElement;
const resultFormDialog = document.getElementById("result-form-dialog") as HTMLDialogElement;

sourceForm.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(sourceForm);
    const files = await fetch("/prompt.txt");
    if(files.status !== 200) return alert("error " +files.status);
    const filesText = await files.text();
    const prompt = formData.get("prompt");
    const total = `<prompt>\n${prompt}\n</prompt>\n${filesText}`;
    await navigator.clipboard.writeText(total);
    resultFormDialog.show();
})
resultForm.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(resultForm);
    const resp = await fetch("/apply", {
        method: "POST",
        body: formData,
    });
    if(resp.status !== 200) return alert("error " +resp.status);
    resultFormDialog.close();
});