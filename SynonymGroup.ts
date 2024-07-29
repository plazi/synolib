// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
import { JustificationSet } from "./JustificationSet.ts";
// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
export * from "./JustificationSet.ts";
// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
import { SparqlEndpoint, SparqlJson } from "./SparqlEndpoint.ts";
// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
export * from "./SparqlEndpoint.ts";

/**
 * Maps to a taxon-concept or is implied by a CoL taxon.
 *
 * As we assume a mostly 1:1 relationship between Name and authorizedNames,
 * all information about a Name and its authorizedNames is collected in one request.
 *
 * //TODO: The only potential exception are vernacular Names and the Trees,
 * it might make sense to get these via additional requests.
 */
export type Name = {
  /** taxonomic kingdom */
  kingdom: string;
  /** Human-readable name */
  displayName: string;

  /** //TODO Promise? */
  vernacularNames: Promise<vernacularNames>;
  /** Contains the family tree / upper taxons accorindg to CoL / treatmentbank.
   * //TODO Promise? */
  trees: Promise<{
    col?: Tree;
    tb?: Tree;
  }>;

  taxonNameURI?: string;
  authorizedNames: AuthorizedName[];

  /** How this name was found */
  justification: Promise<Set<string>>;

  /** treatments directly associated with .taxonNameUri */
  treatments: {
    aug: Set<Treatment>;
    cite: Set<Treatment>;
  };
};

/**
 * A map from language tags (IETF) to an array of vernacular names.
 */
export type vernacularNames = Map<string, string[]>;

/** A map from rank to name */
export type Tree = Map<string, string[]>;

// TODO: replace all `Set<Treatment>` with `Treatments`?
// If so, `TreatmentDetails` should probably gain a .url field.
/** A map from treatment uri to it's details */
export type Treatments = Map<string, Promise<TreatmentDetails>>;

/**
 * Maps to ataxon-concept or a CoL-Taxon
 */
export type AuthorizedName = {
  // TODO: neccesairy?
  /** this may not be neccesary, as `AuthorizedName`s should only appear within a `Name` */
  name: Name;
  /** Human-readable authority */
  taxonConceptAuthority?: string;

  taxonConceptURI?: string;
  /** the referenced taxon must match lexically (name & authority) */
  colURI?: string;
  /** these are CoL-taxa linked in the rdf, which differ lexically */
  seeAlsoCol: string[];

  treatments: {
    def: Set<Treatment>;
    aug: Set<Treatment>;
    dpr: Set<Treatment>;
    cite: Set<Treatment>;
  };
};

export type Treatment = {
  url: string;
  details: Promise<TreatmentDetails>;
};

export type TreatmentDetails = {
  materialCitations: MaterialCitation[];
  figureCitations: FigureCitation[];
  date?: number;
  creators?: string;
  title?: string;
};

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

export type FigureCitation = {
  url: string;
  description?: string;
};

enum NameStatus {
  inProgress,
  done,
}

export class SynonymGroup implements AsyncIterable<Name> {
  isFinished = false;
  isAborted = false;

  /** List of names found so-far */
  private names = new Array<Name>();

  /*
    How to keep track of what is left to expand and what is already expanded?

    There are four reasons a Name is found:
    - it is the search term and exists (we do not need to queue this)
    - a TN has a treatment which references it -> TN in queue
    - a TC has a treatment which references it -> TC in queue
    - we found a TN or TC which links to a CoL which differs in name or authority -> CoL in Queue

    --> Queue contains TN, TC, CoL uris
    --> we also keep a list of uris which are being expanded (in-flight)
    --> we also keep a list of uris which have been expanded

    For all of these, if we find a new Name we need to check if there are implict synonyms,
    i.e. other TC or CoL taxa with same name.
  */

  private queue = new Set<string>();

  /** maps from URI to Object */
  private expanded = new Map<string, NameStatus>();

  /** Used internally to watch for new names found */
  private monitor = new EventTarget();

  /** Used internally to deduplicate treatments, maps from URI to Object */
  private treatments = new Map<string, Treatment>();

  /** Used internally to abort in-flight network requests when SynonymGroup is aborted */
  private controller = new AbortController();

