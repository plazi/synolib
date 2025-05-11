import type { SparqlEndpoint } from "./SparqlEndpoint.ts";

// Because the previously used queries are very complicated and take a long time to execute, this is
// an attempt at splitting them into smaller, easier ones.
//
// We have the following queries:
// Latin Name → CoL
// Latin Name → TN + TC (with treatments)
// CoL → CoL synonyms + Latin Names
// TN → TN + TCs + Latin Name
// TC → TN + TCs + Latin Name

// TODO: proper subtaxa
// TODO: factour out common code from plazi-queries

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
    noMissing: boolean;
};

export function stringifyLN(name: LatinName): string {
    return `${name.noMissing}|${name.rank}|${name.kingdom}|${name.genericName}|${name.infragenericEpithet}|${name.specificEpithet}|${name.infraspecificEpithet}`;
}

function abbreviateRank(rank: string): string {
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
}

export function prettyPrintLN(name: LatinName): string {
    return name.genericName +
        //   (json.results.bindings[0].section?.value
        //     ? ` sect. ${json.results.bindings[0].section.value}`
        //     : "") +
        (name.infragenericEpithet ? ` (${name.infragenericEpithet})` : "") +
        (name.specificEpithet ? ` ${name.specificEpithet}` : "") +
        (name.infraspecificEpithet
            ? name.rank
                ? ` ${abbreviateRank(name.rank)} ${name.infraspecificEpithet}`
                : ` ${name.infraspecificEpithet}`
            : "");
}

export type ColResult = {
    colUri: string;
    acceptedColUri: string;
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
    // humanReadable: string;
    authorized: {
        tcUri: string;
        authorities: string;
        /** treatments: uri;date|uri;date|... */
        defs?: string;
        /** treatments: uri;date|uri;date|... */
        augs?: string;
        /** treatments: uri;date|uri;date|... */
        dprs?: string;
        /** treatments: uri;date|uri;date|... */
        cites?: string;
    }[];
    /** treatments: uri;date|uri;date|... */
    treats?: string;
    /** treatments: uri;date|uri;date|... */
    cites?: string;
    latinName: LatinName;
};

