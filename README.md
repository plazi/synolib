# synogroup

A js module to get potential synonyms of a taxon name, the justifications for
such synonymity and treatments about these taxon names or the respective taxa.

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

## building

Only for in-browser usage the code needs to be bundled

    deno bundle SynonymGroup.ts synonym-group.js
