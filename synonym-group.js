// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

class JustificationSet {
    monitor = new EventTarget();
    contents = [];
    isFinished = false;
    isAborted = false;
    entries = Array.from(this.contents.values()).map((v)=>[
            v,
            v
        ]).values;
    constructor(iterable){
        if (iterable) {
            for (const el of iterable){
                this.add(el);
            }
        }
        return this;
    }
    get size() {
        return new Promise((resolve, reject)=>{
            if (this.isAborted) {
                reject(new Error("JustificationSet has been aborted"));
            } else if (this.isFinished) {
                resolve(this.contents.length);
            } else {
                const listener = ()=>{
                    if (this.isFinished) {
                        this.monitor.removeEventListener("updated", listener);
                        resolve(this.contents.length);
                    }
                };
                this.monitor.addEventListener("updated", listener);
            }
        });
    }
    add(value) {
        if (this.contents.findIndex((c)=>c.toString() === value.toString()) === -1) {
            this.contents.push(value);
            this.monitor.dispatchEvent(new CustomEvent("updated"));
        }
        return this;
    }
    finish() {
        this.isFinished = true;
        this.monitor.dispatchEvent(new CustomEvent("updated"));
    }
    forEachCurrent(cb) {
        this.contents.forEach(cb);
    }
    first() {
        return new Promise((resolve)=>{
            if (this.contents[0]) {
                resolve(this.contents[0]);
            } else {
                this.monitor.addEventListener("update", ()=>{
                    resolve(this.contents[0]);
                });
            }
        });
    }
    [Symbol.toStringTag] = "";
    [Symbol.asyncIterator]() {
        let returnedSoFar = 0;
        return {
            next: ()=>{
                return new Promise((resolve, reject)=>{
                    const _ = ()=>{
                        if (this.isAborted) {
                            reject(new Error("JustificationSet has been aborted"));
                        } else if (returnedSoFar < this.contents.length) {
                            resolve({
                                value: this.contents[returnedSoFar++]
                            });
                        } else if (this.isFinished) {
                            resolve({
                                done: true,
                                value: true
                            });
                        } else {
                            const listener = ()=>{
                                console.log("ahgfd");
                                this.monitor.removeEventListener("updated", listener);
                                _();
                            };
                            this.monitor.addEventListener("updated", listener);
                        }
                    };
                    _();
                });
            }
        };
    }
}
export { JustificationSet as JustificationSet };
async function sleep(ms) {
    const p = new Promise((resolve)=>{
        setTimeout(resolve, ms);
    });
    return await p;
}
class SparqlEndpoint {
    sparqlEnpointUri;
    constructor(sparqlEnpointUri){
        this.sparqlEnpointUri = sparqlEnpointUri;
    }
    async getSparqlResultSet(query, fetchOptions = {}, _reason = "") {
        fetchOptions.headers = fetchOptions.headers || {};
        fetchOptions.headers["Accept"] = "application/sparql-results+json";
        let retryCount = 0;
        const sendRequest = async ()=>{
            try {
                const response = await fetch(this.sparqlEnpointUri + "?query=" + encodeURIComponent(query), fetchOptions);
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
class SynonymGroup {
    justifiedArray = [];
    monitor = new EventTarget();
    isFinished = false;
    isAborted = false;
    treatments = new Map();
    taxonNames = new Map();
    controller = new AbortController();
    constructor(sparqlEndpoint, taxonName, ignoreRank = false){
        const justifiedSynonyms = new Map();
        const expandedTaxonNames = new Set();
        const resolver = (value)=>{
            if (value === true) {
                this.isFinished = true;
            }
            this.monitor.dispatchEvent(new CustomEvent("updated"));
        };
        const fetchInit = {
            signal: this.controller.signal
        };
        async function getTreatmentDetails(treatmentUri) {
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
                return {
                    materialCitations: [],
                    figureCitations: []
                };
            }
            try {
                const json = await sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Treatment Details for ${treatmentUri}`);
                const materialCitations = json.results.bindings.filter((t)=>t.mc && t.catalogNumbers?.value).map((t)=>{
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
                        httpUri: httpUri?.length ? httpUri : undefined
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
                const figures = (await sparqlEndpoint.getSparqlResultSet(figureQuery, fetchInit, `Figures for ${treatmentUri}`)).results.bindings;
                const figureCitations = figures.filter((f)=>f.url?.value).map((f)=>{
                    return {
                        url: f.url.value,
                        description: f.description?.value
                    };
                });
                return {
                    creators: json.results.bindings[0]?.creators?.value,
                    date: json.results.bindings[0]?.date?.value ? parseInt(json.results.bindings[0].date.value, 10) : undefined,
                    title: json.results.bindings[0]?.title?.value,
                    materialCitations,
                    figureCitations
                };
            } catch (error) {
                console.warn("SPARQL Error: " + error);
                return {
                    materialCitations: [],
                    figureCitations: []
                };
            }
        }
        const makeTreatmentSet = (urls)=>{
            if (!urls) return new Set();
            return new Set(urls.filter((url)=>!!url).map((url)=>{
                if (!this.treatments.has(url)) {
                    this.treatments.set(url, {
                        url,
                        details: getTreatmentDetails(url)
                    });
                }
                return this.treatments.get(url);
            }));
        };
        async function getVernacular(uri) {
            const result = {};
            const query = `SELECT DISTINCT ?n WHERE { <${uri}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`;
            const bindings = (await sparqlEndpoint.getSparqlResultSet(query)).results.bindings;
            for (const b of bindings){
                if (b.n["xml:lang"] && b.n.value) result[b.n["xml:lang"]] = b.n.value;
            }
            return result;
        }
        const makeTaxonName = (uri, name, aug, cite)=>{
            if (!this.taxonNames.has(uri)) {
                this.taxonNames.set(uri, {
                    uri,
                    loading: true,
                    displayName: name,
                    vernacularNames: getVernacular(uri),
                    treatments: {
                        aug: makeTreatmentSet(aug),
                        cite: makeTreatmentSet(cite)
                    }
                });
            }
            return this.taxonNames.get(uri);
        };
        const build = async ()=>{
            const getStartingPoints = (taxonName)=>{
                if (fetchInit.signal.aborted) return Promise.resolve([]);
                const [genus, species, subspecies] = taxonName.split(" ");
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
      ${ignoreRank || !!subspecies ? "" : `dwc:rank "${species ? "species" : "genus"}";`}
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
                if (fetchInit.signal.aborted) return Promise.resolve([]);
                return sparqlEndpoint.getSparqlResultSet(query, fetchInit, "Starting Points").then((json)=>json.results.bindings.filter((t)=>t.tc && t.tn).map((t)=>{
                        return {
                            taxonConceptUri: t.tc.value,
                            taxonName: makeTaxonName(t.tn.value, t.name?.value, t.trtns?.value.split("|"), t.citetns?.value.split("|")),
                            taxonConceptAuthority: t.authority?.value,
                            justifications: new JustificationSet([
                                `${t.tc.value} matches "${taxonName}"`
                            ]),
                            treatments: {
                                def: makeTreatmentSet(t.defs?.value.split("|")),
                                aug: makeTreatmentSet(t.augs?.value.split("|")),
                                dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                                cite: makeTreatmentSet(t.cites?.value.split("|"))
                            },
                            loading: true
                        };
                    }), (error)=>{
                    console.warn("SPARQL Error: " + error);
                    return [];
                });
            };
            const synonymFinders = [
                (taxon)=>{
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
                    if (expandedTaxonNames.has(taxon.taxonName.uri)) {
                        return Promise.resolve([]);
                    }
                    expandedTaxonNames.add(taxon.taxonName.uri);
                    if (fetchInit.signal.aborted) return Promise.resolve([]);
                    return sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Same taxon name ${taxon.taxonConceptUri}`).then((json)=>{
                        taxon.taxonName.loading = false;
                        return json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonName: taxon.taxonName,
                                taxonConceptAuthority: t.authority?.value,
                                justifications: new JustificationSet([
                                    {
                                        toString: ()=>`${t.tc.value} has taxon name ${taxon.taxonName.uri}`,
                                        precedingSynonym: taxon
                                    }
                                ]),
                                treatments: {
                                    def: makeTreatmentSet(t.defs?.value.split("|")),
                                    aug: makeTreatmentSet(t.augs?.value.split("|")),
                                    dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                                    cite: makeTreatmentSet(t.cites?.value.split("|"))
                                },
                                loading: true
                            };
                        });
                    }, (error)=>{
                        console.warn("SPARQL Error: " + error);
                        return [];
                    });
                },
                (taxon)=>{
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
                    if (fetchInit.signal.aborted) return Promise.resolve([]);
                    return sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Deprecating     ${taxon.taxonConceptUri}`).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonName: makeTaxonName(t.tn.value, t.name?.value, t.trtns?.value.split("|"), t.citetns?.value.split("|")),
                                taxonConceptAuthority: t.authority?.value,
                                justifications: new JustificationSet(t.justs?.value.split("|").map((url)=>{
                                    if (!this.treatments.has(url)) {
                                        this.treatments.set(url, {
                                            url,
                                            details: getTreatmentDetails(url)
                                        });
                                    }
                                    return {
                                        toString: ()=>`${t.tc.value} deprecates ${taxon.taxonConceptUri} according to ${url}`,
                                        precedingSynonym: taxon,
                                        treatment: this.treatments.get(url)
                                    };
                                })),
                                treatments: {
                                    def: makeTreatmentSet(t.defs?.value.split("|")),
                                    aug: makeTreatmentSet(t.augs?.value.split("|")),
                                    dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                                    cite: makeTreatmentSet(t.cites?.value.split("|"))
                                },
                                loading: true
                            };
                        }), (error)=>{
                        console.warn("SPARQL Error: " + error);
                        return [];
                    });
                },
                (taxon)=>{
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
                    if (fetchInit.signal.aborted) return Promise.resolve([]);
                    return sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Deprecated by   ${taxon.taxonConceptUri}`).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonName: makeTaxonName(t.tn.value, t.name?.value, t.trtns?.value.split("|"), t.citetns?.value.split("|")),
                                taxonConceptAuthority: t.authority?.value,
                                justifications: new JustificationSet(t.justs?.value.split("|").map((url)=>{
                                    if (!this.treatments.has(url)) {
                                        this.treatments.set(url, {
                                            url,
                                            details: getTreatmentDetails(url)
                                        });
                                    }
                                    return {
                                        toString: ()=>`${t.tc.value} deprecates ${taxon.taxonConceptUri} according to ${url}`,
                                        precedingSynonym: taxon,
                                        treatment: this.treatments.get(url)
                                    };
                                })),
                                treatments: {
                                    def: makeTreatmentSet(t.defs?.value.split("|")),
                                    aug: makeTreatmentSet(t.augs?.value.split("|")),
                                    dpr: makeTreatmentSet(t.dprs?.value.split("|")),
                                    cite: makeTreatmentSet(t.cites?.value.split("|"))
                                },
                                loading: true
                            };
                        }), (error)=>{
                        console.warn("SPARQL Error: " + error);
                        return [];
                    });
                }
            ];
            async function lookUpRound(taxon) {
                const foundGroupsP = synonymFinders.map((finder)=>finder(taxon));
                const foundGroups = await Promise.all(foundGroupsP);
                return foundGroups.reduce((a, b)=>a.concat(b), []);
            }
            const finish = (justsyn)=>{
                justsyn.justifications.finish();
                justsyn.loading = false;
            };
            let justifiedSynsToExpand = await getStartingPoints(taxonName);
            justifiedSynsToExpand.forEach((justsyn)=>{
                finish(justsyn);
                justifiedSynonyms.set(justsyn.taxonConceptUri, this.justifiedArray.push(justsyn) - 1);
                resolver(justsyn);
            });
            const expandedTaxonConcepts = new Set();
            while(justifiedSynsToExpand.length > 0){
                const foundThisRound = [];
                const promises = justifiedSynsToExpand.map(async (j)=>{
                    if (expandedTaxonConcepts.has(j.taxonConceptUri)) return false;
                    expandedTaxonConcepts.add(j.taxonConceptUri);
                    const newSynonyms = await lookUpRound(j);
                    newSynonyms.forEach((justsyn)=>{
                        if (justifiedSynonyms.has(justsyn.taxonConceptUri)) {
                            if (~foundThisRound.indexOf(justsyn.taxonConceptUri)) {
                                justsyn.justifications.forEachCurrent((jsj)=>{
                                    this.justifiedArray[justifiedSynonyms.get(justsyn.taxonConceptUri)].justifications.add(jsj);
                                });
                            }
                        } else {
                            finish(justsyn);
                            justifiedSynonyms.set(justsyn.taxonConceptUri, this.justifiedArray.push(justsyn) - 1);
                            resolver(justsyn);
                        }
                        if (!expandedTaxonConcepts.has(justsyn.taxonConceptUri)) {
                            justifiedSynsToExpand.push(justsyn);
                            foundThisRound.push(justsyn.taxonConceptUri);
                        }
                    });
                    return true;
                });
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
            next: ()=>{
                return new Promise((resolve, reject)=>{
                    const _ = ()=>{
                        if (this.isAborted) {
                            reject(new Error("SynyonymGroup has been aborted"));
                        } else if (returnedSoFar < this.justifiedArray.length) {
                            resolve({
                                value: this.justifiedArray[returnedSoFar++]
                            });
                        } else if (this.isFinished) {
                            resolve({
                                done: true,
                                value: true
                            });
                        } else {
                            const listener = ()=>{
                                this.monitor.removeEventListener("updated", listener);
                                _();
                            };
                            this.monitor.addEventListener("updated", listener);
                        }
                    };
                    _();
                });
            }
        };
    }
}
export { SparqlEndpoint as SparqlEndpoint };
export { SynonymGroup as default };
