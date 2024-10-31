/// <reference lib="dom" />
import {
  type Name,
  SparqlEndpoint,
  SynonymGroup,
  type Treatment,
} from "../mod.ts";
import { distinct } from "jsr:@std/collections/distinct";

const params = new URLSearchParams(document.location.search);
const HIDE_COL_ONLY_SYNONYMS = !params.has("show_col");
const START_WITH_SUBTAXA = params.has("subtaxa");
const SORT_TREATMENTS_BY_TYPE = params.has("sort_treatments_by_type");
const ENDPOINT_URL = params.get("server") ||
  "https://treatment.ld.plazi.org/sparql";
const NAME = params.get("q") ||
  "https://www.catalogueoflife.org/data/taxon/3WD9M";

const root = document.getElementById("root") as HTMLDivElement;

enum SynoStatus {
  Def = "def",
  Aug = "aug",
  Dpr = "dpr",
  Cite = "cite",
  Full = "full",
}

const icons = {
  def:
    `<svg class="green" viewBox="0 0 24 24"><path fill="currentcolor" d="M17,13H13V17H11V13H7V11H11V7H13V11H17M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>`,
  aug:
    `<svg class="blue" viewBox="0 0 24 24"><path fill="currentcolor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>`,
  dpr:
    `<svg class="red" viewBox="0 0 24 24"><path fill="currentcolor" d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/></svg>`,
  cite:
    `<svg class="gray" viewBox="0 0 24 24"><path fill="currentcolor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>`,
  unknown:
    `<svg class="gray" viewBox="0 0 24 24"><path fill="currentcolor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>`,

  link:
    `<svg class="gray" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`,
  east:
    `<svg class="gray" viewBox="0 0 24 24"><path fill="currentColor" d="M15,5l-1.41,1.41L18.17,11H2V13h16.17l-4.59,4.59L15,19l7-7L15,5z"/></svg>`,
  west:
    `<svg class="gray" viewBox="0 0 24 24"><path fill="currentColor" d="M9,19l1.41-1.41L5.83,13H22V11H5.83l4.59-4.59L9,5l-7,7L9,19z"/></svg>`,
  line:
    `<svg class="gray" viewBox="0 0 24 24"><rect fill="currentColor" height="2" width="16" x="4" y="11"/></svg>`,
  empty: `<svg viewBox="0 0 24 24"></svg>`,
};

class SynoTreatment extends HTMLElement {
  constructor(trt: Treatment, status: SynoStatus) {
    super();

    if (status === SynoStatus.Full) this.classList.add("expanded");
    else {
      this.innerHTML = icons[status] ?? icons.unknown;
      this.addEventListener("click", () => {
        // const expanded = new SynoTreatment(trt, SynoStatus.Full);
        // this.prepend(expanded);
        // expanded.addEventListener("click", () => expanded.remove());
        this.classList.toggle("expanded");
      });
    }

    const date = document.createElement("span");
    if (trt.date) date.innerText = "" + trt.date;
    else {
      date.classList.add("missing");
      date.innerText = "No Date";
    }
    this.append(date);

    const spinner = document.createElement("progress");
    this.append(": ", spinner);

    const url = document.createElement("a");
    url.classList.add("treatment", "uri");
    url.href = trt.url;
    url.target = "_blank";
    url.innerText = trt.url.replace("http://treatment.plazi.org/id/", "");
    url.innerHTML += icons.link;
    this.append(" ", url);

    const names = document.createElement("div");
    names.classList.add("indent", "details");
    this.append(names);

    trt.details.then((details) => {
      const creators = document.createElement("span");
      const title = document.createElement("i");
      spinner.replaceWith(creators, " ", title);

      if (details.creators) creators.innerText = details.creators;
      else {
        creators.classList.add("missing");
        creators.innerText = "No Authors";
      }

      if (details.title) title.innerText = "“" + details.title + "”";
      else {
        title.classList.add("missing");
        title.innerText = "No Title";
      }

      if (details.treats.def.size > 0) {
        const line = document.createElement("div");
        // line.innerHTML = status === SynoStatus.Cite ? icons.line : icons.east;
        line.innerHTML = icons.east;
        line.innerHTML += icons.def;
        if (status === SynoStatus.Def || status === SynoStatus.Cite) {
          line.classList.add("hidden");
        }
        names.append(line);

        details.treats.def.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-concept.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(url);
        });
      }
      if (details.treats.aug.size > 0 || details.treats.treattn.size > 0) {
        const line = document.createElement("div");
        // line.innerHTML = status === SynoStatus.Cite ? icons.line : icons.east;
        line.innerHTML = icons.east;
        line.innerHTML += icons.aug;
        if (status === SynoStatus.Aug || status === SynoStatus.Cite) {
          line.classList.add("hidden");
        }
        names.append(line);

        details.treats.aug.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-concept.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(url);
        });
        details.treats.treattn.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-name.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(url);
        });
      }
      if (details.treats.dpr.size > 0) {
        const line = document.createElement("div");
        // line.innerHTML = status === SynoStatus.Cite ? icons.line : icons.west;
        line.innerHTML = icons.west;
        line.innerHTML += icons.dpr;
        if (status === SynoStatus.Dpr || status === SynoStatus.Cite) {
          line.classList.add("hidden");
        }
        names.append(line);

        details.treats.dpr.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-concept.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(url);
        });
      }
      if (details.treats.citetc.size > 0 || details.treats.citetn.size > 0) {
        const line = document.createElement("div");
        line.innerHTML = icons.empty + icons.cite;
        // if (status === SynoStatus.Dpr || status === SynoStatus.Cite) {
        line.classList.add("hidden");
        // }
        names.append(line);

        details.treats.citetc.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-concept.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(url);
        });
        details.treats.citetn.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-name.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(url);
        });
      }
    });
  }
}
customElements.define("syno-treatment", SynoTreatment);

