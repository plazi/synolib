import { SparqlEndpoint } from "./SparqlEndpoint.ts";

export class SynonymGroup implements AsyncIterableIterator<Name> {
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

  /**
   * Constructs a SynonymGroup
   *
   * @param sparqlEndpoint SPARQL-Endpoint to query
   * @param taxonName either a string of the form "Genus species infraspecific" (species & infraspecific names optional), or an URI of a http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept or a CoL taxon URI
   * @param [ignoreRank=false] if taxonName is "Genus" or "Genus species", by default it will ony search for taxons of rank genus/species. If set to true, sub-taxa are also considered as staring points.
   */
  constructor(private sparqlEndpoint: SparqlEndpoint, taxonName: string, ignoreRank = false) {};

  /**
   * Aborts the SynonymGroup
  */
  abort(): void {};
}

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
export type vernacularNames =  Map<string, string[]>;

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