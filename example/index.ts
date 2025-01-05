/// <reference lib="dom" />
import {
  type AuthorizedName,
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
}

const icons = {
  def:
    `<svg class="green" viewBox="0 -960 960 960"><path fill="currentcolor" d="M444-288h72v-156h156v-72H516v-156h-72v156H288v72h156v156Zm36.28 192Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Z"/></svg>`,
  aug:
    `<svg class="blue" viewBox="0 -960 960 960"><path fill="currentcolor" d="M480.28-96Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Z"/></svg>`,
  dpr:
    `<svg class="red" viewBox="0 -960 960 960"><path fill="currentcolor" d="m339-288 141-141 141 141 51-51-141-141 141-141-51-51-141 141-141-141-51 51 141 141-141 141 51 51ZM480-96q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z"/></svg>`,
  cite:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentcolor" d="M480.28-96Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Zm-.28-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z"/></svg>`,
  unknown:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentcolor" d="M480-240q20 0 34-14t14-34q0-20-14-34t-34-14q-20 0-34 14t-14 34q0 20 14 34t34 14Zm-36-153h73q0-37 6.5-52.5T555-485q35-34 48.5-58t13.5-53q0-55-37.5-89.5T484-720q-51 0-88.5 27T343-620l65 27q9-28 28.5-43.5T482-652q28 0 46 16t18 42q0 23-15.5 41T496-518q-35 32-43.5 52.5T444-393Zm36 297q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z"/></svg>`,

  col_aug:
    `<svg class="blue" viewBox="0 -960 960 960"><path fill="currentcolor" d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Z"/></svg>`,
  col_dpr:
    `<svg class="red" viewBox="0 -960 960 960"><path fill="currentcolor" d="m350-300 129.77-129.77L609.53-300 660-350.47 530.23-480.23 660-610l-50-50-129.77 129.77L350.47-660 300-609.53l129.77 129.76L300-350l50 50ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Z"/></svg>`,

  link:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z"/></svg>`,

  expand:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M240-240v-240h72v168h168v72H240Zm408-240v-168H480v-72h240v240h-72Z"/></svg>`,
  collapse:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M432-432v240h-72v-168H192v-72h240Zm168-336v168h168v72H528v-240h72Z"/></svg>`,

  east:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="m600-216-51-51 177-177H96v-72h630L549-693l51-51 264 264-264 264Z"/></svg>`,
  west:
    `<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M360-216 96-480l264-264 51 51-177 177h630v72H234l177 177-51 51Z"/></svg>`,
  empty: `<svg viewBox="0 -960 960 960"></svg>`,
};

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

