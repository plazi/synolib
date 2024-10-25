import { JustificationSet } from "./mod.ts";

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

  /**
   * List of names found so-far.
   *
   * Contains full list of synonyms _if_ .isFinished and not .isAborted
   *
   * @readonly
   */
  names = new Array<Name>();

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
  kingdom: string;
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
    aug: Set<Treatment>;
    cite: Set<Treatment>;
  };
};

/**
 * Corresponds to a taxon-concept or a CoL-Taxon
 */
export type AuthorizedName = {
  // TODO: neccesary?
  /** this may not be neccesary, as `AuthorizedName`s should only appear within a `Name` */
  name: Name;
  /** Human-readable authority */
  taxonConceptAuthority?: string;

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
