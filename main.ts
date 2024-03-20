/** Command line tool that returns all information as it becomes available */

import SynoGroup, { JustifiedSynonym, SparqlEndpoint } from "./SynonymGroup.ts";
import * as Colors from "https://deno.land/std/fmt/colors.ts";

const sparqlEndpoint = new SparqlEndpoint(
  "https://treatment.ld.plazi.org/sparql",
);
const taxonName = Deno.args.length > 0
  ? Deno.args.join(" ")
  : "Sadayoshia acroporae";
const synoGroup = new SynoGroup(sparqlEndpoint, taxonName);

console.log(Colors.blue(`Synonym Group For ${taxonName}`));
try {
  for await (const synonym of synoGroup) {
    console.log(
      Colors.red(
        ` * Found synonym: ${tcName(synonym)} <${synonym.taxonConceptUri}>`,
      ),
    );

    (async () => {
      for await (const justification of synonym.justifications) {
        console.log(
          Colors.magenta(
            ` - Found justification for ${tcName(synonym)}: ${justification}`,
          ),
        );
      }
    })();
    (async () => {
      for await (const treatment of synonym.treatments!.aug) {
        console.log(
          Colors.gray(
            ` - Found augmenting treatment for ${
              tcName(synonym)
            }: ${treatment.url}`,
          ),
        );
        treatment.materialCitations.then((mcs) => {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                mcs.map((mc) => mc.catalogNumber).join(", ")
              }`,
            ),
          );
        });
      }
    })();
    (async () => {
      for await (const treatment of synonym.treatments.def) {
        console.log(
          Colors.gray(
            ` - Found defining treatment for ${
              tcName(synonym)
            }: ${treatment.url}`,
          ),
        );
        treatment.materialCitations.then((mcs) => {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                mcs.map((mc) => mc.catalogNumber).join(", ")
              }`,
            ),
          );
        });
      }
    })();
    (async () => {
      for await (const treatment of synonym.treatments.dpr) {
        console.log(
          Colors.gray(
            ` - Found deprecating treatment for ${
              tcName(synonym)
            }: ${treatment.url}`,
          ),
        );
        treatment.materialCitations.then((mcs) => {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                mcs.map((mc) => mc.catalogNumber).join(", ")
              }`,
            ),
          );
        });
      }
    })();
  }
} catch (error) {
  console.error(Colors.red(error + ""));
}

function tcName(synonym: JustifiedSynonym) {
  if (synonym.taxonConceptAuthority) {
    const name = synonym.taxonNameUri.replace(
      "http://taxon-name.plazi.org/id/",
      "",
    );
    return name.replaceAll("_", " ") + " " + synonym.taxonConceptAuthority;
  }
  const suffix = synonym.taxonConceptUri.replace(
    "http://taxon-concept.plazi.org/id/",
    "",
  );
  return suffix.replaceAll("_", " ");
}
