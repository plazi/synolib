import type { SparqlEndpoint, SparqlJson } from "./mod.ts";
import * as Queries from "./Queries.ts";
import * as SQueries from "./SimpleQueries.ts";
import { unifyAuthorithy } from "./UnifyAuthorities.ts";

const abbreviateRank = (rank: string) => {
  switch (rank) {
    case "variety":
      return "var.";
    case "subspecies":
      return "subsp.";
    case "form":
      return "f.";
    default:
      return rank;
  }
};

/** Finds all synonyms of a taxon */
export class SynonymGroup implements AsyncIterable<Name> {
  /** Indicates whether the SynonymGroup has found all synonyms.
   *
   * @readonly
   */
  isFinished = false;
  /** Used internally to watch for new names found */
  private monitor: EventTarget = new EventTarget();

  /** Used internally to abort in-flight network requests when SynonymGroup is aborted */
  private controller = new AbortController();

  /** The SparqlEndpoint used */
  private sparqlEndpoint: SparqlEndpoint;

  private fetchOptions: RequestInit = {
    signal: this.controller.signal,
    cache: "force-cache",
  };

  /**
   * List of names found so-far.
   *
   * Contains full list of synonyms _if_ .isFinished and not .isAborted
   *
   * @readonly
   */
  names: Name[] = [];
  /**
   * Add a new Name to this.names.
   *
   * Note: does not deduplicate on its own
   *
   * @internal */
  private pushName(name: Name) {
    this.names.push(name);
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }

  /**
   * Call when all synonyms are found
   *
   * @internal */
  private finish() {
    this.isFinished = true;
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }

  /** contains stringified LatinNames, TN, TC, CoL uris of synonyms which are in-flight somehow or are done already */
  private expanded = new Set<string>(); // new Map<string, NameStatus>();

  /** contains CoL uris where we don't need to check for Col "acceptedName" links
   *
   * col -> accepted col
   */
  private acceptedCol = new Map<string, string>();

  /**
   * Used internally to deduplicate treatments, maps from URI to Object.
   *
   * Contains full list of treatments _if_ .isFinished and not .isAborted
   *
   * @readonly
   */
  treatments: Map<string, Treatment> = new Map();

  /**
   * Whether to show taxa deprecated by CoL that would not have been found otherwise.
   * This significantly increases the number of results in some cases.
   */
  ignoreDeprecatedCoL: boolean;

  /**
   * if set to true, subTaxa of the search term are also considered as starting points.
   *
   * Note that "intermediate" ranks like subGenus and section are always included when searching for a genus by latin name.
   */
  startWithSubTaxa: boolean;

  /**
   * If set to true, will not look for any synonyms and only return the initial match(es)
   */
  noSynonyms: boolean;

  /**
   * Constructs a SynonymGroup
   *
   * @param sparqlEndpoint SPARQL-Endpoint to query
   * @param taxonName either a string of the form "Genus species infraspecific" (species & infraspecific names optional), or an URI of a http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept or ...#TaxonName or a CoL taxon URI
   * @param [ignoreDeprecatedCoL=true] Whether to show taxa deprecated by CoL that would not have been found otherwise
   * @param [startWithSubTaxa=false] if set to true, subTaxa of the search term are also considered as starting points.
   * @param [noSynonyms=false] If set to true, will not look for any synonyms and only return the initial match(es).
   */
  constructor(
    sparqlEndpoint: SparqlEndpoint,
    taxonName: string,
    ignoreDeprecatedCoL = true,
    startWithSubTaxa = false,
    noSynonyms = false,
  ) {
    this.sparqlEndpoint = sparqlEndpoint;
    this.ignoreDeprecatedCoL = ignoreDeprecatedCoL;
    this.startWithSubTaxa = startWithSubTaxa;
    this.noSynonyms = noSynonyms;

    if (taxonName.startsWith("https://www.catalogueoflife.org/")) {
      this.findColSynonyms(taxonName, { searchTerm: true, subTaxon: false })
        .catch((e) => {
          console.log("SynoGroup Failure: ", e);
          this.controller.abort("SynoGroup Failed");
        })
        .finally(() => this.finish());
    } else if (taxonName.startsWith("http://taxon-concept.plazi.org/id/")) {
      this.tcSynonyms(taxonName, { searchTerm: true, subTaxon: false })
        .catch((e) => {
          console.log("SynoGroup Failure: ", e);
          this.controller.abort("SynoGroup Failed");
        })
        .finally(() => this.finish());
    } else if (taxonName.startsWith("http://taxon-name.plazi.org/id/")) {
      this.tnSynonyms(taxonName, { searchTerm: true, subTaxon: false })
        .catch((e) => {
          console.log("SynoGroup Failure: ", e);
          this.controller.abort("SynoGroup Failed");
        })
        .finally(() => this.finish());
    } else {
      const match =
        /^(\w+)(?:\s+\((\w+)\))?(?:\s+×?\s*(\w+)(?:(?:\s+\w+\.\s*\w*)*?\s+(\w+))?)?$/
          .exec(taxonName);
      if (match === null) {
        console.log("SynoGroup Failure: Could not parse", taxonName);
        this.controller.abort("SynoGroup Failed");
        this.finish();
        return;
      }
      const name: SQueries.LatinName = {
        genericName: match[1],
        infragenericEpithet: match[2],
        specificEpithet: match[3],
        infraspecificEpithet: match[4],
        noMissing: !this.startWithSubTaxa,
      };

      this.handleLatinName(name, { searchTerm: true, subTaxon: false })
        .catch((e) => {
          console.log("SynoGroup Failure: ", e);
          this.controller.abort("SynoGroup Failed");
        })
        .finally(() => this.finish());
    }
  }

