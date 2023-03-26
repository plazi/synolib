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
        this.monitor.addEventListener("updated", ()=>console.log("ARA"));
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
class TreatmentSet {
    monitor = new EventTarget();
    contents = [];
    isFinished = false;
    isAborted = false;
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
        if (this.contents.findIndex((c)=>c.url === value.url) === -1) {
            this.contents.push(value);
            this.monitor.dispatchEvent(new CustomEvent("updated"));
        }
        return this;
    }
    finish() {
        this.isFinished = true;
        this.monitor.dispatchEvent(new CustomEvent("updated"));
    }
    [Symbol.asyncIterator]() {
        let returnedSoFar = 0;
        return {
            next: ()=>{
                return new Promise((resolve, reject)=>{
                    const _ = ()=>{
                        if (this.isAborted) {
                            reject(new Error("TreatmentSet has been aborted"));
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
class SparqlEndpoint {
    sparqlEnpointUri;
    constructor(sparqlEnpointUri){
        this.sparqlEnpointUri = sparqlEnpointUri;
    }
    async getSparqlResultSet(query, fetchOptions = {}) {
        fetchOptions.headers = fetchOptions.headers || {};
        fetchOptions.headers["Accept"] = "application/sparql-results+json";
        const response = await fetch(this.sparqlEnpointUri + "?query=" + encodeURIComponent(query), fetchOptions);
        return await response.json();
    }
}
class SynonymGroup {
    justifiedArray = [];
    monitor = new EventTarget();
    isFinished = false;
    isAborted = false;
    constructor(sparqlEndpoint, taxonName, ignoreRank = false){
        const justifiedSynonyms = new Map();
        const expandedTaxonNames = new Set();
        const resolver = (value)=>{
            if (value === true) {
                this.isFinished = true;
            }
            this.monitor.dispatchEvent(new CustomEvent("updated"));
        };
        const build = async ()=>{
            function getStartingPoints(taxonName) {
                const [genus, species, subspecies] = taxonName.split(" ");
                const query = `PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
    PREFIX treat: <http://plazi.org/vocab/treatment#>
    SELECT DISTINCT ?tn ?tc WHERE {
      ?tc dwc:genus "${genus}";
          treat:hasTaxonName ?tn;
          ${species ? `dwc:species "${species}";` : ""}
          ${subspecies ? `(dwc:subspecies|dwc:variety) "${subspecies}";` : ""}
          ${ignoreRank || !!subspecies ? "" : `dwc:rank "${species ? "species" : "genus"}";`}
          a <http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept>.
    }`;
                return sparqlEndpoint.getSparqlResultSet(query).then((json)=>json.results.bindings.map((t)=>{
                        return {
                            taxonConceptUri: t.tc.value,
                            taxonNameUri: t.tn.value,
                            justifications: new JustificationSet([
                                `matches "${genus}${species ? " " + species : ""}${subspecies ? " " + subspecies : ""}"`
                            ]),
                            treatments: {
                                def: new TreatmentSet(),
                                aug: new TreatmentSet(),
                                dpr: new TreatmentSet()
                            },
                            loading: true
                        };
                    }));
            }
            const synonymFinders = [
                (taxon)=>{
                    const query = `PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX treat: <http://plazi.org/vocab/treatment#>
    SELECT DISTINCT
    ?tc
    WHERE {
      ?tc treat:hasTaxonName <${taxon.taxonNameUri}> .
      FILTER (?tc != <${taxon.taxonConceptUri}>)
    }`;
                    if (expandedTaxonNames.has(taxon.taxonNameUri)) {
                        return Promise.resolve([]);
                    }
                    expandedTaxonNames.add(taxon.taxonNameUri);
                    return sparqlEndpoint.getSparqlResultSet(query).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonNameUri: taxon.taxonNameUri,
                                justifications: new JustificationSet([
                                    {
                                        toString: ()=>`${t.tc.value} has taxon name ${taxon.taxonNameUri}`,
                                        precedingSynonym: taxon
                                    }
                                ]),
                                treatments: {
                                    def: new TreatmentSet(),
                                    aug: new TreatmentSet(),
                                    dpr: new TreatmentSet()
                                },
                                loading: true
                            };
                        }));
                },
                (taxon)=>{
                    const query = `PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX treat: <http://plazi.org/vocab/treatment#>
    SELECT DISTINCT
    ?tc ?tn ?treat ?date (group_concat(DISTINCT ?creator;separator="; ") as ?creators)
    WHERE {
      ?treat treat:deprecates <${taxon.taxonConceptUri}> ;
            (treat:augmentsTaxonConcept|treat:definesTaxonConcept) ?tc ;
            dc:creator ?creator .
      ?tc <http://plazi.org/vocab/treatment#hasTaxonName> ?tn .
      OPTIONAL {
        ?treat treat:publishedIn ?publ .
        ?publ dc:date ?date .
      }
    }
    GROUP BY ?tc ?tn ?treat ?date`;
                    return sparqlEndpoint.getSparqlResultSet(query).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonNameUri: t.tn.value,
                                justifications: new JustificationSet([
                                    {
                                        toString: ()=>`${t.tc.value} deprecates ${taxon.taxonConceptUri} according to ${t.treat.value}`,
                                        precedingSynonym: taxon,
                                        treatment: {
                                            url: t.treat.value,
                                            creators: t.creators.value,
                                            date: t.date ? parseInt(t.date.value, 10) : undefined,
                                            materialCitations: getMaterialCitations(t.treat.value)
                                        }
                                    }
                                ]),
                                treatments: {
                                    def: new TreatmentSet(),
                                    aug: new TreatmentSet(),
                                    dpr: new TreatmentSet()
                                },
                                loading: true
                            };
                        }));
                },
                (taxon)=>{
                    const query = `PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX treat: <http://plazi.org/vocab/treatment#>
    SELECT DISTINCT
    ?tc ?tn ?treat ?date (group_concat(DISTINCT ?creator;separator="; ") as ?creators)
    WHERE {
      ?treat (treat:augmentsTaxonConcept|treat:definesTaxonConcept) <${taxon.taxonConceptUri}> ;
            treat:deprecates ?tc ;
            dc:creator ?creator .
      ?tc <http://plazi.org/vocab/treatment#hasTaxonName> ?tn .
      OPTIONAL {
        ?treat treat:publishedIn ?publ .
        ?publ dc:date ?date .
      }
    }
    GROUP BY ?tc ?tn ?treat ?date`;
                    return sparqlEndpoint.getSparqlResultSet(query).then((json)=>json.results.bindings.filter((t)=>t.tc).map((t)=>{
                            return {
                                taxonConceptUri: t.tc.value,
                                taxonNameUri: t.tn.value,
                                justifications: new JustificationSet([
                                    {
                                        toString: ()=>`${t.tc.value} deprecated by ${taxon.taxonConceptUri} according to ${t.treat.value}`,
                                        precedingSynonym: taxon,
                                        treatment: {
                                            url: t.treat.value,
                                            creators: t.creators.value,
                                            date: t.date ? parseInt(t.date.value, 10) : undefined,
                                            materialCitations: getMaterialCitations(t.treat.value)
                                        }
                                    }
                                ]),
                                treatments: {
                                    def: new TreatmentSet(),
                                    aug: new TreatmentSet(),
                                    dpr: new TreatmentSet()
                                },
                                loading: true
                            };
                        }));
                }
            ];
            async function lookUpRound(taxon) {
                const foundGroupsP = synonymFinders.map((finder)=>finder(taxon));
                const foundGroups = await Promise.all(foundGroupsP);
                return foundGroups.reduce((a, b)=>a.concat(b), []);
            }
            function getTreatments(uri, treatments) {
                const treat = "http://plazi.org/vocab/treatment#";
                const query = `PREFIX treat: <${treat}>
    PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
    SELECT DISTINCT ?treat ?how ?date (group_concat(DISTINCT ?c;separator="; ") as ?creators)
    WHERE {
      ?treat (treat:definesTaxonConcept|treat:augmentsTaxonConcept|treat:deprecates) <${uri}> ;
              ?how <${uri}> ;
              dc:creator ?c .
      OPTIONAL {
        ?treat treat:publishedIn ?pub .
        ?pub dc:date ?date .
      }
    }
    GROUP BY ?treat ?how ?date`;
                return sparqlEndpoint.getSparqlResultSet(query).then((json)=>{
                    json.results.bindings.forEach((t)=>{
                        if (!t.treat) return;
                        const treatment = {
                            url: t.treat.value,
                            date: parseInt(t.date?.value, 10),
                            creators: t.creators.value,
                            materialCitations: getMaterialCitations(t.treat.value)
                        };
                        switch(t.how.value){
                            case treat + "definesTaxonConcept":
                                treatments.def.add(treatment);
                                break;
                            case treat + "augmentsTaxonConcept":
                                treatments.aug.add(treatment);
                                break;
                            case treat + "deprecates":
                                treatments.dpr.add(treatment);
                                break;
                        }
                    });
                });
            }
            function getMaterialCitations(uri) {
                const query = `
    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
    PREFIX trt: <http://plazi.org/vocab/treatment#>
    SELECT DISTINCT *
    WHERE {
      <${uri}> dwc:basisOfRecord ?mc .
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
    }`;
                return sparqlEndpoint.getSparqlResultSet(query).then((json)=>{
                    const resultArray = [];
                    json.results.bindings.forEach((t)=>{
                        if (!t.mc || !t.catalogNumber) return;
                        const result = {
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
                            "httpUri": t.httpUri?.value || undefined
                        };
                        resultArray.push(result);
                    });
                    return resultArray;
                });
            }
            const finish = (justsyn)=>{
                justsyn.justifications.finish();
                getTreatments(justsyn.taxonConceptUri, justsyn.treatments).then(()=>{
                    justsyn.treatments.def.finish();
                    justsyn.treatments.aug.finish();
                    justsyn.treatments.dpr.finish();
                    justsyn.loading = false;
                });
            };
            let justifiedSynsToExpand = await getStartingPoints(taxonName);
            await justifiedSynsToExpand.forEach((justsyn)=>{
                finish(justsyn);
                justifiedSynonyms.set(justsyn.taxonConceptUri, this.justifiedArray.push(justsyn) - 1);
                resolver(justsyn);
            });
            const expandedTaxonConcepts = [];
            while(justifiedSynsToExpand.length > 0){
                const foundThisRound = [];
                const promises = justifiedSynsToExpand.map((j, index)=>lookUpRound(j).then((newSynonyms)=>{
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
                            if (!~expandedTaxonConcepts.indexOf(justsyn.taxonConceptUri)) {
                                justifiedSynsToExpand.push(justsyn);
                                foundThisRound.push(justsyn.taxonConceptUri);
                            }
                        });
                        expandedTaxonConcepts.push(j.taxonConceptUri);
                        return true;
                    }));
                justifiedSynsToExpand = [];
                await Promise.allSettled(promises);
            }
            resolver(true);
        };
        build();
    }
    abort() {
        this.isAborted = true;
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
export { JustificationSet as JustificationSet };
export { SparqlEndpoint as SparqlEndpoint };
export { SynonymGroup as default };
