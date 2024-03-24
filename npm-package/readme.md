# SynoGroup NPM Package

This folder contains all the neccesary tools to generate and publish a NPM package containing the synogroup library.

Generate npm package code with
```sh
deno run -A build.ts <version number>
```

publish using
```sh
cd npm
npm publish
```

## Prerequisites

1. Deno
2. You need to be logged in to NPM with an account that can publish "@factsmission/synogroup"