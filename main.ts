/** Command line tool that returns all information as it becomes available */

import SynoGroup, {
  JustifiedSynonym,
  SparqlEndpoint,
  TaxonName,
} from "./SynonymGroup.ts";
import * as Colors from "https://deno.land/std@0.214.0/fmt/colors.ts";

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
        ` * Found synonym: ${tcName(synonym)} <${synonym.taxonConceptUri}>${
          synonym.colID.length
            ? ` [CoL: ${
              synonym.colID.map((id) =>
                id.replace("https://www.catalogueoflife.org/data/taxon/", "")
              ).join(", ")
            }]`
            : ""
        }`,
      ),
    );
    console.log(
      Colors.blue(
        `   ... with taxon name: ${
          tnName(synonym.taxonName)
        } <${synonym.taxonName.uri}>`,
      ),
    );
    synonym.taxonName.vernacularNames.then((v) => {
      if (Object.getOwnPropertyNames(v).length) console.log(JSON.stringify(v));
    });
    for (const treatment of synonym.taxonName.treatments.aug) {
      console.log(
        Colors.gray(
          ` - Found treatment for ${
            tnName(synonym.taxonName)
          }: ${treatment.url}`,
        ),
      );
      treatment.details.then((details) => {
        if (details.materialCitations.length) {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                details.materialCitations.map((mc) => mc.catalogNumber).join(
                  ", ",
                )
              }`,
            ),
          );
        }
      });
    }
    for (const treatment of synonym.taxonName.treatments.cite) {
      console.log(
        Colors.gray(
          ` - Found treatment citing ${
            tnName(synonym.taxonName)
          }: ${treatment.url}`,
        ),
      );
      treatment.details.then((details) => {
        if (details.materialCitations.length) {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                details.materialCitations.map((mc) => mc.catalogNumber).join(
                  ", ",
                )
              }`,
            ),
          );
        }
      });
    }

    for await (const justification of synonym.justifications) {
      console.log(
        Colors.magenta(
          ` - Found justification for ${tcName(synonym)}: ${justification}`,
        ),
      );
    }
    for (const treatment of synonym.treatments!.aug) {
      console.log(
        Colors.gray(
          ` - Found augmenting treatment for ${
            tcName(synonym)
          }: ${treatment.url}`,
        ),
      );
      treatment.details.then((details) => {
        if (details.materialCitations.length) {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                details.materialCitations.map((mc) => mc.catalogNumber).join(
                  ", ",
                )
              }`,
            ),
          );
        }
      });
    }
    for (const treatment of synonym.treatments.def) {
      console.log(
        Colors.gray(
          ` - Found defining treatment for ${
            tcName(synonym)
          }: ${treatment.url}`,
        ),
      );
      treatment.details.then((details) => {
        if (details.materialCitations.length) {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                details.materialCitations.map((mc) => mc.catalogNumber).join(
                  ", ",
                )
              }`,
            ),
          );
        }
      });
    }
    for (const treatment of synonym.treatments.dpr) {
      console.log(
        Colors.gray(
          ` - Found deprecating treatment for ${
            tcName(synonym)
          }: ${treatment.url}`,
        ),
      );
      treatment.details.then((details) => {
        if (details.materialCitations.length) {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                details.materialCitations.map((mc) => mc.catalogNumber).join(
                  ", ",
                )
              }`,
            ),
          );
        }
      });
    }
    for (const treatment of synonym.treatments.cite) {
      console.log(
        Colors.gray(
          ` - Found treatment citing ${tcName(synonym)}: ${treatment.url}`,
        ),
      );
      treatment.details.then((details) => {
        if (details.materialCitations.length) {
          console.log(
            Colors.gray(
              `   - Found MCS for ${treatment.url}: ${
                details.materialCitations.map((mc) => mc.catalogNumber).join(
                  ", ",
                )
              }`,
            ),
          );
        }
      });
    }
  }
} catch (error) {
  console.error(Colors.red(error + ""));
}

function tcName(synonym: JustifiedSynonym) {
  if (synonym.taxonConceptAuthority) {
    const name = synonym.taxonName.displayName || synonym.taxonName.uri.replace(
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

function tnName(taxonName: TaxonName) {
  const name = taxonName.displayName || taxonName.uri.replace(
    "http://taxon-name.plazi.org/id/",
    "",
  ).replaceAll("_", " ");
  return name;
}
