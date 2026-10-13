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

Params:

```
deno run --allow-net ./example/cli.ts [--json] [--ignore-deprecated-col] [--subtaxa] [--server=<url>] <query>
```

#### JSON-Lines output

The example CLI also outputs information about the names in JSON-Lines format to
_stderr_ if given the `--json` flag.

(Output to stdout is the same, human-readable output. Having JSON on stderr is
mainly to avoid picking up other log messages from synolib, such as "Skipping
known" and "failed fetch. Retrying")

Example usage:

```sh
deno run --allow-net ./example/cli.ts --json --ignore-deprecated-col Sadayoshia acamar 2>&1 >/dev/null | jq
```

Format: Each line represents a name or authorized name, using the following
fields:

```ts
type name = {
  "name": string,
  "taxonNameURI"?: string (url),
  "colURI"?: string (url),
  "acceptedColURI"?: string (url),
  "treatments": { "treatment": string (url), "year": number, "kind": "aug"|"cite" }[],
}
type authorizedName = {
  "name": string,
  "taxonConceptURIs": string[], // urls -- possibly empty
  "colURI"?: string (url),
  "acceptedColURI"?: string (url),
  "treatments": { "treatment": string (url), "year": number, "kind": "def"|"aug"|"dpr"|"cite" }[],
}
```

The array of treatments is sorted bythe year.

### Web

An example running in the browser is located in `example/index.html` and
`example/index.ts`.

To build the example, use

```sh
deno task example_build
```

or for a live-reloading server use

```sh
deno task example_serve
```

The example page uses query parameters for options:

- `q=TAXON` for the search term (Latin name, CoL-URI, taxon-name-URI or
  taxon-concept-URI)
- `show_col=` to include many more CoL taxa
- `subtaxa=` to include subtaxa of the search term
- `server=URL` to configure the sparql endpoint

e.g. http://localhost:8000/?q=Sadayoshia%20miyakei&show_col=

## Building for npm/web

The library is to be published as-is (in typescript) to jsr.io.

It can be used from there in with other deno or node/npm projects. There is no
building step neccesary on our side.