class SynoName extends HTMLElement {
  constructor(name: Name) {
    super();

    const title = document.createElement("h2");
    const name_title = document.createElement("i");
    name_title.innerText = name.displayName;
    title.append(name_title);
    this.append(title);

    const rank_badge = document.createElement("span");
    rank_badge.classList.add("rank");
    rank_badge.innerText = name.rank;
    title.append(" ", rank_badge);

    if (name.taxonNameURI) {
      const name_uri = document.createElement("a");
      name_uri.classList.add("taxon", "uri");
      const short = name.taxonNameURI.replace(
        "http://taxon-name.plazi.org/id/",
        "",
      );
      name_uri.innerText = short;
      name_uri.id = short;
      name_uri.href = name.taxonNameURI;
      name_uri.target = "_blank";
      name_uri.innerHTML += icons.link;
      title.append(" ", name_uri);
    }

    const vernacular = document.createElement("div");
    vernacular.classList.add("vernacular");
    name.vernacularNames.then((names) => {
      if (names.size > 0) {
        vernacular.innerText = "“" +
          distinct([...names.values()].flat()).join("”, “") + "”";
      }
    });
    this.append(vernacular);

    const treatments = document.createElement("ul");
    this.append(treatments);

    if (name.colURI) {
      const col_uri = document.createElement("a");
      col_uri.classList.add("col", "uri");
      const id = name.colURI.replace(
        "https://www.catalogueoflife.org/data/taxon/",
        "",
      );
      col_uri.innerText = id;
      col_uri.id = id;
      col_uri.href = name.colURI;
      col_uri.target = "_blank";
      col_uri.innerHTML += icons.link;
      title.append(" ", col_uri);

      const li = document.createElement("div");
      li.classList.add("treatmentline");
      li.innerHTML = name.acceptedColURI !== name.colURI
        ? icons.dpr
        : icons.aug;
      treatments.append(li);

      const creators = document.createElement("span");
      creators.innerText = "Catalogue of Life";
      li.append(creators);

      const names = document.createElement("div");
      names.classList.add("indent");
      li.append(names);

      if (name.acceptedColURI !== name.colURI) {
        const line = document.createElement("div");
        line.innerHTML = icons.east + icons.aug;
        names.append(line);

        const col_uri = document.createElement("a");
        col_uri.classList.add("col", "uri");
        const id = name.acceptedColURI!.replace(
          "https://www.catalogueoflife.org/data/taxon/",
          "",
        );
        col_uri.innerText = id;
        col_uri.href = `#${id}`;
        col_uri.title = "show name";
        line.append(col_uri);
      }
    }
    if (name.treatments.treats.size > 0 || name.treatments.cite.size > 0) {
      for (const trt of name.treatments.treats) {
        const li = new SynoTreatment(trt, SynoStatus.Aug);
        treatments.append(li);
      }
      for (const trt of name.treatments.cite) {
        const li = new SynoTreatment(trt, SynoStatus.Cite);
        treatments.append(li);
      }
    }

    const justification = document.createElement("abbr");
    justification.classList.add("justification");
    justification.innerText = "...?";
    justify(name).then((just) => justification.title = `This ${just}`);
    title.append(" ", justification);

    for (const authorizedName of name.authorizedNames) {
      const authName = document.createElement("h3");
      const name_title = document.createElement("i");
      name_title.innerText = authorizedName.displayName;
      name_title.classList.add("gray");
      authName.append(name_title);
      authName.append(" ", authorizedName.authority);
      this.append(authName);

      const treatments = document.createElement("ul");
      this.append(treatments);

      if (authorizedName.taxonConceptURI) {
        const name_uri = document.createElement("a");
        name_uri.classList.add("taxon", "uri");
        const short = authorizedName.taxonConceptURI.replace(
          "http://taxon-concept.plazi.org/id/",
          "",
        );
        name_uri.innerText = short;
        name_uri.id = short;
        name_uri.href = authorizedName.taxonConceptURI;
        name_uri.target = "_blank";
        name_uri.innerHTML += icons.link;
        authName.append(" ", name_uri);
      }
      if (authorizedName.colURI) {
        const col_uri = document.createElement("a");
        col_uri.classList.add("col", "uri");
        const id = authorizedName.colURI.replace(
          "https://www.catalogueoflife.org/data/taxon/",
          "",
        );
        col_uri.innerText = id;
        col_uri.id = id;
        col_uri.href = authorizedName.colURI;
        col_uri.target = "_blank";
        col_uri.innerHTML += icons.link;
        authName.append(" ", col_uri);

        const li = document.createElement("div");
        li.classList.add("treatmentline");
        li.innerHTML = authorizedName.acceptedColURI !== authorizedName.colURI
          ? icons.dpr
          : icons.aug;
        treatments.append(li);

        const creators = document.createElement("span");
        creators.innerText = "Catalogue of Life";
        li.append(creators);

        const names = document.createElement("div");
        names.classList.add("indent");
        li.append(names);

        if (authorizedName.acceptedColURI !== authorizedName.colURI) {
          const line = document.createElement("div");
          line.innerHTML = icons.east + icons.aug;
          names.append(line);

          const col_uri = document.createElement("a");
          col_uri.classList.add("col", "uri");
          const id = authorizedName.acceptedColURI!.replace(
            "https://www.catalogueoflife.org/data/taxon/",
            "",
          );
          col_uri.innerText = id;
          col_uri.href = `#${id}`;
          col_uri.title = "show name";
          line.append(col_uri);
        }
      }

      const treatments_array: { trt: Treatment; status: SynoStatus }[] = [];

      for (const trt of authorizedName.treatments.def) {
        treatments_array.push({ trt, status: SynoStatus.Def });
      }
      for (const trt of authorizedName.treatments.aug) {
        treatments_array.push({ trt, status: SynoStatus.Aug });
      }
      for (const trt of authorizedName.treatments.dpr) {
        treatments_array.push({ trt, status: SynoStatus.Dpr });
      }
      for (const trt of authorizedName.treatments.cite) {
        treatments_array.push({ trt, status: SynoStatus.Cite });
      }

      if (!SORT_TREATMENTS_BY_TYPE) {
        treatments_array.sort((a, b) => {
          if (a.trt.date && b.trt.date) return a.trt.date - b.trt.date;
          if (a.trt.date) return 1;
          if (b.trt.date) return -1;
          return 0;
        });
      }

      for (const { trt, status } of treatments_array) {
        const li = new SynoTreatment(trt, status);
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
    return `is, according to ${details.creators} ${name.justification.treatment.date},\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
    // return `is, according to ${details.creators} ${details.date} “${details.title||"No Title"}” ${name.justification.treatment.url},\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
  } else {
    const parent = await justify(name.justification.parent);
    return `is, according to the Catalogue of Life,\n     a synonym of ${name.justification.parent.displayName} which ${parent}`;
  }
}

const indicator = document.createElement("div");
root.insertAdjacentElement("beforebegin", indicator);
indicator.append(`Finding Synonyms for ${NAME} `);
const progress = document.createElement("progress");
indicator.append(progress);

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
    (timeEnd - timeStart) / 1000
  } seconds.`;
if (synoGroup.names.length === 0) root.append(":[");
