import * as esbuild from "esbuild";

const SERVE = process.argv.includes("serve");
const BUILD = process.argv.includes("build");
const EXAMPLE = process.argv.includes("example");

const config = {
  entryPoints: EXAMPLE ? ["./example/index.ts"] : ["./mod.ts"],
  outfile: EXAMPLE ? "./example/index.js" : "./build/mod.js",
  sourcemap: true,
  bundle: true,
  format: "esm",
  lineLimit: 120,
  minify: BUILD ? true : false,
  banner: SERVE
    ? {
      js:
        "new EventSource('/esbuild').addEventListener('change', () => location.reload());",
    }
    : undefined,
};

if (SERVE) {
  let ctx = await esbuild.context(config);
  await ctx.watch();

  const { host, port } = await ctx.serve({
    servedir: EXAMPLE ? "./example" : "./build",
  });

  console.log(`Listening at ${host}:${port}`);
} else {
  await esbuild.build(config);
}