  /** @internal */
  private async handleLatinName(
    name: SQueries.LatinName,
    justification: Justification,
  ) {
    const key0 = SQueries.stringifyLN(name);
    if (this.expanded.has(key0)) {
      console.log(`Skipping known (${key0})`);
      return;
    }

    if (this.controller.signal?.aborted) return Promise.reject();

    this.expanded.add(key0);

    const [col, plazi] = await Promise.all([
      SQueries.getColFromName(name, justification.searchTerm, this.sparqlEndpoint, this.fetchOptions),
      SQueries.getPlaziFromName(name, justification.searchTerm, this.sparqlEndpoint, this.fetchOptions),
    ]);
    await this.handleColAndPlaziResult(col, plazi, key0, justification);
  }

  /** @internal
   *
   * @param key0 stringified LN which should not be skipped even if it is in this.expanded.
   */
  private async handleColAndPlaziResult(
    col: Set<SQueries.ColResult>,
    plazi: Set<SQueries.PlaziResult>,
    key0: string,
    justification: Justification,
  ) {
    const treatmentPromises: Promise<[Name, Treatment, TreatmentDetails]>[] =
      [];
    const colPromises: Promise<void[]>[] = [];

    const newNames: Set<string> = new Set();
    const newCol: Map<string, Set<SQueries.ColResult>> = new Map();
    const newPlazi: Map<string, SQueries.PlaziResult> = new Map();

    for (const r of col) {
      const key = SQueries.stringifyLN(r.latinName);
      const prev = newCol.get(key);
      if (prev) {
        prev.add(r);
      } else {
        newNames.add(key);
        newCol.set(key, new Set([r]));
      }
    }
    for (const r of plazi) {
      const key = SQueries.stringifyLN(r.latinName);
      if (newPlazi.has(key)) {
        console.warn("Found duplicate Plazi-LN: ${key}");
      }
      newNames.add(key);
      newPlazi.set(key, r);
    }

    console.log(newNames, newCol, newPlazi);

    for (const key of newNames) {
      if (key != key0 && this.expanded.has(key)) {
        console.log(`Skipping known (${key})`);
        continue;
      }
      this.expanded.add(key);

      const plazi = newPlazi.get(key);
      const cols = newCol.get(key);

      const treatments: Treatment[] = [];

      console.log(key, cols, plazi);

      let unauthorizedCol: { colURI: string; acceptedURI: string } | undefined;
      const authorizedNames: AuthorizedName[] = [];

      let kingdom: string | undefined;
      let displayName: string | undefined;
      let rank: string | undefined;

      if (cols) {
        for (const col of cols.values()) {
          const colURI = col.colUri;
          if (!kingdom) kingdom = col.latinName.kingdom;
          if (!displayName) displayName = col.humanReadable;
          if (!rank) rank = col.latinName.rank;
          if (!col.authority) {
            if (unauthorizedCol && unauthorizedCol.colURI !== colURI) {
              console.log("Duplicate unathorized COL:", colURI);
            }
            unauthorizedCol = {
              colURI,
              acceptedURI: col.acceptedColUri,
            };
          } else if (!authorizedNames.find((e) => e.col?.colURI === colURI)) {
            // if (!expandedHere.has(colURI)) {
            //   expandedHere.add(colURI);
            // TODO: handle unification of names
            // might not be neccessary, assuming all CoL-taxa are mutually non-unifiable and
            // they are always handled first
            authorizedNames.push({
              displayName: col.humanReadable,
              authority: col.authority!,
              authorities: [col.authority!],
              col: {
                colURI,
                acceptedURI: col.acceptedColUri,
              },
              taxonConceptURIs: [],
              treatments: {
                def: new Set(),
                aug: new Set(),
                dpr: new Set(),
                cite: new Set(),
              },
            });
            //}
          }
        }
      }

      if (plazi) {
        if (!displayName) displayName = SQueries.prettyPrintLN(plazi.latinName);
        for (const authName of plazi.authorized) {
          const def = this.makeTreatmentSet(authName.defs?.split("|"));
          const aug = this.makeTreatmentSet(authName.augs?.split("|"));
          const dpr = this.makeTreatmentSet(authName.dprs?.split("|"));
          const cite = this.makeTreatmentSet(authName.cites?.split("|"));

          def.forEach((t) => treatments.push(t));
          aug.forEach((t) => treatments.push(t));
          dpr.forEach((t) => treatments.push(t));

          const prevName = authorizedNames.find((e) =>
            unifyAuthorithy(e.authority, authName.authorities) !== null
            // authName.authorities.split(" / ").some((auth) =>
            //   unifyAuthorithy(e.authority, auth) !== null
            // )
          );
          if (prevName) {
            // TODO: I feel like this could be made much more efficient -- we are unifying repeatedly
            const best = authName.authorities; // .split(" / ").find((auth) =>
            //  unifyAuthorithy(prevName.authority, auth) !== null
            // )!;

            prevName.authority = unifyAuthorithy(prevName.authority, best)!;
            prevName.authorities.push(...authName.authorities.split(" / "));
            prevName.taxonConceptURIs.push(authName.tcUri);
            prevName.treatments = {
              def: prevName.treatments.def.union(def),
              aug: prevName.treatments.aug.union(aug),
              dpr: prevName.treatments.dpr.union(dpr),
              cite: prevName.treatments.cite.union(cite),
            };
          } else {
            authorizedNames.push({
              displayName,
              authority: authName.authorities,
              authorities: authName.authorities.split(" / "),
              taxonConceptURIs: [authName.tcUri],
              treatments: {
                def,
                aug,
                dpr,
                cite,
              },
            });
          }
        }
      }

      if (!displayName) displayName = key;

      const treats: Set<Treatment> = plazi?.treats
        ? this.makeTreatmentSet(plazi.treats.split("|"))
        : new Set();
      treats.forEach((t) => treatments.push(t));

      const name: Name = {
        kingdom: kingdom ?? plazi?.latinName.kingdom ?? "",
        displayName,
        rank: rank ?? plazi?.latinName.rank ?? "",
        vernacularNames: plazi
          ? this.getVernacular(plazi.tnUri)
          : Promise.resolve(new Map()),
        taxonNameURI: plazi?.tnUri,
        col: unauthorizedCol,
        authorizedNames,
        justification,
        treatments: {
          treats,
          cite: plazi?.cites
            ? this.makeTreatmentSet(plazi.cites.split("|"))
            : new Set(),
        },
      };

      this.pushName(name);

      if (unauthorizedCol) {
        colPromises.push(
          this.findColSynonyms(unauthorizedCol.acceptedURI, {
            searchTerm: false,
            parent: name,
          }),
        );
      }
      for (const authName of authorizedNames) {
        if (authName.col) {
          colPromises.push(
            this.findColSynonyms(authName.col.acceptedURI, {
              searchTerm: false,
              parent: name,
            }),
          );
        }
      }

      treatmentPromises.push(
        ...treatments.map((treat) =>
          treat.details.then((d): [Name, Treatment, TreatmentDetails] => {
            return [name, treat, d];
          })
        ),
      );
    }

    /** Map<synonymUri, Treatment> */
    const newTC = new Map<string, [Name, Treatment]>();
    const newTN = new Map<string, [Name, Treatment]>();
    (await Promise.all(treatmentPromises)).map(([name, treat, d]) => {
      d.treats.aug.difference(this.expanded).forEach((s) =>
        newTC.set(s, [name, treat])
      );
      d.treats.def.difference(this.expanded).forEach((s) =>
        newTC.set(s, [name, treat])
      );
      d.treats.dpr.difference(this.expanded).forEach((s) =>
        newTC.set(s, [name, treat])
      );
      d.treats.treattn.difference(this.expanded).forEach((s) =>
        newTN.set(s, [name, treat])
      );
    });

    await Promise.allSettled(
      [
        ...[...newTC].map(([tcUri, [name, treatment]]) =>
          this.tcSynonyms(tcUri, { searchTerm: false, parent: name, treatment })
        ),
        ...[...newTN].map(([tnUri, [name, treatment]]) =>
          this.tnSynonyms(tnUri, { searchTerm: false, parent: name, treatment })
        ),
        ...colPromises,
      ],
    );
  }

