import { JustificationSet, SparqlEndpoint } from "./mod.ts";

enum NameStatus {
  inProgress,
  done,
}

/** Finds all synonyms of a taxon */
export class SynonymGroup implements AsyncIterable<Name> {
  /** Indicates whether the SynonymGroup has found all synonyms.
   *
   * @readonly
   */
  isFinished = false;
  /** Indicates whether the SynonymGroup has been aborted.
   *
   * @readonly
   */
  isAborted = false;
  /** Used internally to watch for new names found */
  private monitor = new EventTarget();

  /** Used internally to abort in-flight network requests when SynonymGroup is aborted */
  private controller = new AbortController();

  /** The SparqlEndpoint used */
  private sparqlEndpoint: SparqlEndpoint;

  /**
   * List of names found so-far.
   *
   * Contains full list of synonyms _if_ .isFinished and not .isAborted
   *
   * @readonly
   */
  names: Name[] = [];
  private pushName(name: Name) {
    this.names.push(name);
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }
  private finish() {
    this.isFinished = true;
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }

  /** contains TN, TC, CoL uris of synonyms whose `Name` we have not yet constructed */
  private queue = new Set<string>();

  /** contains TN, TC, CoL uris of synonyms whose `Name` is being constructed or has been constructed. */
  private expanded = new Map<string, NameStatus>();

  /** Used internally to deduplicate treatments, maps from URI to Object */
  private treatments = new Map<string, Treatment>();

  /**
   * Constructs a SynonymGroup
   *
   * @param sparqlEndpoint SPARQL-Endpoint to query
   * @param taxonName either a string of the form "Genus species infraspecific" (species & infraspecific names optional), or an URI of a http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept or a CoL taxon URI
   * @param [ignoreRank=false] if taxonName is "Genus" or "Genus species", by default it will ony search for taxons of rank genus/species. If set to true, sub-taxa are also considered as staring points.
   */
  constructor(
    sparqlEndpoint: SparqlEndpoint,
    taxonName: string,
    ignoreRank = false,
  ) {
    this.sparqlEndpoint = sparqlEndpoint;

    // TODO use queue
    if (taxonName.startsWith("https://www.catalogueoflife.org")) {
      this.getNameFromCol(taxonName).then((name) => {
        this.pushName(name);
        this.finish();
      });
    }

    // TODO
  }

