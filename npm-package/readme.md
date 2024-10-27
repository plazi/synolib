# SynoGroup NPM Package

This folder contains all the neccesary tools to generate and publish a NPM
package containing the synogroup library.

(If you’re reading this on npmjs.com, read the actual readme in the parent
repository linked to the left for more Information about Synogroup itself)

## How to

```bash
# (from within this folder)
npm install # install tsc for the declaration file
npm version patch # or ensure that the version number differs from the last published version otherwise
# npm run publish-package # generates and publishes npm package
npm run build
```

**Note that the generated types are currently possibly broken, please check!
manually remove `import`s from `index.d.ts` before publishing**

```bash
# npm publish --access public
```

## Testing (-ish)

```bash
npm run build
```

Generates the package code (index.js & index.d.ts) without publishing.

## Prerequiites

2. You need to be logged in to NPM with an account that can publish
   "@factsmission/synogroup"
3.