  /** @internal */
  async tcSynonyms(tcUri: string, justification: Justification) {
    if (this.noSynonyms && !justification.searchTerm) return;
    this.expanded.add(tcUri);
    const plazi = await SQueries.getNameFromTC(
      tcUri,
      this.sparqlEndpoint,
      this.fetchOptions,
    );
    const cols = await SQueries.getColFromName(
      plazi.latinName,
      justification.searchTerm,
      this.sparqlEndpoint,
      this.fetchOptions,
    );
    return this.handleColAndPlaziResult(
      cols,
      new Set([plazi]),
      "",
      justification,
    );
  }
  /** @internal */
  async tnSynonyms(tnUri: string, justification: Justification) {
    if (this.noSynonyms && !justification.searchTerm) return;
    this.expanded.add(tnUri);
    const plazi = await SQueries.getNameFromTN(
      tnUri,
      this.sparqlEndpoint,
      this.fetchOptions,
    );
    const cols = await SQueries.getColFromName(
      plazi.latinName,
      justification.searchTerm,
      this.sparqlEndpoint,
      this.fetchOptions,
    );
    return this.handleColAndPlaziResult(
      cols,
      new Set([plazi]),
      "",
      justification,
    );
  }

  /**
   * Finds the given name (identified by taxon-name, taxon-concept or CoL uri) among the list of synonyms.
   *
   * Will reject when the SynonymGroup finishes but the name was not found — this means that this was not a synonym.
   */
  findName(uri: string): Promise<Name | AuthorizedName> {
    let name: Name | AuthorizedName | undefined;
    for (const n of this.names) {
      if (n.taxonNameURI === uri || n.col?.colURI === uri) {
        name = n;
        break;
      }
      const an = n.authorizedNames.find((an) =>
        an.col?.colURI === uri || an.taxonConceptURIs.includes(uri)
      );
      if (an) {
        name = an;
        break;
      }
    }
    if (name) return Promise.resolve(name);
    return new Promise((resolve, reject) => {
      this.monitor.addEventListener("updated", () => {
        if (this.names.length === 0 || this.isFinished) reject();
        const n = this.names.at(-1)!;
        if (n.taxonNameURI === uri || n.col?.colURI === uri) {
          resolve(n);
          return;
        }
        const an = n.authorizedNames.find((an) =>
          an.col?.colURI === uri || an.taxonConceptURIs.includes(uri)
        );
        if (an) {
          resolve(an);
          return;
        }
      });
    });
  }

