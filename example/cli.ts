import * as Colors from "https://deno.land/std@0.214.0/fmt/colors.ts";
import { SparqlEndpoint, SynonymGroup, Treatment } from "../mod.ts";

const sparqlEndpoint = new SparqlEndpoint(
  "https://treatment.ld.plazi.org/sparql",
);
const taxonName = Deno.args.length > 0
  ? Deno.args.join(" ")
  : "https://www.catalogueoflife.org/data/taxon/3WD9M"; // "https://www.catalogueoflife.org/data/taxon/4P523";
const synoGroup = new SynonymGroup(sparqlEndpoint, taxonName);

const trtColor = {
  "def": Colors.green,
  "aug": Colors.blue,
  "dpr": Colors.red,
  "cite": Colors.gray,
};

console.log(Colors.blue(`Synonym Group For ${taxonName}`));

let authorizedNamesCount = 0;
const timeStart = performance.now();

for await (const name of synoGroup) {
  console.log(
    "\n" +
      Colors.underline(name.displayName) +
      colorizeIfPresent(name.taxonNameURI, "yellow"),
  );
  for (const trt of name.treatments.treats) await logTreatment(trt, "aug");
  for (const trt of name.treatments.cite) await logTreatment(trt, "cite");

  // TODO justification
  for (const authorizedName of name.authorizedNames) {
    authorizedNamesCount++;
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
      await logTreatment(trt, "def");
    }
    for (const trt of authorizedName.treatments.aug) {
      await logTreatment(trt, "aug");
    }
    for (const trt of authorizedName.treatments.dpr) {
      await logTreatment(trt, "dpr");
    }
    for (const trt of authorizedName.treatments.cite) {
      await logTreatment(trt, "cite");
    }
    // TODO justification
  }
}

const timeEnd = performance.now();

console.log(
  "\n" +
    Colors.bgYellow(
      `Found ${synoGroup.names.length} names (${authorizedNamesCount} authorized names) and ${synoGroup.treatments.size} treatments. This took ${
        timeEnd - timeStart
      } milliseconds.`,
    ),
);

function colorizeIfPresent(
  text: string | undefined,
  color: "gray" | "yellow" | "green" | "cyan",
) {
  if (text) return " " + Colors[color](text);
  else return "";
}

async function logTreatment(
  trt: Treatment,
  type: "def" | "aug" | "dpr" | "cite",
) {
  const details = await trt.details;
  console.log(
    `    ${trtColor[type]("●")} ${details.creators} ${details.date} “${
      Colors.italic(details.title || Colors.dim("No Title"))
    }” ${Colors.magenta(trt.url)}`,
  );
  if (type !== "def" && details.treats.def.size > 0) {
    console.log(
      `      → ${trtColor.def("●")} ${
        Colors.magenta(
          [...details.treats.def.values()].join(", "),
        )
      }`,
    );
  }
  if (
    type !== "aug" &&
    (details.treats.aug.size > 0 || details.treats.treattn.size > 0)
  ) {
    console.log(
      `      → ${trtColor.aug("●")} ${
        Colors.magenta(
          [...details.treats.aug.values(), ...details.treats.treattn.values()]
            .join(", "),
        )
      }`,
    );
  }
  if (type !== "dpr" && details.treats.dpr.size > 0) {
    console.log(
      `      → ${trtColor.dpr("●")} ${
        Colors.magenta(
          [...details.treats.dpr.values()].join(", "),
        )
      }`,
    );
  }
}