  private async getNameFromCol(colUri: string): Promise<Name> {
    // Note: this query assumes that there is no sub-species taxa with missing dwc:species
    // Note: the handling assumes that at most one taxon-name matches this colTaxon
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?genus ?species ?infrasp ?fullName ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites) WHERE {
  BIND(<${colUri}> as ?col)
  ?col dwc:taxonRank ?rank .
  ?col dwc:scientificNameAuthorship ?authority .
  ?col dwc:scientificName ?fullName . # Note: contains authority
  ?col dwc:genericName ?genus .
  OPTIONAL {
    ?col dwc:specificEpithet ?species .
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
  }

  OPTIONAL {
    ?tn a dwcFP:TaxonName .
    ?tn dwc:rank ?rank .
    ?tn dwc:genus ?genus .

    {
      ?col dwc:specificEpithet ?species .
      ?tn dwc:species ?species .
      {
        ?col dwc:infraspecificEpithet ?infrasp .
        ?tn dwc:subspecies|dwc:variety ?infrasp .
      } UNION {
        FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?infrasp . }
        FILTER NOT EXISTS { ?tn dwc:subspecies|dwc:variety ?infrasp . }
      }
    } UNION {
      FILTER NOT EXISTS { ?col dwc:specificEpithet ?species . }
      FILTER NOT EXISTS { ?tn dwc:species ?species . }
    }

    OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
    OPTIONAL { ?citetn treat:citesTaxonName ?tn . }

    OPTIONAL {
      ?tc treat:hasTaxonName ?tn ;
          dwc:scientificNameAuthorship ?tcauth ;
          a dwcFP:TaxonConcept .
      OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
      OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
      OPTIONAL { ?dpr treat:deprecates ?tc . }
      OPTIONAL { ?cite cito:cites ?tc . }
    }
  }
}
GROUP BY ?tn ?tc ?rank ?genus ?species ?infrasp ?fullName ?authority
LIMIT 500`;
    // For unclear reasons, the query breaks if the limit is removed.

    if (this.controller.signal?.aborted) return Promise.reject();

    /// ?tn ?tc !rank !genus ?species ?infrasp !fullName !authority ?tcAuth
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      "Starting Points",
    );

    const displayName: string = json.results.bindings[0].fullName!.value
      .replace(
        json.results.bindings[0].authority!.value,
        "",
      ).trim();

    const colName: AuthorizedName = {
      displayName,
      authority: json.results.bindings[0].authority!.value,
      colURI: colUri,
      treatments: {
        def: new Set(),
        aug: new Set(),
        dpr: new Set(),
        cite: new Set(),
      },
    };

    const authorizedNames = [colName];

    const taxonNameURI = json.results.bindings[0].tn?.value;

    for (const t of json.results.bindings) {
      if (t.tc) {
        if (t.tcAuth?.value.split(" / ").includes(colName.authority)) {
          // TODO tc is same as colName, get tretments and merge together
        } else if (t.tcAuth?.value) {
          authorizedNames.push({
            displayName,
            authority: t.tcAuth.value,
            taxonConceptURI: t.tc.value,
            treatments: {
              def: this.makeTreatmentSet(t.defs?.value.split("|")),
              aug: this.makeTreatmentSet(t.augs?.value.split("|")),
              dpr: this.makeTreatmentSet(t.dprs?.value.split("|")),
              cite: this.makeTreatmentSet(t.cites?.value.split("|")),
            },
          });
          // TODO get treatments
        }
      }
    }

    // TODO treatments
    // TODO handle queue/expandedNames/etc

    return {
      displayName,
      taxonNameURI,
      authorizedNames,
      justification: new JustificationSet("//TODO"),
      treatments: {
        treats: this.makeTreatmentSet(json.results.bindings[0].tntreats?.value.split("|")),
        cite: this.makeTreatmentSet(json.results.bindings[0].tncites?.value.split("|")),
      },
    };
  }

  private makeTreatmentSet (urls?: string[]): Set<Treatment> {
    if (!urls) return new Set<Treatment>();
    return new Set<Treatment>(
      urls.filter((url) => !!url).map((url) => {
        if (!this.treatments.has(url)) {
          this.treatments.set(url, {
            url,
            details: this.getTreatmentDetails(url),
          });
        }
        return this.treatments.get(url) as Treatment;
      }),
    );
  };

  private async getTreatmentDetails(
    treatmentUri: string,
  ): Promise<TreatmentDetails> {
    const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
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
WHERE {
  BIND (<${treatmentUri}> as ?treatment)
  ?treatment dc:creator ?creator .
  OPTIONAL { ?treatment trt:publishedIn/dc:date ?date . }
  OPTIONAL { ?treatment dc:title ?title }
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
      return { materialCitations: [], figureCitations: [] };
    }
    try {
      const json = await this.sparqlEndpoint.getSparqlResultSet(
        query,
        { signal: this.controller.signal },
        `Treatment Details for ${treatmentUri}`,
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
        { signal: this.controller.signal },
        `Figures for ${treatmentUri}`,
      )).results.bindings;
      const figureCitations = figures.filter((f) => f.url?.value).map(
        (f) => {
          return { url: f.url!.value, description: f.description?.value };
        },
      );
      return {
        creators: json.results.bindings[0]?.creators?.value,
        date: json.results.bindings[0]?.date?.value
          ? parseInt(json.results.bindings[0].date.value, 10)
          : undefined,
        title: json.results.bindings[0]?.title?.value,
        materialCitations,
        figureCitations,
      };
    } catch (error) {
      console.warn("SPARQL Error: " + error);
      return { materialCitations: [], figureCitations: [] };
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
              if (this.isAborted) {
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

/** The central object.
 *
 * Each `Name` exists because of a taxon-name, taxon-concept or col-taxon in the data.
 * Each `Name` is uniquely determined by its human-readable latin name (for taxa ranking below genus, this is a multi-part name — binomial or trinomial) and kingdom.
 */
export type Name = {
  /** taxonomic kingdom */
  // kingdom: string;
  /** Human-readable name */
  displayName: string;

  /** //TODO Promise? */
  // vernacularNames: Promise<vernacularNames>;
  // /** Contains the family tree / upper taxons accorindg to CoL / treatmentbank.
  //  * //TODO Promise? */
  // trees: Promise<{
  //   col?: Tree;
  //   tb?: Tree;
  // }>;

  /** The URI of the respective `dwcFP:TaxonName` if it exists */
  taxonNameURI?: string;
  /** All `AuthorizedName`s with this name */
  authorizedNames: AuthorizedName[];

  /** How this name was found */
  justification: JustificationSet;

  /** treatments directly associated with .taxonNameUri */
  treatments: {
    treats: Set<Treatment>;
    cite: Set<Treatment>;
  };
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

  /** The URI of the respective `dwcFP:TaxonConcept` if it exists */
  taxonConceptURI?: string;
  /** The URI of the respective CoL-taxon if it exists */
  colURI?: string;

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

  /** Details are behind a promise becuase they are loaded with a separate query. */
  details: Promise<TreatmentDetails>;
};

/** Details of a treatment */
export type TreatmentDetails = {
  materialCitations: MaterialCitation[];
  figureCitations: FigureCitation[];
  date?: number;
  creators?: string;
  title?: string;
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