  /** @internal */
  private async findColSynonyms(
    colUri: string,
    justification: Justification,
  ): Promise<void[]> {
    if (this.noSynonyms && !justification.searchTerm) return [];
    if (this.acceptedCol.has(colUri)) {
      // we have already found this group of synonyms
      return [];
    }

    const promises: Promise<void>[] = [];

    try {
      const { accepted, synonyms } = await SQueries.getColSynonyms(
        colUri,
        this.sparqlEndpoint,
        this.fetchOptions,
      );

      if (!this.acceptedCol.has(accepted.colUri)) {
        this.acceptedCol.set(accepted.colUri, accepted.colUri);
        const searchTerm = justification.searchTerm && colUri === accepted.colUri;
        if (!this.noSynonyms || searchTerm) {
          promises.push(
            this.handleLatinName(accepted.latinName, justification),
          );
        }
      }

      const plaziPromises: Promise<Set<SQueries.PlaziResult>>[] = [];
      const keys: Set<string> = new Set();

      for (const synonym of synonyms) {
        this.acceptedCol.set(synonym.colUri, accepted.colUri);
        const searchTerm = justification.searchTerm && colUri === synonym.colUri;
        if (searchTerm || (!this.ignoreDeprecatedCoL && !this.noSynonyms)) {
          const key = SQueries.stringifyLN(synonym.latinName);
          if (!keys.has(key)) {
            keys.add(key);
            plaziPromises.push(
              SQueries.getPlaziFromName(
                synonym.latinName,
                searchTerm,
                this.sparqlEndpoint,
                this.fetchOptions,
              ),
            );
          }
        }
      }

      const plazis = await Promise.all(plaziPromises);
      promises.push(
        this.handleColAndPlaziResult(
          synonyms,
          plazis.reduce((prev, set) => prev.union(set)),
          "",
          justification,
        ),
      );

      if (!this.acceptedCol.has(colUri)) this.acceptedCol.set(colUri, colUri);
    } catch {
      if (!this.acceptedCol.has(colUri)) {
        this.acceptedCol.set(colUri, "INVALID COL");
      }
    }
    return Promise.all(promises);
  }

