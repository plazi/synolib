// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
import { JustificationSet } from "./JustificationSet.ts";
// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
export * from "./JustificationSet.ts";

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

export type TreatmentDetails = {
  materialCitations: MaterialCitation[];
  figureCitations: FigureCitation[];
  date?: number;
  creators?: string;
  title?: string;
};

export type Treatment = {
  url: string;
  details: Promise<TreatmentDetails>;
};

/**
 * Describes a taxonomic name (http://filteredpush.org/ontologies/oa/dwcFP#TaxonName)
 */
export type TaxonName = {
  uri: string;
  treatments: {
    aug: Set<Treatment>;
    cite: Set<Treatment>;
  };
  /** Human-readable taxon-name */ displayName: string;
  vernacularNames: Promise<vernacularNames>;
  loading: boolean;
};

/**
 * A map from language tags (IETF) to an array of vernacular names.
 */
export type vernacularNames = Record<string, string[]>;

type Treatments = {
  def: Set<Treatment>;
  aug: Set<Treatment>;
  dpr: Set<Treatment>;
  cite: Set<Treatment>;
};
export type JustifiedSynonym = {
  taxonConceptUri: string;
  taxonName: TaxonName;
  /** Human-readable authority */ taxonConceptAuthority?: string;
  justifications: JustificationSet;
  treatments: Treatments;
  loading: boolean;
};

async function sleep(ms: number): Promise<void> {
  const p = new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
  return await p;
}

type SparqlJson = {
  head: {
    vars: string[];
  };
  results: {
    bindings: {
      [key: string]: { type: string; value: string; "xml:lang"?: string };
    }[];
  };
};

/**
 * Represents a remote sparql endpoint and provides a uniform way to run queries.
 */
export class SparqlEndpoint {
  constructor(private sparqlEnpointUri: string) {
  }

  /**
   * Run a query against the sparql endpoint
   *
   * It automatically retries up to 10 times on fetch errors, waiting 50ms on the first retry and doupling the wait each time.
   * Retries are logged to the console (`console.warn`)
   *
   * @throws In case of non-ok response status codes or if fetch failed 10 times.
   * @param query The sparql query to run against the endpoint
   * @param fetchOptions Additional options for the `fetch` request
   * @param _reason (Currently ignored, used internally for debugging purposes)
   * @returns Results of the query
   */
  async getSparqlResultSet(
    query: string,
    fetchOptions: RequestInit = {},
    _reason = "",
  ) {
    fetchOptions.headers = fetchOptions.headers || {};
    (fetchOptions.headers as Record<string, string>)["Accept"] =
      "application/sparql-results+json";
    let retryCount = 0;
    const sendRequest = async (): Promise<SparqlJson> => {
      try {
        // console.info(`SPARQL ${_reason} (${retryCount + 1})`);
        const response = await fetch(
          this.sparqlEnpointUri + "?query=" + encodeURIComponent(query),
          fetchOptions,
        );
        if (!response.ok) {
          throw new Error("Response not ok. Status " + response.status);
        }
        return await response.json();
      } catch (error) {
        if (fetchOptions.signal?.aborted) {
          throw error;
        } else if (retryCount < 10) {
          const wait = 50 * (1 << retryCount++);
          console.warn(`!! Fetch Error. Retrying in ${wait}ms (${retryCount})`);
          await sleep(wait);
          return await sendRequest();
        }
        console.warn("!! Fetch Error:", query, "\n---\n", error);
        throw error;
      }
    };
    return await sendRequest();
  }
}

export default class SynonymGroup implements AsyncIterable<JustifiedSynonym> {
  justifiedArray: JustifiedSynonym[] = [];
  monitor = new EventTarget();
  isFinished = false;
  isAborted = false;

  /** Maps from url to object */
  treatments: Map<string, Treatment> = new Map();
  taxonNames: Map<string, TaxonName> = new Map();

  private controller = new AbortController();

