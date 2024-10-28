/// <reference lib="dom" />
import {
  type Name,
  SparqlEndpoint,
  SynonymGroup,
  type Treatment,
} from "../mod.ts";

const params = new URLSearchParams(document.location.search);
const HIDE_COL_ONLY_SYNONYMS = !params.has("show_col");
const START_WITH_SUBTAXA = params.has("subtaxa");
const ENDPOINT_URL = params.get("server") ||
  "https://treatment.ld.plazi.org/sparql";
const NAME = params.get("q") ||
  "https://www.catalogueoflife.org/data/taxon/3WD9M";

const root = document.getElementById("root") as HTMLDivElement;

class SynoTreatment extends HTMLElement {
  constructor(trt: Treatment) {
    super();

    const li = document.createElement("li");
    li.innerText = trt.url;
    this.append(li);
    trt.details.then((details) =>
      li.innerText = `${details.creators} ${details.date} “${
        details.title || "No Title"
      }” ${trt.url}`
    );
  }
}
customElements.define("syno-treatment", SynoTreatment);

class SynoName extends HTMLElement {
  constructor(name: Name) {
    super();

    const title = document.createElement("h2");
    title.innerText = name.displayName;
    this.append(title);

    if (name.taxonNameURI) {
      const name_uri = document.createElement("code");
      name_uri.classList.add("taxon", "uri");
      name_uri.innerText = name.taxonNameURI.replace("http://", "");
      name_uri.title = name.taxonNameURI;
      title.append(" ", name_uri);
    }

    const justification = document.createElement("abbr");
    justification.classList.add("justification");
    justification.innerText = "...?";
    justify(name).then((just) => justification.title = `This ${just}`);
    title.append(" ", justification);

    const vernacular = document.createElement("code");
    vernacular.classList.add("vernacular");
    name.vernacularNames.then((names) => {
      if (names.size > 0) {
        vernacular.innerText = "“" + [...names.values()].join("”, “") + "”";
      }
    });
    this.append(vernacular);

    if (name.treatments.treats.size > 0 || name.treatments.cite.size > 0) {
      const treatments = document.createElement("ul");
      this.append(treatments);
      for (const trt of name.treatments.treats) {
        const li = new SynoTreatment(trt);
        li.classList.add("aug");
        treatments.append(li);
      }
      for (const trt of name.treatments.cite) {
        const li = new SynoTreatment(trt);
        li.classList.add("cite");
        treatments.append(li);
      }
    }

    for (const authorizedName of name.authorizedNames) {
      const authName = document.createElement("h3");
      authName.innerText = authorizedName.displayName + " " +
        authorizedName.authority;
      this.append(authName);

      const treatments = document.createElement("ul");
      this.append(treatments);

      if (authorizedName.taxonConceptURI) {
        const name_uri = document.createElement("code");
        name_uri.classList.add("taxon", "uri");
        name_uri.innerText = authorizedName.taxonConceptURI.replace(
          "http://",
          "",
        );
        name_uri.title = authorizedName.taxonConceptURI;
        authName.append(" ", name_uri);
      }
      if (authorizedName.colURI) {
        const col_uri = document.createElement("code");
        col_uri.classList.add("col", "uri");
        const id = authorizedName.colURI.replace(
          "https://www.catalogueoflife.org/data/taxon/",
          "",
        );
        col_uri.innerText = id;
        col_uri.id = id;
        col_uri.title = authorizedName.colURI;
        authName.append(" ", col_uri);

        const li = document.createElement("li");
        li.classList.add("treatment");
        li.innerText = "Catalogue of Life";
        treatments.append(li);

        if (authorizedName.acceptedColURI !== authorizedName.colURI) {
          li.classList.add("dpr");
          const col_uri = document.createElement("a");
          col_uri.classList.add("col", "uri");
          const id = authorizedName.acceptedColURI!.replace(
            "https://www.catalogueoflife.org/data/taxon/",
            "",
          );
          col_uri.innerText = id;
          col_uri.href = `#${id}`;
          col_uri.title = authorizedName.acceptedColURI!;
          li.append(" → ");
          li.append(col_uri);
        } else {
          li.classList.add("aug");
        }
      }

      for (const trt of authorizedName.treatments.def) {
        const li = new SynoTreatment(trt);
        li.classList.add("def");
        treatments.append(li);
      }
      for (const trt of authorizedName.treatments.aug) {
        const li = new SynoTreatment(trt);
        li.classList.add("aug");
        treatments.append(li);
      }
      for (const trt of authorizedName.treatments.dpr) {
        const li = new SynoTreatment(trt);
        li.classList.add("dpr");
        treatments.append(li);
      }
      for (const trt of authorizedName.treatments.cite) {
        const li = new SynoTreatment(trt);
        li.classList.add("cite");
        treatments.append(li);
      }
    }
  }
}
customElements.define("syno-name", SynoName);

async function justify(name: Name): Promise<string> {
  if (name.justification.searchTerm) {
    if (name.justification.subTaxon) {
      return "is a sub-taxon of the search term.";
    } else return "is the search term.";
  } else if (name.justification.treatment) {
    const details = await name.justification.treatment.details;
    const parent = await justify(name.justification.parent);
    return `is, according to ${details.creators} ${details.date},\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
    // return `is, according to ${details.creators} ${details.date} “${details.title||"No Title"}” ${name.justification.treatment.url},\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
  } else {
    const parent = await justify(name.justification.parent);
    return `is, according to the Catalogue of Life,\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
  }
}

const indicator = document.createElement("div");
root.insertAdjacentElement("beforebegin", indicator);
indicator.append(`Finding Synonyms for ${NAME} `);
indicator.append(document.createElement("progress"));

const timeStart = performance.now();

const sparqlEndpoint = new SparqlEndpoint(ENDPOINT_URL);
const synoGroup = new SynonymGroup(
  sparqlEndpoint,
  NAME,
  HIDE_COL_ONLY_SYNONYMS,
  START_WITH_SUBTAXA,
);

for await (const name of synoGroup) {
  const element = new SynoName(name);
  root.append(element);
}

const timeEnd = performance.now();

indicator.innerHTML = "";
indicator.innerText =
  `Found ${synoGroup.names.length} names with ${synoGroup.treatments.size} treatments. This took ${
    timeEnd - timeStart
  } milliseconds.`;
if (synoGroup.names.length === 0) root.append(":[");