  /** @internal */
  private async getVernacular(uri: string): Promise<vernacularNames> {
    const result: vernacularNames = new Map();
    const query =
      `SELECT DISTINCT ?n WHERE { <${uri}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`;
    const bindings = (await this.sparqlEndpoint.getSparqlResultSet(
      query,
      this.fetchOptions,
      `Vernacular ${uri}`,
    )).results.bindings;
    for (const b of bindings) {
      if (b.n?.value) {
        if (b.n["xml:lang"]) {
          if (result.has(b.n["xml:lang"])) {
            result.get(b.n["xml:lang"])!.push(b.n.value);
          } else result.set(b.n["xml:lang"], [b.n.value]);
        } else {
          if (result.has("??")) result.get("??")!.push(b.n.value);
          else result.set("??", [b.n.value]);
        }
      }
    }
    return result;
  }

  /** @internal
   *
   * the supplied "urls" must be of the form "URL>DATE"
   */
  private makeTreatmentSet(urls?: string[]): Set<Treatment> {
    if (!urls) return new Set<Treatment>();
    return new Set<Treatment>(
      urls.filter((url) => !!url).map((url_d) => {
        const [url, date] = url_d.split(">");
        if (!this.treatments.has(url)) {
          const details = this.getTreatmentDetails(url);
          this.treatments.set(url, {
            url,
            date: date ? parseInt(date, 10) : undefined,
            details,
          });
        }
        return this.treatments.get(url) as Treatment;
      }),
    );
  }