  constructor(
    sparqlEndpoint: SparqlEndpoint,
    taxonName: string,
    ignoreRank = false,
  ) {
    /** Maps from taxonConceptUris to their synonyms */
    const justifiedSynonyms: Map<string, number> = new Map();
    const expandedTaxonNames: Set<string> = new Set();

    const resolver = (value: JustifiedSynonym | true) => {
      if (value === true) {
        //console.info("%cSynogroup finished", "color: #00E676;");
        this.isFinished = true;
      }
      this.monitor.dispatchEvent(new CustomEvent("updated"));
    };

    const fetchInit = { signal: this.controller.signal };

    async function getTreatmentDetails(
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
<${treatmentUri}> dc:creator ?creator .
OPTIONAL { <${treatmentUri}> trt:publishedIn/dc:date ?date . }
OPTIONAL { <${treatmentUri}> dc:title ?title }
OPTIONAL {
  <${treatmentUri}> dwc:basisOfRecord ?mc .
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
      if (fetchInit.signal.aborted) {
        return { materialCitations: [], figureCitations: [] };
      }
      try {
        const json = await sparqlEndpoint.getSparqlResultSet(
          query,
          fetchInit,
          `Treatment Details for ${treatmentUri}`,
        );
        const materialCitations: MaterialCitation[] = json.results.bindings
          .filter((t) => t.mc && t.catalogNumbers?.value).map((t) => {
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
        const figureQuery = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${treatmentUri}> cito:cites ?cites .
  ?cites a fabio:Figure ;
    fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `;
        const figures = (await sparqlEndpoint.getSparqlResultSet(
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

    const makeTreatmentSet = (urls?: string[]): Set<Treatment> => {
      if (!urls) return new Set<Treatment>();
      return new Set<Treatment>(
        urls.filter((url) => !!url).map((url) => {
          if (!this.treatments.has(url)) {
            this.treatments.set(url, {
              url,
              details: getTreatmentDetails(url),
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
        const [genus, species, subspecies] = taxonName.split(" ");
        // subspecies could also be variety
        // ignoreRank has no effect when there is a 'subspecies', as this is assumed to be the lowest rank & should thus not be able to return results in another rank
        const query = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?tn ?name ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ?tc dwc:genus "${genus}";
      treat:hasTaxonName ?tn;
      ${species ? `dwc:species "${species}";` : ""}
      ${subspecies ? `(dwc:subspecies|dwc:variety) "${subspecies}";` : ""}
      ${
          ignoreRank || !!subspecies
            ? ""
            : `dwc:rank "${species ? "species" : "genus"}";`
        }
      a <http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept>.
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
                .map((t) => {
                  return {
                    taxonConceptUri: t.tc.value,
                    taxonName: makeTaxonName(
                      t.tn.value,
                      t.name?.value,
                      t.trtns?.value.split("|"),
                      t.citetns?.value.split("|"),
                    ),
                    taxonConceptAuthority: t.authority?.value,
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
  ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites)
WHERE {
  ?tc treat:hasTaxonName <${taxon.taxonName.uri}> .
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
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
  ?tn ?name ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?justification; separator="|") as ?justs) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
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
            json.results.bindings.filter((t) => t.tc).map((t) => {
              return {
                taxonConceptUri: t.tc.value,
                taxonName: makeTaxonName(
                  t.tn.value,
                  t.name?.value,
                  t.trtns?.value.split("|"),
                  t.citetns?.value.split("|"),
                ),
                taxonConceptAuthority: t.authority?.value,
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
            }), (error) => {
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
  ?tn ?name ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?justification; separator="|") as ?justs) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
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
            json.results.bindings.filter((t) => t.tc).map((t) => {
              return {
                taxonConceptUri: t.tc.value,
                taxonName: makeTaxonName(
                  t.tn.value,
                  t.name?.value,
                  t.trtns?.value.split("|"),
                  t.citetns?.value.split("|"),
                ),
                taxonConceptAuthority: t.authority?.value,
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
            }), (error) => {
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
