import * as esbuild from "esbuild";

const BUILD = false;

await esbuild.build({
  entryPoints: ["../mod.ts"],
  sourcemap: true,
  bundle: true,
  format: "esm",
  lineLimit: 120,
  minify: BUILD ? true : false,
  outfile: "./build/mod.js",
});