class SynoTreatment extends HTMLElement {
  constructor(trt: Treatment, status: SynoStatus) {
    super();

    this.innerHTML = icons[status] ?? icons.unknown;

    const button = document.createElement("button");
    button.classList.add("icon", "button");
    button.innerHTML = icons.expand;
    button.addEventListener("click", () => {
      if (this.classList.toggle("expanded")) {
        button.innerHTML = icons.collapse;
      } else {
        button.innerHTML = icons.expand;
      }
    });

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

    this.append(button);

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
          line.append(" ", url);
          synoGroup.findName(n).then((nn) => {
            url.classList.remove("uri");
            if ((nn as AuthorizedName).authority) {
              url.innerText = nn.displayName + " " +
                (nn as AuthorizedName).authority;
            } else url.innerText = nn.displayName;
          }, () => {
            url.removeAttribute("href");
          });
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
          line.append(" ", url);
          synoGroup.findName(n).then((nn) => {
            url.classList.remove("uri");
            if ((nn as AuthorizedName).authority) {
              url.innerText = nn.displayName + " " +
                (nn as AuthorizedName).authority;
            } else url.innerText = nn.displayName;
          }, () => {
            url.removeAttribute("href");
          });
        });
        details.treats.treattn.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-name.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(" ", url);
          synoGroup.findName(n).then((nn) => {
            url.classList.remove("uri");
            if ((nn as AuthorizedName).authority) {
              url.innerText = nn.displayName + " " +
                (nn as AuthorizedName).authority;
            } else url.innerText = nn.displayName;
          }, () => {
            url.removeAttribute("href");
          });
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
          line.append(" ", url);
          synoGroup.findName(n).then((nn) => {
            url.classList.remove("uri");
            if ((nn as AuthorizedName).authority) {
              url.innerText = nn.displayName + " " +
                (nn as AuthorizedName).authority;
            } else url.innerText = nn.displayName;
          }, () => {
            url.removeAttribute("href");
          });
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
          line.append(" ", url);
          synoGroup.findName(n).then((nn) => {
            url.classList.remove("uri");
            if ((nn as AuthorizedName).authority) {
              url.innerText = nn.displayName + " " +
                (nn as AuthorizedName).authority;
            } else url.innerText = nn.displayName;
          }, () => {
            url.removeAttribute("href");
          });
        });
        details.treats.citetn.forEach((n) => {
          const url = document.createElement("a");
          url.classList.add("taxon", "uri");
          const short = n.replace("http://taxon-name.plazi.org/id/", "");
          url.innerText = short;
          url.href = "#" + short;
          url.title = "show name";
          line.append(" ", url);
          synoGroup.findName(n).then((nn) => {
            url.classList.remove("uri");
            if ((nn as AuthorizedName).authority) {
              url.innerText = nn.displayName + " " +
                (nn as AuthorizedName).authority;
            } else url.innerText = nn.displayName;
          }, () => {
            url.removeAttribute("href");
          });
        });
      }
      if (details.figureCitations.length > 0) {
        const line = document.createElement("div");
        line.classList.add("figures", "hidden");
        names.append(line);
        for (const figure of details.figureCitations) {
          const el = document.createElement("figure");
          line.append(el);
          const img = document.createElement("img");
          img.src = figure.url;
          img.loading = "lazy";
          img.alt = figure.description ?? "Cited Figure without caption";
          el.append(img);
          const caption = document.createElement("figcaption");
          caption.innerText = figure.description ?? "";
          el.append(caption);
        }
      }
      if (details.materialCitations.length > 0) {
        const line = document.createElement("div");
        line.innerHTML = icons.empty + icons.cite +
          " Material Citations:<br> -";
        line.classList.add("hidden");
        names.append(line);
        line.innerText += details.materialCitations.map((c) =>
          JSON.stringify(c)
            .replaceAll("{", "")
            .replaceAll("}", "")
            .replaceAll('":', ": ")
            .replaceAll(",", ", ")
            .replaceAll('"', "")
        ).join("\n -");
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
    const kingdom_badge = document.createElement("span");
    kingdom_badge.classList.add("rank");
    kingdom_badge.innerText = name.kingdom || "Missing Kingdom";
    title.append(" ", kingdom_badge, " ", rank_badge);

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

    if (name.col) {
      const col_uri = document.createElement("a");
      col_uri.classList.add("col", "uri");
      const id = name.col.colURI.replace(
        "https://www.catalogueoflife.org/data/taxon/",
        "",
      );
      col_uri.innerText = id;
      col_uri.id = id;
      col_uri.href = name.col.colURI;
      col_uri.target = "_blank";
      col_uri.innerHTML += icons.link;
      title.append(" ", col_uri);

      const li = document.createElement("div");
      li.classList.add("treatmentline");
      li.innerHTML = name.col.acceptedURI !== name.col.colURI
        ? icons.col_dpr
        : icons.col_aug;
      treatments.append(li);

      const creators = document.createElement("span");
      creators.innerText = "Catalogue of Life";
      li.append(creators);

      const names = document.createElement("div");
      names.classList.add("indent");
      li.append(names);

      if (name.col.acceptedURI !== name.col.colURI) {
        const line = document.createElement("div");
        line.innerHTML = icons.east + icons.col_aug;
        names.append(line);

        const col_uri = document.createElement("a");
        col_uri.classList.add("col", "uri");
        const id = name.col.acceptedURI.replace(
          "https://www.catalogueoflife.org/data/taxon/",
          "",
        );
        col_uri.innerText = id;
        col_uri.href = `#${id}`;
        col_uri.title = "show name";
        line.append(col_uri);
        synoGroup.findName(name.col.acceptedURI).then((n) => {
          if ((n as AuthorizedName).authority) {
            col_uri.innerText = n.displayName + " " +
              (n as AuthorizedName).authority;
          } else col_uri.innerText = n.displayName;
        }, () => {
          col_uri.removeAttribute("href");
        });
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

      if (authorizedName.taxonConceptURIs) {
        const name_uri = document.createElement("a");
        name_uri.classList.add("taxon", "uri");
        // TODO handle other URIs
        const short = authorizedName.taxonConceptURIs[0].replace(
          "http://taxon-concept.plazi.org/id/",
          "",
        );
        name_uri.innerText = short;
        name_uri.id = short;
        name_uri.href = authorizedName.taxonConceptURIs[0];
        name_uri.target = "_blank";
        name_uri.innerHTML += icons.link;
        authName.append(" ", name_uri);
      }
      if (authorizedName.col) {
        const col_uri = document.createElement("a");
        col_uri.classList.add("col", "uri");
        const id = authorizedName.col.colURI.replace(
          "https://www.catalogueoflife.org/data/taxon/",
          "",
        );
        col_uri.innerText = id;
        col_uri.id = id;
        col_uri.href = authorizedName.col.colURI;
        col_uri.target = "_blank";
        col_uri.innerHTML += icons.link;
        authName.append(" ", col_uri);

        const li = document.createElement("div");
        li.classList.add("treatmentline");
        li.innerHTML =
          authorizedName.col.acceptedURI !== authorizedName.col.colURI
            ? icons.col_dpr
            : icons.col_aug;
        treatments.append(li);

        const creators = document.createElement("span");
        creators.innerText = "Catalogue of Life";
        li.append(creators);

        const names = document.createElement("div");
        names.classList.add("indent");
        li.append(names);

        if (authorizedName.col.acceptedURI !== authorizedName.col.colURI) {
          const line = document.createElement("div");
          line.innerHTML = icons.east + icons.col_aug;
          names.append(line);

          const col_uri = document.createElement("a");
          col_uri.classList.add("col", "uri");
          const id = authorizedName.col.acceptedURI.replace(
            "https://www.catalogueoflife.org/data/taxon/",
            "",
          );
          col_uri.innerText = id;
          col_uri.href = `#${id}`;
          col_uri.title = "show name";
          line.append(" ", col_uri);
          synoGroup.findName(authorizedName.col.acceptedURI).then((n) => {
            col_uri.classList.remove("uri");
            if ((n as AuthorizedName).authority) {
              col_uri.innerText = n.displayName + " " +
                (n as AuthorizedName).authority;
            } else col_uri.innerText = n.displayName;
          }, () => {
            col_uri.removeAttribute("href");
          });
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
