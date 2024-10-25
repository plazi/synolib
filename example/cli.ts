import * as Colors from "https://deno.land/std@0.214.0/fmt/colors.ts";
import { SparqlEndpoint, SynonymGroup, Treatment } from "../mod.ts";

const sparqlEndpoint = new SparqlEndpoint(
  "https://treatment.ld.plazi.org/sparql",
);
const taxonName = Deno.args.length > 0
  ? Deno.args.join(" ")
  : "https://www.catalogueoflife.org/data/taxon/3CP83";
const synoGroup = new SynonymGroup(sparqlEndpoint, taxonName);

console.log(Colors.blue(`Synonym Group For ${taxonName}`));
for await (const name of synoGroup) {
  console.log(
    Colors.underline(name.displayName) +
      colorizeIfPresent(name.taxonNameURI, "yellow"),
  );
  for (const trt of name.treatments.treats) {
    console.log(Colors.blue("  ● ") + await treatmentToString(trt));
  }
  for (const trt of name.treatments.cite) {
    console.log(Colors.gray("  ● ") + await treatmentToString(trt));
  }
  // TODO justification
  for (const authorizedName of name.authorizedNames) {
    console.log(
      "  " +
        Colors.underline(
          authorizedName.displayName + " " +
            Colors.italic(authorizedName.authority),
        ) +
        colorizeIfPresent(authorizedName.taxonConceptURI, "yellow") +
        colorizeIfPresent(authorizedName.colURI, "cyan"),
    );
    for (const trt of authorizedName.treatments.def) {
      console.log(Colors.green("    ● ") + await treatmentToString(trt));
    }
    for (const trt of authorizedName.treatments.aug) {
      console.log(Colors.blue("    ● ") + await treatmentToString(trt));
    }
    for (const trt of authorizedName.treatments.dpr) {
      console.log(Colors.red("    ● ") + await treatmentToString(trt));
    }
    for (const trt of authorizedName.treatments.cite) {
      console.log(Colors.gray("    ● ") + await treatmentToString(trt));
    }
    // TODO justification
  }
}

function colorizeIfPresent(
  text: string | undefined,
  color: "gray" | "yellow" | "green" | "cyan",
) {
  if (text) return " " + Colors[color](text);
  else return "";
}

async function treatmentToString(trt: Treatment) {
  const details = await trt.details;
  return `${details.creators} ${details.date} “${
    Colors.italic(details.title || Colors.dim("No Title"))
  }” ${Colors.magenta(trt.url)}`;
}
