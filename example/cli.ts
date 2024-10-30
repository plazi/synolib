import * as Colors from "https://deno.land/std@0.214.0/fmt/colors.ts";
import {
  type Name,
  SparqlEndpoint,
  SynonymGroup,
  type Treatment,
} from "../mod.ts";

const HIDE_COL_ONLY_SYNONYMS = true;
const START_WITH_SUBTAXA = false;
const ENDPOINT_URL = "https://treatment.ld.plazi.org/sparql";
// const ENDPOINT_URL = "https://lindas-cached.cluster.ldbar.ch/query"; // is missing some CoL-data

const sparqlEndpoint = new SparqlEndpoint(ENDPOINT_URL);
const taxonName = Deno.args.length > 0
  ? Deno.args.join(" ")
  : "https://www.catalogueoflife.org/data/taxon/3WD9M"; // "https://www.catalogueoflife.org/data/taxon/4P523";
const synoGroup = new SynonymGroup(
  sparqlEndpoint,
  taxonName,
  HIDE_COL_ONLY_SYNONYMS,
  START_WITH_SUBTAXA,
);

const trtColor = {
  "def": Colors.green,
  "aug": Colors.blue,
  "dpr": Colors.red,
  "cite": Colors.gray,
};

console.log(ENDPOINT_URL);

console.log(Colors.blue(`Synonym Group For ${taxonName}`));

let authorizedNamesCount = 0;
const timeStart = performance.now();

for await (const name of synoGroup) {
  console.log(
    "\n" +
      Colors.underline(name.displayName) +
      colorizeIfPresent(name.taxonNameURI, "yellow"),
  );
  const vernacular = await name.vernacularNames;
  if (vernacular.size > 0) {
    console.log("    “" + [...vernacular.values()].join("”, “") + "”");
  }

  await logJustification(name);
  for (const trt of name.treatments.treats) await logTreatment(trt, "aug");
  for (const trt of name.treatments.cite) await logTreatment(trt, "cite");

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
    if (authorizedName.colURI) {
      if (authorizedName.acceptedColURI !== authorizedName.colURI) {
        console.log(
          `    ${trtColor.dpr("●")} Catalogue of Life\n      → ${
            trtColor.aug("●")
          } ${Colors.cyan(authorizedName.acceptedColURI!)}`,
        );
      } else {
        console.log(
          `    ${trtColor.aug("●")} Catalogue of Life`,
        );
      }
    }
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
// console.log(
//   `Ran ${sparqlEndpoint.reasons.length} queries:\n  ${
//     sparqlEndpoint.reasons.sort().join("\n  ")
//   }`,
// );

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
    `    ${trtColor[type]("●")} ${details.creators} ${trt.date} “${
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

async function logJustification(name: Name) {
  const just = await justify(name);
  console.log(Colors.dim(`    (This ${just})`));
}

async function justify(name: Name): Promise<string> {
  if (name.justification.searchTerm) {
    if (name.justification.subTaxon) {
      return "is a sub-taxon of the search term.";
    } else return "is the search term.";
  } else if (name.justification.treatment) {
    const details = await name.justification.treatment.details;
    const parent = await justify(name.justification.parent);
    return `is, according to ${
      Colors.italic(
        `${details.creators} ${name.justification.treatment.date} “${
          Colors.italic(details.title || Colors.dim("No Title"))
        }” ${Colors.magenta(name.justification.treatment.url)}`,
      )
    },\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
  } else {
    const parent = await justify(name.justification.parent);
    return `is, according to the Catalogue of Life,\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
  }
}