  /** @internal */
  private async getTreatmentDetails(
    treatmentUri: string,
  ): Promise<TreatmentDetails> {
    const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?date ?title ?mc
  (group_concat(DISTINCT ?catalogNumber;separator=" / ") as ?catalogNumbers)
  (group_concat(DISTINCT ?collectionCode;separator=" / ") as ?collectionCodes)
  (group_concat(DISTINCT ?typeStatus;separator=" / ") as ?typeStatuss)
  (group_concat(DISTINCT ?countryCode;separator=" / ") as ?countryCodes)
  (group_concat(DISTINCT ?stateProvince;separator=" / ") as ?stateProvinces)
  (group_concat(DISTINCT ?municipality;separator=" / ") as ?municipalitys)
  (group_concat(DISTINCT ?county;separator=" / ") as ?countys)
  (group_concat(DISTINCT ?locality;separator=" / ") as ?localitys)
  (group_concat(DISTINCT ?verbatimLocality;separator=" / ") as ?verbatimLocalitys)
  (group_concat(DISTINCT ?recordedBy;separator=" / ") as ?recordedBys)
  (group_concat(DISTINCT ?eventDate;separator=" / ") as ?eventDates)
  (group_concat(DISTINCT ?samplingProtocol;separator=" / ") as ?samplingProtocols)
  (group_concat(DISTINCT ?decimalLatitude;separator=" / ") as ?decimalLatitudes)
  (group_concat(DISTINCT ?decimalLongitude;separator=" / ") as ?decimalLongitudes)
  (group_concat(DISTINCT ?verbatimElevation;separator=" / ") as ?verbatimElevations)
  (group_concat(DISTINCT ?gbifOccurrenceId;separator=" / ") as ?gbifOccurrenceIds)
  (group_concat(DISTINCT ?gbifSpecimenId;separator=" / ") as ?gbifSpecimenIds)
  (group_concat(DISTINCT ?creator;separator="; ") as ?creators)
  (group_concat(DISTINCT ?httpUri;separator="|") as ?httpUris)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trttn;separator="|") as ?trttns)
  (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  BIND (<${treatmentUri}> as ?treatment)
  ?treatment dc:creator ?creator .
  OPTIONAL { ?treatment dc:title ?title }
  OPTIONAL { ?treatment trt:augmentsTaxonConcept ?aug . }
  OPTIONAL { ?treatment trt:definesTaxonConcept ?def . }
  OPTIONAL { ?treatment trt:deprecates ?dpr . }
  OPTIONAL { ?treatment cito:cites ?cite . ?cite a dwcFP:TaxonConcept . }
  OPTIONAL { ?treatment trt:treatsTaxonName ?trttn . }
  OPTIONAL { ?treatment trt:citesTaxonName ?citetn . }
  OPTIONAL {
    ?treatment dwc:basisOfRecord ?mc .
    ?mc dwc:catalogNumber ?catalogNumber .
    OPTIONAL { ?mc dwc:collectionCode ?collectionCode . }
    OPTIONAL { ?mc dwc:typeStatus ?typeStatus . }
    OPTIONAL { ?mc dwc:countryCode ?countryCode . }
    OPTIONAL { ?mc dwc:stateProvince ?stateProvince . }
    OPTIONAL { ?mc dwc:municipality ?municipality . }
    OPTIONAL { ?mc dwc:county ?county . }
    OPTIONAL { ?mc dwc:locality ?locality . }
    OPTIONAL { ?mc dwc:verbatimLocality ?verbatimLocality . }
    OPTIONAL { ?mc dwc:recordedBy ?recordedBy . }
    OPTIONAL { ?mc dwc:eventDate ?eventDate . }
    OPTIONAL { ?mc dwc:samplingProtocol ?samplingProtocol . }
    OPTIONAL { ?mc dwc:decimalLatitude ?decimalLatitude . }
    OPTIONAL { ?mc dwc:decimalLongitude ?decimalLongitude . }
    OPTIONAL { ?mc dwc:verbatimElevation ?verbatimElevation . }
    OPTIONAL { ?mc trt:gbifOccurrenceId ?gbifOccurrenceId . }
    OPTIONAL { ?mc trt:gbifSpecimenId ?gbifSpecimenId . }
    OPTIONAL { ?mc trt:httpUri ?httpUri . }
  }
}
GROUP BY ?date ?title ?mc`;
    if (this.controller.signal.aborted) {
      return {
        materialCitations: [],
        figureCitations: [],
        treats: {
          def: new Set(),
          aug: new Set(),
          dpr: new Set(),
          citetc: new Set(),
          treattn: new Set(),
          citetn: new Set(),
        },
      };
    }
    try {
      const json = await this.sparqlEndpoint.getSparqlResultSet(
        query,
        this.fetchOptions,
        `TreatmentDetails ${treatmentUri}`,
      );
      const materialCitations: MaterialCitation[] = json.results.bindings
        .filter((t) => t.mc && t.catalogNumbers?.value)
        .map((t) => {
          const httpUri = t.httpUris?.value?.split("|");
          return {
            "catalogNumber": t.catalogNumbers!.value,
            "collectionCode": t.collectionCodes?.value || undefined,
            "typeStatus": t.typeStatuss?.value || undefined,
            "countryCode": t.countryCodes?.value || undefined,
            "stateProvince": t.stateProvinces?.value || undefined,
            "municipality": t.municipalitys?.value || undefined,
            "county": t.countys?.value || undefined,
            "locality": t.localitys?.value || undefined,
            "verbatimLocality": t.verbatimLocalitys?.value || undefined,
            "recordedBy": t.recordedBys?.value || undefined,
            "eventDate": t.eventDates?.value || undefined,
            "samplingProtocol": t.samplingProtocols?.value || undefined,
            "decimalLatitude": t.decimalLatitudes?.value || undefined,
            "decimalLongitude": t.decimalLongitudes?.value || undefined,
            "verbatimElevation": t.verbatimElevations?.value || undefined,
            "gbifOccurrenceId": t.gbifOccurrenceIds?.value || undefined,
            "gbifSpecimenId": t.gbifSpecimenIds?.value || undefined,
            httpUri: httpUri?.length ? httpUri : undefined,
          };
        });
      const figureQuery = `
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${treatmentUri}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `;
      const figures = (await this.sparqlEndpoint.getSparqlResultSet(
        figureQuery,
        this.fetchOptions,
        `TreatmentDetails/Figures ${treatmentUri}`,
      )).results.bindings;
      const figureCitations = figures.filter((f) => f.url?.value).map(
        (f) => {
          return { url: f.url!.value, description: f.description?.value };
        },
      );
      return {
        creators: json.results.bindings[0]?.creators?.value,
        title: json.results.bindings[0]?.title?.value,
        materialCitations,
        figureCitations,
        treats: {
          def: new Set(
            json.results.bindings[0]?.defs?.value
              ? json.results.bindings[0].defs.value.split("|")
              : undefined,
          ),
          aug: new Set(
            json.results.bindings[0]?.augs?.value
              ? json.results.bindings[0].augs.value.split("|")
              : undefined,
          ),
          dpr: new Set(
            json.results.bindings[0]?.dprs?.value
              ? json.results.bindings[0].dprs.value.split("|")
              : undefined,
          ),
          citetc: new Set(
            json.results.bindings[0]?.cites?.value
              ? json.results.bindings[0].cites.value.split("|")
              : undefined,
          ),
          treattn: new Set(
            json.results.bindings[0]?.trttns?.value
              ? json.results.bindings[0].trttns.value.split("|")
              : undefined,
          ),
          citetn: new Set(
            json.results.bindings[0]?.citetns?.value
              ? json.results.bindings[0].citetns.value.split("|")
              : undefined,
          ),
        },
      };
    } catch (error) {
      console.warn("SPARQL Error: " + error);
      return {
        materialCitations: [],
        figureCitations: [],
        treats: {
          def: new Set(),
          aug: new Set(),
          dpr: new Set(),
          citetc: new Set(),
          treattn: new Set(),
          citetn: new Set(),
        },
      };
    }
  }

  /** Allows iterating over the synonyms while they are found */
  [Symbol.asyncIterator](): AsyncIterator<Name> {
    let returnedSoFar = 0;
    return {
      next: () =>
        new Promise<IteratorResult<Name>>(
          (resolve, reject) => {
            const callback = () => {
              if (this.controller.signal.aborted) {
                reject(new Error("SynyonymGroup has been aborted"));
              } else if (returnedSoFar < this.names.length) {
                resolve({ value: this.names[returnedSoFar++] });
              } else if (this.isFinished) {
                resolve({ done: true, value: true });
              } else {
                const listener = () => {
                  this.monitor.removeEventListener("updated", listener);
                  callback();
                };
                this.monitor.addEventListener("updated", listener);
              }
            };
            callback();
          },
        ),
    };
  }
}

// TODO: CoL taxa without authority -- associate them with the Name directly
// eg. 5KTTT is "Quercus robur subsp. robur" w/o authority

/** The central object.
 *
 * Each `Name` exists because of a taxon-name, taxon-concept or col-taxon in the data.
 * Each `Name` is uniquely determined by its human-readable latin name (for taxa ranking below genus, this is a multi-part name — binomial or trinomial) and kingdom.
 */
export type Name = {
  /** taxonomic kingdom
   *
   * may be empty for some CoL-taxa with missing ancestors */
  kingdom: string;
  /** Human-readable name */
  displayName: string;
  /** taxonomic rank */
  rank: string;

  /** vernacular names */
  vernacularNames: Promise<vernacularNames>;

  // /** Contains the family tree / upper taxons accorindg to CoL / treatmentbank.
  //  * //TODO */
  // trees: Promise<{
  //   col?: Tree;
  //   tb?: Tree;
  // }>;

  /** The URI of the respective `dwcFP:TaxonName` if it exists */
  taxonNameURI?: string;

  /** Catalogue of Life-Data */
  col?: {
    /** The URI of the respective CoL-taxon if it exists
     *
     * Note that this is only for CoL-taxa which do not have an authority.
     */
    colURI: string;
    /** The URI of the corresponding accepted CoL-taxon if it exists.
     *
     * The same as URI if it is the accepted CoL-Taxon.
     *
     * May be the string "INVALID COL" if the colURI is not valid.
     */
    acceptedURI: string;
  };

  /** All `AuthorizedName`s with this name */
  authorizedNames: AuthorizedName[];

  /** How this name was found */
  justification: Justification;

  /** treatments directly associated with .taxonNameUri */
  treatments: {
    treats: Set<Treatment>;
    cite: Set<Treatment>;
  };
};

/**
 * A map from language tags (IETF) to an array of vernacular names.
 */
export type vernacularNames = Map<string, string[]>;

/** Why a given Name was found (ther migth be other possible justifications) */
export type Justification = {
  searchTerm: true;
  /** indicates that this is a subTaxon of the parent */
  subTaxon: boolean;
} | {
  searchTerm: false;
  parent: Name;
  /** if missing, indicates synonymy according to CoL or subTaxon */
  treatment?: Treatment;
};

/**
 * Corresponds to a taxon-concept or a CoL-Taxon
 */
export type AuthorizedName = {
  // TODO: neccesary?
  /** this may not be neccesary, as `AuthorizedName`s should only appear within a `Name` */
  // name: Name;
  /** Human-readable name */
  displayName: string;
  /** Human-readable authority */
  authority: string;
  /**
   * Human-readable authorities as given in the Data.
   */
  authorities: string[];

  /** The URIs of the respective `dwcFP:TaxonConcept` if it exists */
  taxonConceptURIs: string[];

  /** Catalogue of Life-Data */
  col?: {
    /** The URI of the respective CoL-taxon if it exists */
    colURI: string;
    /** The URI of the corresponding accepted CoL-taxon if it exists.
     *
     * The same as URI if it is the accepted CoL-Taxon.
     *
     * May be the string "INVALID COL" if the colURI is not valid.
     */
    acceptedURI: string;
  };

  // TODO: sensible?
  // /** these are CoL-taxa linked in the rdf, which differ lexically */
  // seeAlsoCol: string[];

  /** treatments directly associated with .taxonConceptURI */
  treatments: {
    def: Set<Treatment>;
    aug: Set<Treatment>;
    dpr: Set<Treatment>;
    cite: Set<Treatment>;
  };
};

/** A plazi-treatment */
export type Treatment = {
  url: string;
  date?: number;

  /** Details are behind a promise becuase they are loaded with a separate query. */
  details: Promise<TreatmentDetails>;
};

/** Details of a treatment */
export type TreatmentDetails = {
  materialCitations: MaterialCitation[];
  figureCitations: FigureCitation[];
  creators?: string;
  title?: string;
  treats: {
    def: Set<string>;
    aug: Set<string>;
    dpr: Set<string>;
    citetc: Set<string>;
    treattn: Set<string>;
    citetn: Set<string>;
  };
};

/** A cited material */
export type MaterialCitation = {
  "catalogNumber": string;
  "collectionCode"?: string;
  "typeStatus"?: string;
  "countryCode"?: string;
  "stateProvince"?: string;
  "municipality"?: string;
  "county"?: string;
  "locality"?: string;
  "verbatimLocality"?: string;
  "recordedBy"?: string;
  "eventDate"?: string;
  "samplingProtocol"?: string;
  "decimalLatitude"?: string;
  "decimalLongitude"?: string;
  "verbatimElevation"?: string;
  "gbifOccurrenceId"?: string;
  "gbifSpecimenId"?: string;
  "httpUri"?: string[];
};

/** A cited figure */
export type FigureCitation = {
  url: string;
  description?: string;
};
