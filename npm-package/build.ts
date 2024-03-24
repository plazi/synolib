// ex. scripts/build_npm.ts
import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["../SynonymGroup.ts"],
  outDir: "./npm",
  test: false,
  scriptModule: false,
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  compilerOptions: {
    lib: [
      "ESNext",
      "DOM",
      "DOM.Iterable",
      "ScriptHost"
    ],
    target: "Latest",
  },
  package: {
    "name": "@factsmission/synogroup",
    "version": Deno.args[0],
    "description": "",
    "main": "index.js",
    "repository": {
      "type": "git",
      "url": "git+https://github.com/factsmission/synogroup.git"
    },
    "author": "",
    "license": "MIT",
    "bugs": {
      "url": "https://github.com/factsmission/synogroup/issues"
    },
    "homepage": "https://github.com/factsmission/synogroup#readme",
    "devDependencies": {
      "typescript": "^4.4.2"
    }
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("../LICENSE", "npm/LICENSE");
    Deno.copyFileSync("../README.md", "npm/README.md");
  },
});