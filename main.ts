/** Command line tool that returns all information as it becomes available */

import SynoGroup, { SparqlEndpoint } from "./SynonymGroup.ts";
import * as Colors from "https://deno.land/std/fmt/colors.ts";

const sparqlEndpoint = new SparqlEndpoint(
  "https://treatment.ld.plazi.org/sparql",
);
const taxonName = "Sadayoshia acroporae";
const synoGroup = new SynoGroup(sparqlEndpoint, taxonName);

console.log(Colors.blue(`Synonym Group For ${taxonName}`));
for await (const synonym of synoGroup) {

  console.log(Colors.red(` * Found synonym: ${synonym.taxonConceptUri}`));

  (async () => {
    for await (const justification of synonym.justifications) {
      console.log(Colors.magenta(` - Found justification for ${synonym.taxonConceptUri}: ${justification}`));
    }
  })();
  (async () => {
    for await (const treatment of synonym.treatments!.aug) {
      console.log(Colors.gray(` - Found augmenting treatment for ${synonym.taxonConceptUri}: ${treatment.url}`));
    }
  })();
  (async () => {
    for await (const treatment of synonym.treatments.def) {
      console.log(Colors.gray(` - Found defining treatment for ${synonym.taxonConceptUri}: ${treatment.url}`));
    }
  })();
  (async () => {
    for await (const treatment of synonym.treatments.dpr) {
      console.log(Colors.gray(` - Found deprecating treatment for ${synonym.taxonConceptUri}: ${treatment.url}`));
    }
  })();
}
