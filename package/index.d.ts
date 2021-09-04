interface Justification {
    toString: () => string;
    precedingSynonym?: JustifiedSynonym;
}
export declare type Treatment = {
    url: string;
    date?: number;
    creators?: string;
};
interface TreatmentJustification extends Justification {
    treatment: Treatment;
}
declare type LexicalJustification = Justification;
export declare type anyJustification = (TreatmentJustification | LexicalJustification);
export declare type anySyncJustification = {
    toString: () => string;
    precedingSynonym?: JustifiedSynonym;
    treatment?: Treatment;
};
export declare class JustificationSet implements AsyncIterable<anyJustification> {
    private monitor;
    contents: anyJustification[];
    isFinished: boolean;
    isAborted: boolean;
    entries: () => IterableIterator<[anyJustification, anyJustification]>;
    constructor(iterable?: Iterable<anyJustification>);
    get size(): Promise<number>;
    add(value: anyJustification): this;
    finish(): void;
    forEachCurrent(cb: (val: anyJustification) => void): void;
    first(): Promise<anyJustification>;
    [Symbol.toStringTag]: string;
    [Symbol.asyncIterator](): {
        next: () => Promise<IteratorResult<anyJustification, any>>;
    };
}
declare class TreatmentSet implements AsyncIterable<Treatment> {
    private monitor;
    contents: Treatment[];
    isFinished: boolean;
    isAborted: boolean;
    constructor(iterable?: Iterable<Treatment>);
    get size(): Promise<number>;
    add(value: Treatment): this;
    finish(): void;
    [Symbol.asyncIterator](): {
        next: () => Promise<IteratorResult<Treatment, any>>;
    };
}
declare type Treatments = {
    def: TreatmentSet;
    aug: TreatmentSet;
    dpr: TreatmentSet;
};
export declare type SyncTreatments = {
    def: Treatment[];
    aug: Treatment[];
    dpr: Treatment[];
};
export declare type JustifiedSynonym = {
    taxonConceptUri: string;
    taxonNameUri: string;
    justifications: JustificationSet;
    treatments: Treatments;
    loading: boolean;
};
export declare type SyncJustifiedSynonym = {
    taxonConceptUri: string;
    taxonNameUri: string;
    justifications: anySyncJustification[];
    treatments: SyncTreatments;
    loading: boolean;
};
declare type SparqlEndpoint = {
    getSparqlResultSet: (query: string, fetchOptions?: any) => Promise<SparqlJson>;
};
declare type SparqlJson = {
    head: {
        vars: string[];
    };
    results: {
        bindings: {
            [key: string]: {
                type: string;
                value: string;
            };
        }[];
    };
};
export declare class SynonymGroup implements AsyncIterable<JustifiedSynonym> {
    justifiedArray: JustifiedSynonym[];
    monitor: EventTarget;
    isFinished: boolean;
    isAborted: boolean;
    constructor(sparqlEndpoint: SparqlEndpoint, taxonName: string, ignoreRank?: boolean);
    abort(): void;
    [Symbol.asyncIterator](): {
        next: () => Promise<IteratorResult<JustifiedSynonym, any>>;
    };
}
export {};
//# sourceMappingURL=index.d.ts.map