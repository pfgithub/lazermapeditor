import tailwind from "bun-plugin-tailwind";
const result = await Bun.build({
  entrypoints: ["src/index.html"],
  plugins: [tailwind],
  outdir: "dist",
});
console.log(result.logs.join("\n"));
