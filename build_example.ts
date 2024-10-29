import * as esbuild from "esbuild";

const SERVE = Deno.args.includes("serve");
const BUILD = Deno.args.includes("build");

const config: esbuild.BuildOptions = {
  entryPoints: ["./example/index.ts"],
  outfile: "./example/index.js",
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
  const ctx = await esbuild.context(config);
  await ctx.watch();

  const { host, port } = await ctx.serve({
    servedir: "./example",
  });

  console.log(`Listening at ${host}:${port}`);
} else {
  await esbuild.build(config);
}
