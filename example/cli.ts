import * as Colors from "jsr:@std/fmt@0.214.0/colors";
import { parseArgs } from "jsr:@std/cli";

import {
  type Name,
  SparqlEndpoint,
  SynonymGroup,
  type Treatment,
} from "../mod.ts";

const args = parseArgs(Deno.args, {
  boolean: ["json", "ignore-deprecated-col", "subtaxa"],
  string: ["server", "q"],
  negatable: ["ignore-deprecated-col"],
  default: {
    server: "https://treatment.ld.plazi.org/sparql",
  },
});

const taxonName = args.q || args._.join(" ") ||
  "https://www.catalogueoflife.org/data/taxon/3WD9M";

const encoder = new TextEncoder();
function outputStderr(msg: string) {
  const data = encoder.encode(msg + "\n");
  Deno.stderr.writeSync(data);
}

console.log(
  Colors.blue(`Synonym Group For ${taxonName}`) +
    Colors.dim(` (Server: ${args.server})`),
);

const sparqlEndpoint = new SparqlEndpoint(args.server);
const synoGroup = new SynonymGroup(
  sparqlEndpoint,
  taxonName,
  args["ignore-deprecated-col"],
  args.subtaxa,
);

const trtColor = {
  "def": Colors.green,
  "aug": Colors.blue,
  "dpr": Colors.red,
  "cite": Colors.gray,
};

let authorizedNamesCount = 0;
const timeStart = performance.now();

for await (const name of synoGroup) {
  console.log(
    "\n" +
      Colors.bold(Colors.underline(name.displayName)) +
      colorizeIfPresent(name.taxonNameURI, "yellow") +
      colorizeIfPresent(name.col?.colURI, "yellow"),
  );
  const vernacular = await name.vernacularNames;
  if (vernacular.size > 0) {
    console.log("    “" + [...vernacular.values()].join("”, “") + "”");
  }

  if (args.json) {
    outputStderr(JSON.stringify({
      name: name.displayName,
      taxonNameURI: name.taxonNameURI,
      colURI: name.col?.colURI,
      acceptedColURI: name.col?.acceptedURI,
      treatments: [
        ...name.treatments.treats.values().map((trt) => {
          return { treatment: trt.url, year: trt.date ?? 0, kind: "aug" };
        }),
        ...name.treatments.cite.values().map((trt) => {
          return { treatment: trt.url, year: trt.date ?? 0, kind: "cite" };
        }),
      ].sort((a, b) => a.year - b.year),
    }));
  }

  await logJustification(name);

  if (name.col) {
    const acceptedColURI = name.col.acceptedURI;
    if (acceptedColURI !== name.col.colURI) {
      console.log(
        `    ${trtColor.dpr("●")} Catalogue of Life\n      → ${
          trtColor.aug("●")
        } ${Colors.cyan(acceptedColURI)}`,
      );
    } else {
      console.log(
        `    ${trtColor.aug("●")} Catalogue of Life`,
      );
    }
  }
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
        colorizeIfPresent(authorizedName.taxonConceptURIs.join(), "yellow") +
        colorizeIfPresent(authorizedName.col?.colURI, "cyan"),
    );
    const auths = authorizedName.authorities.filter((auth) =>
      auth != authorizedName.authority
    );
    if (auths.length > 1) {
      console.log(
        Colors.dim(
          `      (Authority also given as: “${auths.join("”, “")}”)`,
        ),
      );
    }

    if (args.json) {
      outputStderr(JSON.stringify({
        name: authorizedName.displayName + " " + authorizedName.authority,
        taxonNameURIs: authorizedName.taxonConceptURIs,
        colURI: authorizedName.col?.colURI,
        acceptedColURI: authorizedName.col?.acceptedURI,
        treatments: [
          ...authorizedName.treatments.def.values().map((trt) => {
            return { treatment: trt.url, year: trt.date ?? 0, kind: "def" };
          }),
          ...authorizedName.treatments.aug.values().map((trt) => {
            return { treatment: trt.url, year: trt.date ?? 0, kind: "aug" };
          }),
          ...authorizedName.treatments.dpr.values().map((trt) => {
            return { treatment: trt.url, year: trt.date ?? 0, kind: "dpr" };
          }),
          ...authorizedName.treatments.cite.values().map((trt) => {
            return { treatment: trt.url, year: trt.date ?? 0, kind: "cite" };
          }),
        ].sort((a, b) => a.year - b.year),
      }));
    }

    if (authorizedName.col) {
      const acceptedColURI = authorizedName.col.acceptedURI;
      if (acceptedColURI !== authorizedName.col.colURI) {
        console.log(
          `    ${trtColor.dpr("●")} Catalogue of Life\n      → ${
            trtColor.aug("●")
          } ${Colors.cyan(acceptedColURI)}`,
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