  private async getTreatmentDetails(
    treatmentUri: string,
    fetchInit: RequestInit,
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
    if (fetchInit.signal?.aborted) {
      return { materialCitations: [], figureCitations: [] };
    }
    try {
      const json = await this.sparqlEndpoint.getSparqlResultSet(
        query,
        fetchInit,
        `Treatment Details for ${treatmentUri}`,
      );
      const materialCitations: MaterialCitation[] = json.results.bindings
        .filter((t) => t.mc && t.catalogNumbers?.value)
        .map((t) => {
          const httpUri = t.httpUris?.value?.split("|");
          return {
            "catalogNumber": t.catalogNumbers.value,
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
        fetchInit,
        `Figures for ${treatmentUri}`,
      )).results.bindings;
      const figureCitations = figures.filter((f) => f.url?.value).map(
        (f) => {
          return { url: f.url.value, description: f.description?.value };
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

  /**
   * Constructs a SynonymGroup
   *
   * @param sparqlEndpoint SPARQL-Endpoint to query
   * @param taxonName either a string of the form "Genus species infraspecific" (species & infraspecific names optional), or an URI of a http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept or a CoL taxon URI
   * @param [ignoreRank=false] if taxonName is "Genus" or "Genus species", by default it will ony search for taxons of rank genus/species. If set to true, sub-taxa are also considered as staring points.
   */
  constructor(
    private sparqlEndpoint: SparqlEndpoint,
    taxonName: string,
    ignoreRank = false,
  ) {
    const resolver = (value: Name | true) => {
      if (value === true) {
        //console.info("%cSynogroup finished", "color: #00E676;");
        this.isFinished = true;
      }
      this.monitor.dispatchEvent(new CustomEvent("updated"));
    };

    const fetchInit = { signal: this.controller.signal };

    const makeTreatmentSet = (urls?: string[]): Set<Treatment> => {
      if (!urls) return new Set<Treatment>();
      return new Set<Treatment>(
        urls.filter((url) => !!url).map((url) => {
          if (!this.treatments.has(url)) {
            this.treatments.set(url, {
              url,
              details: this.getTreatmentDetails(url, fetchInit),
            });
          }
          return this.treatments.get(url) as Treatment;
        }),
      );
    };

    async function getVernacular(
      uri: string,
    ): Promise<Record<string, string[]>> {
      const result: Record<string, string[]> = {};
      const query =
        `SELECT DISTINCT ?n WHERE { <${uri}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`;
      const bindings =
        (await sparqlEndpoint.getSparqlResultSet(query)).results.bindings;
      for (const b of bindings) {
        if (b.n.value) {
          if (b.n["xml:lang"]) {
            if (!result[b.n["xml:lang"]]) result[b.n["xml:lang"]] = [];
            result[b.n["xml:lang"]].push(b.n.value);
          } else {
            if (!result["??"]) result["??"] = [];
            result["??"].push(b.n.value);
          }
        }
      }
      return result;
    }

    const makeTaxonName = (
      uri: string,
      name: string,
      aug?: string[],
      cite?: string[],
    ) => {
      if (!this.taxonNames.has(uri)) {
        this.taxonNames.set(uri, {
          uri,
          loading: true,
          displayName: name,
          vernacularNames: getVernacular(uri),
          treatments: {
            aug: makeTreatmentSet(aug),
            cite: makeTreatmentSet(cite),
          },
        });
      }
      return this.taxonNames.get(uri) as TaxonName;
    };

    const build = async () => {
      const getStartingPoints = (
        taxonName: string,
      ): Promise<JustifiedSynonym[]> => {
        if (fetchInit.signal.aborted) return Promise.resolve([]);
        let taxonNameQuery = "";
        if (taxonName.startsWith("http")) {
          if (taxonName.includes("catalogueoflife.org")) {
            taxonNameQuery =
              `?tc <http://www.w3.org/2000/01/rdf-schema#seeAlso> <${taxonName}> .`;
          } else {
            taxonNameQuery = `BIND(<${taxonName}> as ?tc)`;
          }
        } else {
          const [genus, species, subspecies] = taxonName.split(" ");
          // subspecies could also be variety
          // ignoreRank has no effect when there is a 'subspecies', as this is assumed to be the lowest rank & should thus not be able to return results in another rank
          taxonNameQuery = `?tc dwc:genus "${genus}" .`;
          if (species) taxonNameQuery += ` ?tc dwc:species "${species}" .`;
          if (subspecies) {
            taxonNameQuery +=
              ` ?tc (dwc:subspecies|dwc:variety) "${subspecies}" .`;
          }
          if (!subspecies && !ignoreRank) {
            taxonNameQuery += ` ?tc dwc:rank "${
              species ? "species" : "genus"
            }" .`;
          }
        }
        const query = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?tn ?name ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?colid; separator="|") as ?colids) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ${taxonNameQuery}
  ?tc treat:hasTaxonName ?tn ;
      a <http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept>.
  OPTIONAL { ?tc <http://www.w3.org/2000/01/rdf-schema#seeAlso> ?colid . }
  ?tn dwc:genus ?genus .
  OPTIONAL { ?tn dwc:subGenus ?subgenus . }
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subSpecies ?subspecies . }
    OPTIONAL { ?tn dwc:variety ?variety . }
  }
  BIND(CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), COALESCE(CONCAT(" ", ?subspecies), ""), COALESCE(CONCAT(" var. ", ?variety), "")) as ?name)
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
  OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn treat:citesTaxonName ?tn . }
}
GROUP BY ?tn ?name ?tc`;
        // console.info('%cREQ', 'background: red; font-weight: bold; color: white;', `getStartingPoints('${taxonName}')`)
        if (fetchInit.signal.aborted) return Promise.resolve([]);
        return sparqlEndpoint.getSparqlResultSet(
          query,
          fetchInit,
          "Starting Points",
        )
          .then(
            (json: SparqlJson) =>
              json.results.bindings.filter((t) => (t.tc && t.tn))
                .map((t): JustifiedSynonym => {
                  return {
                    taxonConceptUri: t.tc.value,
                    taxonName: makeTaxonName(
                      t.tn.value,
                      t.name?.value,
                      t.trtns?.value.split("|"),
                      t.citetns?.value.split("|"),
                    ),
                    taxonConceptAuthority: t.authority?.value,
                    colID: t.colids?.value.split("|").filter((s) =>
                      s.startsWith(
                        "https://www.catalogueoflife.org/data/taxon/",
                      )
                    ),
                    justifications: new JustificationSet([
                      `${t.tc.value} matches "${taxonName}"`,
                    ]),
                    treatments: {
                      def: makeTreatmentSet(t.defs?.value.split("|")),
                      aug: makeTreatmentSet(t.augs?.value.split("|")),
                      dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                      cite: makeTreatmentSet(t.cites?.value.split("|")),
                    },
                    loading: true,
                  };
                }),
            (error) => {
              console.warn("SPARQL Error: " + error);
              return [];
            },
          );
      };

      const synonymFinders = [
        /** Get the Synonyms having the same {taxon-name} */
        (taxon: JustifiedSynonym): Promise<JustifiedSynonym[]> => {
          const query = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?colid; separator="|") as ?colids) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites)
WHERE {
  ?tc treat:hasTaxonName <${taxon.taxonName.uri}> .
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?tc <http://www.w3.org/2000/01/rdf-schema#seeAlso> ?colid . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
}
GROUP BY ?tc`;
          // console.info('%cREQ', 'background: red; font-weight: bold; color: white;', `synonymFinder[0]( ${taxon.taxonConceptUri} )`)
          // Check wether we already expanded this taxon name horizontally - otherwise add
          if (expandedTaxonNames.has(taxon.taxonName.uri)) {
            return Promise.resolve([]);
          }
          expandedTaxonNames.add(taxon.taxonName.uri);
          if (fetchInit.signal.aborted) return Promise.resolve([]);
          return sparqlEndpoint.getSparqlResultSet(
            query,
            fetchInit,
            `Same taxon name ${taxon.taxonConceptUri}`,
          ).then((
            json: SparqlJson,
          ) => {
            taxon.taxonName.loading = false;
            return json.results.bindings.filter((t) => t.tc).map(
              (t): JustifiedSynonym => {
                return {
                  taxonConceptUri: t.tc.value,
                  taxonName: taxon.taxonName,
                  taxonConceptAuthority: t.authority?.value,
                  colID: t.colids?.value.split("|").filter((s) =>
                    s.startsWith("https://www.catalogueoflife.org/data/taxon/")
                  ),
                  justifications: new JustificationSet([{
                    toString: () =>
                      `${t.tc.value} has taxon name ${taxon.taxonName.uri}`,
                    precedingSynonym: taxon,
                  }]),
                  treatments: {
                    def: makeTreatmentSet(t.defs?.value.split("|")),
                    aug: makeTreatmentSet(t.augs?.value.split("|")),
                    dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                    cite: makeTreatmentSet(t.cites?.value.split("|")),
                  },
                  loading: true,
                };
              },
            );
          }, (error) => {
            console.warn("SPARQL Error: " + error);
            return [];
          });
        },
        /** Get the Synonyms deprecating {taxon} */
        (taxon: JustifiedSynonym): Promise<JustifiedSynonym[]> => {
          const query = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?tn ?name ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?colid; separator="|") as ?colids) (group_concat(DISTINCT ?justification; separator="|") as ?justs) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ?justification treat:deprecates <${taxon.taxonConceptUri}> ;
                 (treat:augmentsTaxonConcept|treat:definesTaxonConcept) ?tc .
  ?tc <http://plazi.org/vocab/treatment#hasTaxonName> ?tn .
  ?tn dwc:genus ?genus .
  OPTIONAL { ?tn dwc:subGenus ?subgenus . }
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subSpecies ?subspecies . }
    OPTIONAL { ?tn dwc:variety ?variety . }
  }
  BIND(CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), COALESCE(CONCAT(" ", ?subspecies), ""), COALESCE(CONCAT(" var. ", ?variety), "")) as ?name)
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?tc <http://www.w3.org/2000/01/rdf-schema#seeAlso> ?colid . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
  OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn treat:citesTaxonName ?tn . }
}
GROUP BY ?tn ?name ?tc`;
          // console.info('%cREQ', 'background: red; font-weight: bold; color: white;', `synonymFinder[1]( ${taxon.taxonConceptUri} )`)
          if (fetchInit.signal.aborted) return Promise.resolve([]);
          return sparqlEndpoint.getSparqlResultSet(
            query,
            fetchInit,
            `Deprecating     ${taxon.taxonConceptUri}`,
          ).then((
            json: SparqlJson,
          ) =>
            json.results.bindings.filter((t) => t.tc).map(
              (t): JustifiedSynonym => {
                return {
                  taxonConceptUri: t.tc.value,
                  taxonName: makeTaxonName(
                    t.tn.value,
                    t.name?.value,
                    t.trtns?.value.split("|"),
                    t.citetns?.value.split("|"),
                  ),
                  taxonConceptAuthority: t.authority?.value,
                  colID: t.colids?.value.split("|").filter((s) =>
                    s.startsWith("https://www.catalogueoflife.org/data/taxon/")
                  ),
                  justifications: new JustificationSet(
                    t.justs?.value.split("|").map((url) => {
                      if (!this.treatments.has(url)) {
                        this.treatments.set(url, {
                          url,
                          details: getTreatmentDetails(url),
                        });
                      }
                      return {
                        toString: () =>
                          `${t.tc.value} deprecates ${taxon.taxonConceptUri} according to ${url}`,
                        precedingSynonym: taxon,
                        treatment: this.treatments.get(url),
                      };
                    }),
                  ),
                  treatments: {
                    def: makeTreatmentSet(t.defs?.value.split("|")),
                    aug: makeTreatmentSet(t.augs?.value.split("|")),
                    dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                    cite: makeTreatmentSet(t.cites?.value.split("|")),
                  } as Treatments,
                  loading: true,
                };
              },
            ), (error) => {
            console.warn("SPARQL Error: " + error);
            return [];
          });
        },
        /** Get the Synonyms deprecated by {taxon} */
        (taxon: JustifiedSynonym): Promise<JustifiedSynonym[]> => {
          const query = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?tn ?name ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?colid; separator="|") as ?colids) (group_concat(DISTINCT ?justification; separator="|") as ?justs) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ?justification (treat:augmentsTaxonConcept|treat:definesTaxonConcept) <${taxon.taxonConceptUri}> ;
                 treat:deprecates ?tc .
  ?tc <http://plazi.org/vocab/treatment#hasTaxonName> ?tn .
  ?tn dwc:genus ?genus .
  OPTIONAL { ?tn dwc:subGenus ?subgenus . }
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subSpecies ?subspecies . }
    OPTIONAL { ?tn dwc:variety ?variety . }
  }
  BIND(CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), COALESCE(CONCAT(" ", ?subspecies), ""), COALESCE(CONCAT(" var. ", ?variety), "")) as ?name)
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?tc <http://www.w3.org/2000/01/rdf-schema#seeAlso> ?colid . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
  OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn treat:citesTaxonName ?tn . }
}
GROUP BY ?tn ?name ?tc`;
          // console.info('%cREQ', 'background: red; font-weight: bold; color: white;', `synonymFinder[2]( ${taxon.taxonConceptUri} )`)
          if (fetchInit.signal.aborted) return Promise.resolve([]);
          return sparqlEndpoint.getSparqlResultSet(
            query,
            fetchInit,
            `Deprecated by   ${taxon.taxonConceptUri}`,
          ).then((
            json: SparqlJson,
          ) =>
            json.results.bindings.filter((t) => t.tc).map(
              (t): JustifiedSynonym => {
                return {
                  taxonConceptUri: t.tc.value,
                  taxonName: makeTaxonName(
                    t.tn.value,
                    t.name?.value,
                    t.trtns?.value.split("|"),
                    t.citetns?.value.split("|"),
                  ),
                  taxonConceptAuthority: t.authority?.value,
                  colID: t.colids?.value.split("|").filter((s) =>
                    s.startsWith("https://www.catalogueoflife.org/data/taxon/")
                  ),
                  justifications: new JustificationSet(
                    t.justs?.value.split("|").map((url) => {
                      if (!this.treatments.has(url)) {
                        this.treatments.set(url, {
                          url,
                          details: getTreatmentDetails(url),
                        });
                      }
                      return {
                        toString: () =>
                          `${t.tc.value} deprecates ${taxon.taxonConceptUri} according to ${url}`,
                        precedingSynonym: taxon,
                        treatment: this.treatments.get(url),
                      };
                    }),
                  ),
                  treatments: {
                    def: makeTreatmentSet(t.defs?.value.split("|")),
                    aug: makeTreatmentSet(t.augs?.value.split("|")),
                    dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                    cite: makeTreatmentSet(t.cites?.value.split("|")),
                  } as Treatments,
                  loading: true,
                };
              },
            ), (error) => {
            console.warn("SPARQL Error: " + error);
            return [];
          });
        },
      ];

      async function lookUpRound(
        taxon: JustifiedSynonym,
      ): Promise<JustifiedSynonym[]> {
        // await new Promise(resolve => setTimeout(resolve, 3000)) // 3 sec
        // console.log('%cSYG', 'background: blue; font-weight: bold; color: white;', `lookupRound( ${taxon.taxonConceptUri} )`)
        const foundGroupsP = synonymFinders.map((finder) => finder(taxon));
        const foundGroups = await Promise.all(foundGroupsP);
        return foundGroups.reduce((a, b) => a.concat(b), []);
      }

      const finish = (justsyn: JustifiedSynonym) => {
        justsyn.justifications.finish();
        justsyn.loading = false;
      };

      let justifiedSynsToExpand: JustifiedSynonym[] = await getStartingPoints(
        taxonName,
      );
      justifiedSynsToExpand.forEach((justsyn) => {
        finish(justsyn);
        justifiedSynonyms.set(
          justsyn.taxonConceptUri,
          this.justifiedArray.push(justsyn) - 1,
        );
        resolver(justsyn);
      });
      const expandedTaxonConcepts: Set<string> = new Set();
      while (justifiedSynsToExpand.length > 0) {
        const foundThisRound: string[] = [];
        const promises = justifiedSynsToExpand.map(
          async (j): Promise<boolean> => {
            if (expandedTaxonConcepts.has(j.taxonConceptUri)) return false;
            expandedTaxonConcepts.add(j.taxonConceptUri);
            const newSynonyms = await lookUpRound(j);
            newSynonyms.forEach((justsyn) => {
              // Check whether we know about this synonym already
              if (justifiedSynonyms.has(justsyn.taxonConceptUri)) {
                // Check if we found that synonym in this round
                if (~foundThisRound.indexOf(justsyn.taxonConceptUri)) {
                  justsyn.justifications.forEachCurrent((jsj) => {
                    this
                      .justifiedArray[
                        justifiedSynonyms.get(justsyn.taxonConceptUri)!
                      ].justifications.add(jsj);
                  });
                }
              } else {
                finish(justsyn);
                justifiedSynonyms.set(
                  justsyn.taxonConceptUri,
                  this.justifiedArray.push(justsyn) - 1,
                );
                resolver(justsyn);
              }
              if (!expandedTaxonConcepts.has(justsyn.taxonConceptUri)) {
                justifiedSynsToExpand.push(justsyn);
                foundThisRound.push(justsyn.taxonConceptUri);
              }
            });
            return true;
          },
        );
        justifiedSynsToExpand = [];
        await Promise.allSettled(promises);
      }
      resolver(true);
    };

    build();
  }

  abort() {
    this.isAborted = true;
    this.controller.abort();
  }

  [Symbol.asyncIterator]() {
    let returnedSoFar = 0;
    return {
      next: () => {
        return new Promise<IteratorResult<JustifiedSynonym>>(
          (resolve, reject) => {
            const _ = () => {
              if (this.isAborted) {
                reject(new Error("SynyonymGroup has been aborted"));
              } else if (returnedSoFar < this.justifiedArray.length) {
                resolve({ value: this.justifiedArray[returnedSoFar++] });
              } else if (this.isFinished) {
                resolve({ done: true, value: true });
              } else {
                const listener = () => {
                  this.monitor.removeEventListener("updated", listener);
                  _();
                };
                this.monitor.addEventListener("updated", listener);
              }
            };
            _();
          },
        );
      },
    };
  }
}
