import { SynonymGroup } from "../SynonymGroup.ts";
import type { SparqlEndpoint } from "../SparqlEndpoint.ts";
import { assert } from "jsr:@std/assert";

/** An endpoint without data that records the queries it receives. */
function recordingEndpoint(queries: string[]): SparqlEndpoint {
  return {
    getSparqlResultSet: (query: string) => {
      queries.push(query);
      return Promise.resolve({ head: { vars: [] }, results: { bindings: [] } });
    },
  } as unknown as SparqlEndpoint;
}

async function queriesFor(searchTerm: string): Promise<string[]> {
  const queries: string[] = [];
  const group = new SynonymGroup(recordingEndpoint(queries), searchTerm);
  while (!group.isFinished) await new Promise((r) => setTimeout(r, 10));
  return queries;
}

// Plazi mints its taxon IRIs with https since plazi/gg2rdf#34; links and
// bookmarks may still carry the older http form.
for (
  const iri of [
    "https://taxon-concept.plazi.org/id/Animalia/Tyrannosaurus_rex_Osborn_1905",
    "http://taxon-concept.plazi.org/id/Animalia/Tyrannosaurus_rex_Osborn_1905",
    "https://taxon-name.plazi.org/id/Animalia/Tyrannosaurus_rex",
    "http://taxon-name.plazi.org/id/Animalia/Tyrannosaurus_rex",
  ]
) {
  Deno.test(`a taxon IRI is accepted as search term: ${iri}`, async () => {
    const queries = await queriesFor(iri);
    assert(
      queries.some((q) => q.includes(`<${iri}>`)),
      "the IRI is queried, not parsed as a latin name",
    );
  });
}