export async function getColFromName(
    name: LatinName,
    searchTerm: boolean,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<Set<ColResult>> {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?col ?acceptedcol ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    ${name.rank ? `?col dwc:taxonRank "${name.rank}" .` : ""}
    ${
        name.genericName
            ? `?col dwc:genericName "${name.genericName}" .`
            : name.noMissing
            ? `FILTER NOT EXISTS { ?col dwc:genericName ?_generic . }`
            : ""
    }
    ${
        name.infragenericEpithet
            ? `?col dwc:infragenericEpithet "${name.infragenericEpithet}" .`
            : name.noMissing && !(searchTerm && name.specificEpithet)
            ? `FILTER NOT EXISTS { ?col dwc:infragenericEpithet ?_infrag . }`
            : ""
    }
    ${
        name.specificEpithet
            ? `?col dwc:specificEpithet "${name.specificEpithet}" .`
            : name.noMissing
            ? `FILTER NOT EXISTS { ?col dwc:specificEpithet ?_specific . }`
            : ""
    }
    ${
        name.infraspecificEpithet
            ? `?col dwc:infraspecificEpithet "${name.infraspecificEpithet}" .`
            : name.noMissing
            ? `FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?_infrasp . }`
            : ""
    }
    ${
        name.kingdom
            ? `?col dwc:kingdom "${name.kingdom}" .`
            : name.noMissing && !searchTerm
            ? `FILTER NOT EXISTS { ?col dwc:kingdom ?_kingdom . }`
            : ""
    }
    ?col dwc:taxonomicStatus ?status ;
         dwc:scientificName ?name ;
         dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:genericName ?generic . }
    OPTIONAL { ?col dwc:infragenericEpithet ?infrag . }
    OPTIONAL { ?col dwc:specificEpithet ?specific . }
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
    OPTIONAL { ?col dwc:kingdom ?kingdom . }
    {
        ?col dwc:acceptedName ?acceptedcol .
    } UNION {
        ?col dwc:taxonomicStatus "accepted" .
        BIND(?col AS ?acceptedcol)
    } UNION {
        ?col dwc:taxonomicStatus "provisionally accepted" .
        BIND(?col AS ?acceptedcol)
    }
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
            const acceptedColUri = result.acceptedcol?.value;
            const authority = result.authority?.value;
            const humanReadable = authority
                ? result.name?.value.replace(authority, "").trimEnd()
                : result.name?.value;
            const status = result.status?.value;
            const genericName = result.generic?.value;
            if (
                !colUri || !acceptedColUri || !humanReadable || !status ||
                !genericName
            ) {
                return undefined;
            }
            return {
                colUri,
                acceptedColUri,
                humanReadable,
                authority,
                status,
                latinName: {
                    rank: result.rank?.value.toLocaleLowerCase(),
                    kingdom: result.kingdom?.value,
                    genericName,
                    infragenericEpithet: result.infrag?.value,
                    specificEpithet: result.specific?.value,
                    infraspecificEpithet: result.infrasp?.value,
                    noMissing: true,
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
    } UNION {
        <${colUri}> dwc:taxonomicStatus "provisionally accepted" .
        BIND(<${colUri}> AS ?col)
        BIND(<${colUri}> AS ?acceptedcol)
    }
    ?col dwc:taxonomicStatus ?status ;
        dwc:scientificName ?name ;
        dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:genericName ?generic . }
    OPTIONAL { ?col dwc:infragenericEpithet ?infrag . }
    OPTIONAL { ?col dwc:specificEpithet ?specific . }
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
    OPTIONAL { ?col dwc:kingdom ?kingdom . }
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
        const acceptedColUri = result.acceptedcol?.value;
        const authority = result.authority?.value;
        const humanReadable = authority
            ? result.name?.value.replace(authority, "").trimEnd()
            : result.name?.value;
        const status = result.status?.value;
        const genericName = result.generic?.value;
        if (
            !colUri || !acceptedColUri || !humanReadable || !status ||
            !genericName
        ) {
            continue;
        }
        const r: ColResult = {
            colUri,
            acceptedColUri,
            humanReadable,
            authority,
            status,
            latinName: {
                rank: result.rank?.value.toLocaleLowerCase(),
                kingdom: result.kingdom?.value,
                genericName,
                infragenericEpithet: result.infrag?.value,
                specificEpithet: result.specific?.value,
                infraspecificEpithet: result.infrasp?.value,
                noMissing: true,
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

export async function getPlaziFromName(
    name: LatinName,
    searchTerm: boolean,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<Set<PlaziResult>> {
    const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
  (group_concat(DISTINCT ?authority;separator=" / ") AS ?authorities)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)
WHERE {
    ${name.rank ? `?tn dwc:rank "${name.rank}" .` : ""}
    ${
        name.genericName
            ? `?tn dwc:genus "${name.genericName}" .`
            : name.noMissing
            ? `FILTER NOT EXISTS { ?tn dwc:genus ?_generic . }`
            : ""
    }
    ${
        name.infragenericEpithet
            ? `?tn dwc:subGenus|dwc:section|dwc:series "${name.infragenericEpithet}" .`
            : name.noMissing && !(searchTerm && name.specificEpithet)
            ? `FILTER NOT EXISTS { ?tn dwc:subGenus|dwc:section|dwc:series ?_infrag . }`
            : ""
    }
    ${
        name.specificEpithet
            ? `?tn dwc:species "${name.specificEpithet}" .`
            : name.noMissing
            ? `FILTER NOT EXISTS { ?tn dwc:species ?_specific . }`
            : ""
    }
    ${
        name.infraspecificEpithet
            ? `?tn dwc:subSpecies|dwc:variety|dwc:form "${name.infraspecificEpithet}" .`
            : name.noMissing
            ? `FILTER NOT EXISTS { ?tn dwc:subSpecies|dwc:variety|dwc:form ?_infrasp . }`
            : ""
    }
    ${
        name.kingdom
            ? `?tn dwc:kingdom "${name.kingdom}" .`
            : name.noMissing && !searchTerm
            ? `FILTER NOT EXISTS { ?tn dwc:kingdom ?_kingdom . }`
            : ""
    }
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section|dwc:series ?infrag . }
    OPTIONAL { ?tn dwc:species ?specific . }
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?authority ; a dwcFP:TaxonConcept .

      OPTIONAL {
        ?augt trt:augmentsTaxonConcept ?tc ; trt:publishedIn/dc:date ?augdate .
        BIND(CONCAT(STR(?augt), ">", ?augdate) AS ?aug)
      }
      OPTIONAL {
        ?deft trt:definesTaxonConcept ?tc ; trt:publishedIn/dc:date ?defdate .
        BIND(CONCAT(STR(?deft), ">", ?defdate) AS ?def)
      }
      OPTIONAL {
        ?dprt trt:deprecates ?tc ; trt:publishedIn/dc:date ?dprdate .
        BIND(CONCAT(STR(?dprt), ">", ?dprdate) AS ?dpr)
      }
      OPTIONAL {
        ?citet cito:cites ?tc ; trt:publishedIn/dc:date ?citedate .
        BIND(CONCAT(STR(?citet), ">", ?citedate) AS ?cite)
      }
    }
}
GROUP BY ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
LIMIT 500`;
    const json = await endpoint.getSparqlResultSet(
        query,
        fetchOptions,
        "getPlaziFromName",
    );
    const results: Map<string, PlaziResult> = new Map();

    for (const result of json.results.bindings) {
        const tnUri = result.tn?.value;
        const genericName = result.generic?.value;
        if (!tnUri || !genericName) continue;

        const tcUri = result.tc?.value;
        const authorities = result.authorities?.value;

        const tc = !tcUri || !authorities ? undefined : {
            tcUri,
            authorities,
            defs: result.defs?.value,
            augs: result.augs?.value,
            dprs: result.dprs?.value,
            cites: result.cites?.value,
        };

        const r = results.get(tnUri);
        if (!r) {
            results.set(tnUri, {
                tnUri,
                authorized: !tc ? [] : [tc],
                treats: result.tntreats?.value,
                cites: result.tncites?.value,
                latinName: {
                    rank: result.rank?.value.toLocaleLowerCase(),
                    kingdom: result.kingdom?.value,
                    genericName,
                    infragenericEpithet: result.infrag?.value,
                    specificEpithet: result.specific?.value,
                    infraspecificEpithet: result.infrasp?.value,
                    noMissing: true,
                },
            });
        } else if (tc) {
            r.authorized.push(tc);
        }
    }

    return new Set(results.values());
}

export async function getNameFromTN(
    tnUri: string,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<PlaziResult> {
    const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
  (group_concat(DISTINCT ?authority;separator=" / ") AS ?authorities)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)
WHERE {
    BIND(<${tnUri}> AS ?tn)
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section|dwc:series ?infrag . }
    OPTIONAL { ?tn dwc:species ?specific . }
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?authority ; a dwcFP:TaxonConcept .

      OPTIONAL {
        ?augt trt:augmentsTaxonConcept ?tc ; trt:publishedIn/dc:date ?augdate .
        BIND(CONCAT(STR(?augt), ">", ?augdate) AS ?aug)
      }
      OPTIONAL {
        ?deft trt:definesTaxonConcept ?tc ; trt:publishedIn/dc:date ?defdate .
        BIND(CONCAT(STR(?deft), ">", ?defdate) AS ?def)
      }
      OPTIONAL {
        ?dprt trt:deprecates ?tc ; trt:publishedIn/dc:date ?dprdate .
        BIND(CONCAT(STR(?dprt), ">", ?dprdate) AS ?dpr)
      }
      OPTIONAL {
        ?citet cito:cites ?tc ; trt:publishedIn/dc:date ?citedate .
        BIND(CONCAT(STR(?citet), ">", ?citedate) AS ?cite)
      }
    }
}
GROUP BY ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
LIMIT 500`;
    const json = await endpoint.getSparqlResultSet(
        query,
        fetchOptions,
        "getNameFromTN",
    );
    const results: Map<string, PlaziResult> = new Map();

    for (const result of json.results.bindings) {
        const tnUri = result.tn?.value;
        const genericName = result.generic?.value;
        if (!tnUri || !genericName) continue;

        const tcUri = result.tc?.value;
        const authorities = result.authorities?.value;

        const tc = !tcUri || !authorities ? undefined : {
            tcUri,
            authorities,
            defs: result.defs?.value,
            augs: result.augs?.value,
            dprs: result.dprs?.value,
            cites: result.cites?.value,
        };

        const r = results.get(tnUri);
        if (!r) {
            results.set(tnUri, {
                tnUri,
                authorized: !tc ? [] : [tc],
                treats: result.tntreats?.value,
                cites: result.tncites?.value,
                latinName: {
                    rank: result.rank?.value.toLocaleLowerCase(),
                    kingdom: result.kingdom?.value,
                    genericName,
                    infragenericEpithet: result.infrag?.value,
                    specificEpithet: result.specific?.value,
                    infraspecificEpithet: result.infrasp?.value,
                    noMissing: true,
                },
            });
        } else if (tc) {
            r.authorized.push(tc);
        }
    }

    if (results.size !== 1) {
        throw new Error(`Got multiple latin names for ${tnUri}`);
    }

    return results.values().next().value!;
}

export async function getNameFromTC(
    tcUri: string,
    endpoint: SparqlEndpoint,
    fetchOptions: RequestInit,
): Promise<PlaziResult> {
    const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
  (group_concat(DISTINCT ?authority;separator=" / ") AS ?authorities)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)
WHERE {
    <${tcUri}> trt:hasTaxonName ?tn .
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section|dwc:series ?infrag . }
    OPTIONAL { ?tn dwc:species ?specific . }
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?authority ; a dwcFP:TaxonConcept .

      OPTIONAL {
        ?augt trt:augmentsTaxonConcept ?tc ; trt:publishedIn/dc:date ?augdate .
        BIND(CONCAT(STR(?augt), ">", ?augdate) AS ?aug)
      }
      OPTIONAL {
        ?deft trt:definesTaxonConcept ?tc ; trt:publishedIn/dc:date ?defdate .
        BIND(CONCAT(STR(?deft), ">", ?defdate) AS ?def)
      }
      OPTIONAL {
        ?dprt trt:deprecates ?tc ; trt:publishedIn/dc:date ?dprdate .
        BIND(CONCAT(STR(?dprt), ">", ?dprdate) AS ?dpr)
      }
      OPTIONAL {
        ?citet cito:cites ?tc ; trt:publishedIn/dc:date ?citedate .
        BIND(CONCAT(STR(?citet), ">", ?citedate) AS ?cite)
      }
    }
}
GROUP BY ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
LIMIT 500`;
    const json = await endpoint.getSparqlResultSet(
        query,
        fetchOptions,
        "getNameFromTC",
    );
    const results: Map<string, PlaziResult> = new Map();

    for (const result of json.results.bindings) {
        const tnUri = result.tn?.value;
        const genericName = result.generic?.value;
        if (!tnUri || !genericName) continue;

        const tcUri = result.tc?.value;
        const authorities = result.authorities?.value;

        const tc = !tcUri || !authorities ? undefined : {
            tcUri,
            authorities,
            defs: result.defs?.value,
            augs: result.augs?.value,
            dprs: result.dprs?.value,
            cites: result.cites?.value,
        };

        const r = results.get(tnUri);
        if (!r) {
            results.set(tnUri, {
                tnUri,
                authorized: !tc ? [] : [tc],
                treats: result.tntreats?.value,
                cites: result.tncites?.value,
                latinName: {
                    rank: result.rank?.value.toLocaleLowerCase(),
                    kingdom: result.kingdom?.value,
                    genericName,
                    infragenericEpithet: result.infrag?.value,
                    specificEpithet: result.specific?.value,
                    infraspecificEpithet: result.infrasp?.value,
                    noMissing: true,
                },
            });
        } else if (tc) {
            r.authorized.push(tc);
        }
    }

    if (results.size !== 1) {
        throw new Error(`Got multiple latin names for ${tcUri}`);
    }

    return results.values().next().value!;
}
