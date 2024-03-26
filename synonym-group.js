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
                if (error instanceof DOMException) {
                    throw error;
                } else if (error instanceof Error && retryCount < 5) {
                    ++retryCount;
                    console.warn(`!! Fetch Error. Retrying in ${retryCount * 50}ms (${retryCount})`);
                    await sleep(retryCount * 50);
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
        function getTreatmentDetails(treatmentUri) {
            const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?date ?mc ?catalogNumber ?collectionCode ?typeStatus ?countryCode ?stateProvince ?municipality ?county ?locality ?verbatimLocality ?recordedBy ?eventDate ?samplingProtocol ?decimalLatitude ?decimalLongitude ?verbatimElevation ?gbifOccurrenceId ?gbifSpecimenId ?title (group_concat(DISTINCT ?creator;separator="; ") as ?creators) (group_concat(DISTINCT ?httpUri;separator="|") as ?httpUris)
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
GROUP BY ?date ?mc ?catalogNumber ?collectionCode ?typeStatus ?countryCode ?stateProvince ?municipality ?county ?locality ?verbatimLocality ?recordedBy ?eventDate ?samplingProtocol ?decimalLatitude ?decimalLongitude ?verbatimElevation ?gbifOccurrenceId ?gbifSpecimenId ?title`;
            if (fetchInit.signal.aborted) {
                return Promise.resolve({
                    materialCitations: []
                });
            }
            return sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Treatment Details for ${treatmentUri}`).then((json)=>{
                const result = {
                    creators: json.results.bindings[0]?.creators?.value,
                    date: json.results.bindings[0]?.date?.value ? parseInt(json.results.bindings[0].date.value, 10) : undefined,
                    title: json.results.bindings[0]?.title?.value,
                    materialCitations: []
                };
                json.results.bindings.forEach((t)=>{
                    if (!t.mc || !t.catalogNumber) return;
                    const mc = {
                        "catalogNumber": t.catalogNumber.value,
                        "collectionCode": t.collectionCode?.value || undefined,
                        "typeStatus": t.typeStatus?.value || undefined,
                        "countryCode": t.countryCode?.value || undefined,
                        "stateProvince": t.stateProvince?.value || undefined,
                        "municipality": t.municipality?.value || undefined,
                        "county": t.county?.value || undefined,
                        "locality": t.locality?.value || undefined,
                        "verbatimLocality": t.verbatimLocality?.value || undefined,
                        "recordedBy": t.recordedBy?.value || undefined,
                        "eventDate": t.eventDate?.value || undefined,
                        "samplingProtocol": t.samplingProtocol?.value || undefined,
                        "decimalLatitude": t.decimalLatitude?.value || undefined,
                        "decimalLongitude": t.decimalLongitude?.value || undefined,
                        "verbatimElevation": t.verbatimElevation?.value || undefined,
                        "gbifOccurrenceId": t.gbifOccurrenceId?.value || undefined,
                        "gbifSpecimenId": t.gbifSpecimenId?.value || undefined,
                        "httpUri": t.httpUris?.value.split("|") || undefined
                    };
                    result.materialCitations.push(mc);
                });
                return result;
            }, (error)=>{
                console.warn("SPARQL Error: " + error);
                return {
                    materialCitations: []
                };
            });
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
        const build = async ()=>{
            const getStartingPoints = (taxonName)=>{
                if (fetchInit.signal.aborted) return Promise.resolve([]);
                const [genus, species, subspecies] = taxonName.split(" ");
                const query = `PREFIX cito: <http://purl.org/spar/cito/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX treat: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT
  ?tn ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ?tc dwc:genus "${genus}";
      treat:hasTaxonName ?tn;
      ${species ? `dwc:species "${species}";` : ""}
      ${subspecies ? `(dwc:subspecies|dwc:variety) "${subspecies}";` : ""}
      ${ignoreRank || !!subspecies ? "" : `dwc:rank "${species ? "species" : "genus"}";`}
      a <http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept>.
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
  OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn treat:citesTaxonName ?tn . }
}
GROUP BY ?tn ?tc`;
                if (fetchInit.signal.aborted) return Promise.resolve([]);
                return sparqlEndpoint.getSparqlResultSet(query, fetchInit, "Starting Points").then((json)=>json.results.bindings.filter((t)=>t.tc && t.tn).map((t)=>{
                        if (!this.taxonNames.has(t.tn.value)) {
                            this.taxonNames.set(t.tn.value, {
                                uri: t.tn.value,
                                loading: true,
                                treatments: {
                                    aug: makeTreatmentSet(t.trtns?.value.split("|")),
                                    cite: makeTreatmentSet(t.citetns?.value.split("|"))
                                }
                            });
                        }
                        return {
                            taxonConceptUri: t.tc.value,
                            taxonName: this.taxonNames.get(t.tn.value),
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
  ?tn ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?justification; separator="|") as ?justs) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ?justification treat:deprecates <${taxon.taxonConceptUri}> ;
                 (treat:augmentsTaxonConcept|treat:definesTaxonConcept) ?tc .
  ?tc <http://plazi.org/vocab/treatment#hasTaxonName> ?tn .
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
  OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn treat:citesTaxonName ?tn . }
}
GROUP BY ?tn ?tc`;
                    if (fetchInit.signal.aborted) return Promise.resolve([]);
                    return sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Deprecating     ${taxon.taxonConceptUri}`).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            if (!this.taxonNames.has(t.tn.value)) {
                                this.taxonNames.set(t.tn.value, {
                                    uri: t.tn.value,
                                    loading: true,
                                    treatments: {
                                        aug: makeTreatmentSet(t.trtns?.value.split("|")),
                                        cite: makeTreatmentSet(t.citetns?.value.split("|"))
                                    }
                                });
                            }
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonName: this.taxonNames.get(t.tn.value),
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
  ?tn ?tc (group_concat(DISTINCT ?auth; separator=" / ") as ?authority) (group_concat(DISTINCT ?justification; separator="|") as ?justs) (group_concat(DISTINCT ?aug;separator="|") as ?augs) (group_concat(DISTINCT ?def;separator="|") as ?defs) (group_concat(DISTINCT ?dpr;separator="|") as ?dprs) (group_concat(DISTINCT ?cite;separator="|") as ?cites) (group_concat(DISTINCT ?trtn;separator="|") as ?trtns) (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  ?justification (treat:augmentsTaxonConcept|treat:definesTaxonConcept) <${taxon.taxonConceptUri}> ;
                 treat:deprecates ?tc .
  ?tc <http://plazi.org/vocab/treatment#hasTaxonName> ?tn .
  OPTIONAL { ?tc dwc:scientificNameAuthorship ?auth . }
  OPTIONAL { ?aug treat:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def treat:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr treat:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
  OPTIONAL { ?trtn treat:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn treat:citesTaxonName ?tn . }
}
GROUP BY ?tn ?tc`;
                    if (fetchInit.signal.aborted) return Promise.resolve([]);
                    return sparqlEndpoint.getSparqlResultSet(query, fetchInit, `Deprecated by   ${taxon.taxonConceptUri}`).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            if (!this.taxonNames.has(t.tn.value)) {
                                this.taxonNames.set(t.tn.value, {
                                    uri: t.tn.value,
                                    loading: true,
                                    treatments: {
                                        aug: makeTreatmentSet(t.trtns?.value.split("|")),
                                        cite: makeTreatmentSet(t.citetns?.value.split("|"))
                                    }
                                });
                            }
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonName: this.taxonNames.get(t.tn.value),
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
