import type { SparqlEndpoint } from "./SparqlEndpoint.ts";

// Because the previously used queries are very complicated and take a long time to execute, this is
// an attempt at splitting them into smaller, easier ones.
//
// We have the following queries:
// Latin Name → CoL
// Latin Name → TN + TC (with treatments)
// CoL → CoL synonyms + Latin Names
// TODO: treatment → TN + TC + Latin Name (with relationship to treatment)

/** Latin Name, split up into parts. */
export type LatinName = {
    /** undefined is interpreted as "any rank" */
    rank?: string;
    kingdom?: string;
    genericName: string;
    infragenericEpithet?: string;
    specificEpithet?: string;
    infraspecificEpithet?: string;
    // TODO: cultivarEpithet?
    /** if true, missing epithets are FILTER NOT EXISTS
     *
     * TODO: this seems rather slow
     */
    // noMissing: boolean;
};

export type ColResult = {
    colUri: string;
    humanReadable: string;
    authority: string | undefined;
    status: string;
    latinName: LatinName;
};

export type ColSynonyms = {
    accepted: ColResult;
    synonyms: Set<ColResult>;
};

export type PlaziResult = {
    tnUri: string;
    humanReadable: string;
    authorized: {
        tcUri: string;
        authority: string;
        /** treatments: uri;date|uri;date|... */
        augs: string;
        /** treatments: uri;date|uri;date|... */
        dprs: string;
        /** treatments: uri;date|uri;date|... */
        cites: string;
    }[];
    /** treatments: uri;date|uri;date|... */
    treats: string;
    /** treatments: uri;date|uri;date|... */
    cites: string;
    latinName: LatinName;
};

export async function getColFromName(
    name: LatinName,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<Set<ColResult>> {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?col ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    ${name.rank ? `?col dwc:taxonRank "${name.rank}" .` : ""}
    ${
        name.genericName
            ? `?col dwc:genericName "${name.genericName}" .`
            // : name.noMissing
            // ? `FILTER NOT EXISTS { ?col dwc:genericName ?_generic . }`
            : ""
    }
    ${
        name.infragenericEpithet
            ? `?col dwc:infragenericEpithet "${name.infragenericEpithet}" .`
            // : name.noMissing
            // ? `FILTER NOT EXISTS { ?col dwc:infragenericEpithet ?_infrag . }`
            : ""
    }
    ${
        name.specificEpithet
            ? `?col dwc:specificEpithet "${name.specificEpithet}" .`
            // : name.noMissing
            // ? `FILTER NOT EXISTS { ?col dwc:specificEpithet ?_specific . }`
            : ""
    }
    ${
        name.infraspecificEpithet
            ? `?col dwc:infraspecificEpithet "${name.infraspecificEpithet}" .`
            // : name.noMissing
            // ? `FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?_infrasp . }`
            : ""
    }
    ${name.kingdom ? `?p dwc:scientificName "${name.kingdom}" .` : ""}
    ?col dwc:taxonomicStatus ?status ;
         dwc:scientificName ?name ;
         dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:genericName ?generic . }
    OPTIONAL { ?col dwc:infragenericEpithet ?infrag . }
    OPTIONAL { ?col dwc:specificEpithet ?specific . }
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
    ?col dwc:parent* ?p .
    ?p dwc:taxonRank "kingdom" ;
       dwc:scientificName ?kingdom .
}
LIMIT 500`;
    const json = await endpoint.getSparqlResultSet(
        query,
        fetchOptions,
        "getColFromName",
    );
    return new Set(
        json.results.bindings.map((result): ColResult | undefined => {
            const colUri = result.col?.value;
            const authority = result.authority?.value;
            const humanReadable = authority
                ? result.name?.value.replace(authority, "").trimEnd()
                : result.name?.value;
            const status = result.status?.value;
            const genericName = result.generic?.value;
            if (!colUri || !humanReadable || !status || !genericName) {
                return undefined;
            }
            return {
                colUri,
                humanReadable,
                authority,
                status,
                latinName: {
                    rank: result.rank?.value,
                    kingdom: result.kingdom?.value,
                    genericName,
                    infragenericEpithet: result.infrag?.value,
                    specificEpithet: result.specific?.value,
                    infraspecificEpithet: result.infrasp?.value,
                },
            };
        }).filter((r) => r !== undefined),
    );
}

export async function getColSynonyms(
    colUri: string,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<ColSynonyms> {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?acceptedcol ?col ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    {
        ?col dwc:acceptedName <${colUri}> .
        BIND (<${colUri}> AS ?acceptedcol)
    } UNION {
        <${colUri}> dwc:acceptedName ?acceptedcol .
        ?col dwc:acceptedName? ?acceptedcol .
    } UNION {
        <${colUri}> dwc:taxonomicStatus "accepted" .
        BIND(<${colUri}> AS ?col)
        BIND(<${colUri}> AS ?acceptedcol)
    }
    ?col dwc:taxonomicStatus ?status ;
        dwc:scientificName ?name ;
        dwc:taxonRank ?rank .
    ?col dwc:parent* ?p . ?p dwc:taxonRank "kingdom" ; dwc:scientificName ?kingdom .
    OPTIONAL { ?col dwc:genericName ?generic . }
    OPTIONAL { ?col dwc:infragenericEpithet ?infrag . }
    OPTIONAL { ?col dwc:specificEpithet ?specific . }
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
}`;
    const json = await endpoint.getSparqlResultSet(
        query,
        fetchOptions,
        "getNameFromCol",
    );
    if (json.results.bindings.length === 0) {
        throw new Error(`Could not get synonyms for CoL <${colUri}>`);
    }
    let accepted: ColResult | undefined = undefined;
    const synonyms: Set<ColResult> = new Set();
    for (const result of json.results.bindings) {
        const colUri = result.col?.value;
        const authority = result.authority?.value;
        const humanReadable = authority
            ? result.name?.value.replace(authority, "").trimEnd()
            : result.name?.value;
        const status = result.status?.value;
        const genericName = result.generic?.value;
        if (!colUri || !humanReadable || !status || !genericName) {
            continue;
        }
        const r: ColResult = {
            colUri,
            humanReadable,
            authority,
            status,
            latinName: {
                rank: result.rank?.value,
                kingdom: result.kingdom?.value,
                genericName,
                infragenericEpithet: result.infrag?.value,
                specificEpithet: result.specific?.value,
                infraspecificEpithet: result.infrasp?.value,
            },
        };
        if (colUri === result.acceptedcol?.value) {
            accepted = r;
        } else {
            synonyms.add(r);
        }
    }
    if (!accepted) {
        throw new Error(
            `Could not get synonyms for CoL <${colUri}> [missing acceptedcol]`,
        );
    }
    return { accepted, synonyms };
}

export function getPlaziFromName(
    name: LatinName,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<PlaziResult> {
    throw new Error("Not yet implemented");
}
