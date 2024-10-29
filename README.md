# synogroup

A js module to get potential synonyms of a taxon name, the justifications for
such synonymity and treatments about these taxon names or the respective taxa.

## Examples

### Command-Line

For a command line example using the library see: `example/cli.ts`.

You can try it locally using Deno with

```sh
deno run --allow-net ./example/cli.ts Ludwigia adscendens
# or
deno run --allow-net ./example/cli.ts http://taxon-name.plazi.org/id/Plantae/Ludwigia_adscendens
# or
deno run --allow-net ./example/cli.ts http://taxon-concept.plazi.org/id/Plantae/Ludwigia_adscendens_Linnaeus_1767
# or
deno run --allow-net ./example/cli.ts https://www.catalogueoflife.org/data/taxon/3WD9M
```

(replace the argument with whatever name interests you)

### Web

An example running in the browser is located in `example/index.html` and
`example/index.ts`.

To build the example, use

```sh
npm run example
```

or for a live-reloading server use

```sh
npm run example serve
```

(Both require `npm install` first)

The example page uses query parameters for options:

- `q=TAXON` for the search term (Latin name, CoL-URI, taxon-name-URI or
  taxon-concept-URI)
- `show_col=` to include many more CoL taxa
- `subtaxa=` to include subtaxa of the search term
- `server=URL` to configure the sparql endpoint

e.g. http://localhost:8000/?q=Sadayoshia%20miyakei&show_col=

## Building for npm/web

To build the library for use in web projects, use

```sh
npm run build
```

This will place the built library in `./build/mod.js`.

Note that this does not (yet) generate `.d.ts` typings.

(Requires `npm install` first)
