// ../SparqlEndpoint.ts
async function sleep(ms) {
  const p = new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
  return await p;
}
var SparqlEndpoint = class {
  /** Create a new SparqlEndpoint with the given URI */
  constructor(sparqlEnpointUri) {
    this.sparqlEnpointUri = sparqlEnpointUri;
  }
  /** @ignore */
  // reasons: string[] = [];
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
  async getSparqlResultSet(query, fetchOptions = {}, _reason = "") {
    fetchOptions.headers = fetchOptions.headers || {};
    fetchOptions.headers["Accept"] = "application/sparql-results+json";
    let retryCount = 0;
    const sendRequest = async () => {
      try {
        const response = await fetch(
          this.sparqlEnpointUri + "?query=" + encodeURIComponent(query),
          fetchOptions
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
};

// ../SynonymGroup.ts
var SynonymGroup = class {
  /** Indicates whether the SynonymGroup has found all synonyms.
   *
   * @readonly
   */
  isFinished = false;
  /** Used internally to watch for new names found */
  monitor = new EventTarget();
  /** Used internally to abort in-flight network requests when SynonymGroup is aborted */
  controller = new AbortController();
  /** The SparqlEndpoint used */
  sparqlEndpoint;
  /**
   * List of names found so-far.
   *
   * Contains full list of synonyms _if_ .isFinished and not .isAborted
   *
   * @readonly
   */
  names = [];
  /**
   * Add a new Name to this.names.
   *
   * Note: does not deduplicate on its own
   *
   * @internal */
  pushName(name) {
    this.names.push(name);
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }
  /**
   * Call when all synonyms are found
   *
   * @internal */
  finish() {
    this.isFinished = true;
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }
  /** contains TN, TC, CoL uris of synonyms which are in-flight somehow or are done already */
  expanded = /* @__PURE__ */ new Set();
  // new Map<string, NameStatus>();
  /** contains CoL uris where we don't need to check for Col "acceptedName" links
   *
   * col -> accepted col
   */
  acceptedCol = /* @__PURE__ */ new Map();
  /**
   * Used internally to deduplicate treatments, maps from URI to Object.
   *
   * Contains full list of treatments _if_ .isFinished and not .isAborted
   *
   * @readonly
   */
  treatments = /* @__PURE__ */ new Map();
  /**
   * Whether to show taxa deprecated by CoL that would not have been found otherwise.
   * This significantly increases the number of results in some cases.
   */
  ignoreDeprecatedCoL;
  /**
   * if set to true, subTaxa of the search term are also considered as starting points.
   *
   * Not that "weird" ranks like subGenus are always included when searching for a genus by latin name.
   */
  startWithSubTaxa;
  /**
   * Constructs a SynonymGroup
   *
   * @param sparqlEndpoint SPARQL-Endpoint to query
   * @param taxonName either a string of the form "Genus species infraspecific" (species & infraspecific names optional), or an URI of a http://filteredpush.org/ontologies/oa/dwcFP#TaxonConcept or ...#TaxonName or a CoL taxon URI
   * @param [ignoreDeprecatedCoL=true] Whether to show taxa deprecated by CoL that would not have been found otherwise
   * @param [startWithSubTaxa=false] if set to true, subTaxa of the search term are also considered as starting points.
   */
  constructor(sparqlEndpoint, taxonName, ignoreDeprecatedCoL = true, startWithSubTaxa = false) {
    this.sparqlEndpoint = sparqlEndpoint;
    this.ignoreDeprecatedCoL = ignoreDeprecatedCoL;
    this.startWithSubTaxa = startWithSubTaxa;
    if (taxonName.startsWith("http")) {
      this.getName(taxonName, { searchTerm: true, subTaxon: false }).finally(
        () => this.finish()
      );
    } else {
      const name = [
        ...taxonName.split(" ").filter((n) => !!n),
        void 0,
        void 0
      ];
      this.getNameFromLatin(name, { searchTerm: true, subTaxon: false }).finally(
        () => this.finish()
      );
    }
  }
  /** @internal */
  async getName(taxonName, justification) {
    if (this.expanded.has(taxonName)) {
      console.log("Skipping known", taxonName);
      return;
    }
    if (taxonName.startsWith("https://www.catalogueoflife.org")) {
      await this.getNameFromCol(taxonName, justification);
    } else if (taxonName.startsWith("http://taxon-concept.plazi.org")) {
      await this.getNameFromTC(taxonName, justification);
    } else if (taxonName.startsWith("http://taxon-name.plazi.org")) {
      await this.getNameFromTN(taxonName, justification);
    } else {
      throw `Cannot handle name-uri <${taxonName}> !`;
    }
    if (this.startWithSubTaxa && justification.searchTerm && !justification.subTaxon) {
      await this.getSubtaxa(taxonName);
    }
  }
  /** @internal */
  async getSubtaxa(url) {
    const query = url.startsWith("http://taxon-concept.plazi.org") ? `
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?sub WHERE {
  BIND(<${url}> as ?url)
  ?sub trt:hasParentName*/^trt:hasTaxonName ?url .
}
LIMIT 5000` : `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?sub WHERE {
  BIND(<${url}> as ?url)
  ?sub (dwc:parent|trt:hasParentName)* ?url .
}
LIMIT 5000`;
    if (this.controller.signal?.aborted) return Promise.reject();
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      `Subtaxa ${url}`
    );
    const names = json.results.bindings.map((n) => n.sub?.value).filter((n) => n && !this.expanded.has(n));
    await Promise.allSettled(
      names.map((n) => this.getName(n, { searchTerm: true, subTaxon: true }))
    );
  }
  /** @internal */
  async getNameFromLatin([genus, species, infrasp], justification) {
    const query = `
    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${genus}" .
  ${species ? `?uri dwc:species|dwc:specificEpithet "${species}" .` : "FILTER NOT EXISTS { ?uri dwc:species|dwc:specific\
Epithet ?species . }"}
  ${infrasp ? `?uri dwc:subspecies|dwc:variety|dwc:infraspecificEpithet "${infrasp}" .` : "FILTER NOT EXISTS { ?uri dwc:\
subspecies|dwc:variety|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;
    if (this.controller.signal?.aborted) return Promise.reject();
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      `NameFromLatin ${genus} ${species} ${infrasp}`
    );
    const names = json.results.bindings.map((n) => n.uri?.value).filter((n) => n && !this.expanded.has(n));
    await Promise.allSettled(names.map((n) => this.getName(n, justification)));
  }
  /** @internal */
  async getNameFromCol(colUri, justification) {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites) WHERE {
  BIND(<${colUri}> as ?col)
  ?col dwc:taxonRank ?rank .
  OPTIONAL { ?col dwc:scientificNameAuthorship ?colAuth . } BIND(COALESCE(?colAuth, "") as ?authority)
  ?col dwc:scientificName ?name . # Note: contains authority
  ?col dwc:genericName ?genus .
  # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .
  OPTIONAL {
    ?col dwc:specificEpithet ?species .
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
  }

  OPTIONAL {
    ?tn a dwcFP:TaxonName .
    ?tn dwc:rank ?rank .
    ?tn dwc:genus ?genus .
    ?tn dwc:kingdom ?kingdom .
    {
      ?col dwc:specificEpithet ?species .
      ?tn dwc:species ?species .
      {
        ?col dwc:infraspecificEpithet ?infrasp .
        ?tn dwc:subspecies|dwc:variety ?infrasp .
      } UNION {
        FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?infrasp . }
        FILTER NOT EXISTS { ?tn dwc:subspecies|dwc:variety ?infrasp . }
      }
    } UNION {
      FILTER NOT EXISTS { ?col dwc:specificEpithet ?species . }
      FILTER NOT EXISTS { ?tn dwc:species ?species . }
    }

    OPTIONAL { ?trtn trt:treatsTaxonName ?tn . }
    OPTIONAL { ?citetn trt:citesTaxonName ?tn . }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ;
          dwc:scientificNameAuthorship ?tcauth ;
          a dwcFP:TaxonConcept .
      OPTIONAL { ?aug trt:augmentsTaxonConcept ?tc . }
      OPTIONAL { ?def trt:definesTaxonConcept ?tc . }
      OPTIONAL { ?dpr trt:deprecates ?tc . }
      OPTIONAL { ?cite cito:cites ?tc . }
    }
  }
}
GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
LIMIT 500`;
    if (this.controller.signal?.aborted) return Promise.reject();
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      `NameFromCol ${colUri}`
    );
    return this.handleName(json, justification);
  }
  /** @internal */
  async getNameFromTC(tcUri, justification) {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites) WHERE {
  <${tcUri}> trt:hasTaxonName ?tn .
  ?tc trt:hasTaxonName ?tn ;
      dwc:scientificNameAuthorship ?tcauth ;
      a dwcFP:TaxonConcept .

  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?rank .
  ?tn dwc:kingdom ?kingdom .
  ?tn dwc:genus ?genus .
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subspecies|dwc:variety ?infrasp . }
  }
  
  OPTIONAL {
    ?col dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:scientificNameAuthorship ?colAuth . }
    ?col dwc:scientificName ?fullName . # Note: contains authority
    ?col dwc:genericName ?genus .
    # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .

    {
      ?col dwc:specificEpithet ?species .
      ?tn dwc:species ?species .
      {
        ?col dwc:infraspecificEpithet ?infrasp .
        ?tn dwc:subspecies|dwc:variety ?infrasp .
      } UNION {
        FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?infrasp . }
        FILTER NOT EXISTS { ?tn dwc:subspecies|dwc:variety ?infrasp . }
      }
    } UNION {
      FILTER NOT EXISTS { ?col dwc:specificEpithet ?species . }
      FILTER NOT EXISTS { ?tn dwc:species ?species . }
    }
  }
  
  BIND(COALESCE(?fullName, CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), \
COALESCE(CONCAT(" ", ?infrasp), ""))) as ?name)
  BIND(COALESCE(?colAuth, "") as ?authority)

  OPTIONAL { ?trtn trt:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn trt:citesTaxonName ?tn . }

  OPTIONAL { ?aug trt:augmentsTaxonConcept ?tc . }
  OPTIONAL { ?def trt:definesTaxonConcept ?tc . }
  OPTIONAL { ?dpr trt:deprecates ?tc . }
  OPTIONAL { ?cite cito:cites ?tc . }
}
GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
LIMIT 500`;
    if (this.controller.signal?.aborted) return Promise.reject();
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      `NameFromTC ${tcUri}`
    );
    await this.handleName(json, justification);
  }
  /** @internal */
  async getNameFromTN(tnUri, justification) {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites) WHERE {
  BIND(<${tnUri}> as ?tn)
  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?rank .
  ?tn dwc:genus ?genus .
  ?tn dwc:kingdom ?kingdom .
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subspecies|dwc:variety ?infrasp . }
  }
  
  OPTIONAL {
    ?col dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:scientificNameAuthorship ?colAuth . }
    ?col dwc:scientificName ?fullName . # Note: contains authority
    ?col dwc:genericName ?genus .
    # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .

    {
      ?col dwc:specificEpithet ?species .
      ?tn dwc:species ?species .
      {
        ?col dwc:infraspecificEpithet ?infrasp .
        ?tn dwc:subspecies|dwc:variety ?infrasp .
      } UNION {
        FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?infrasp . }
        FILTER NOT EXISTS { ?tn dwc:subspecies|dwc:variety ?infrasp . }
      }
    } UNION {
      FILTER NOT EXISTS { ?col dwc:specificEpithet ?species . }
      FILTER NOT EXISTS { ?tn dwc:species ?species . }
    }
  }
  
  BIND(COALESCE(?fullName, CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), \
COALESCE(CONCAT(" ", ?infrasp), ""))) as ?name)
  BIND(COALESCE(?colAuth, "") as ?authority)

  OPTIONAL { ?trtn trt:treatsTaxonName ?tn . }
  OPTIONAL { ?citetn trt:citesTaxonName ?tn . }

  OPTIONAL {
    ?tc trt:hasTaxonName ?tn ;
        dwc:scientificNameAuthorship ?tcauth ;
        a dwcFP:TaxonConcept .
    OPTIONAL { ?aug trt:augmentsTaxonConcept ?tc . }
    OPTIONAL { ?def trt:definesTaxonConcept ?tc . }
    OPTIONAL { ?dpr trt:deprecates ?tc . }
    OPTIONAL { ?cite cito:cites ?tc . }
  }
}
GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
LIMIT 500`;
    if (this.controller.signal?.aborted) return Promise.reject();
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      `NameFromTN ${tnUri}`
    );
    return this.handleName(json, justification);
  }
  /**
   * Note this makes some assumptions on which variables are present in the bindings
   *
   * @internal */
  async handleName(json, justification) {
    const treatmentPromises = [];
    const displayName = json.results.bindings[0].name.value.replace(
      json.results.bindings[0].authority.value,
      ""
    ).trim();
    const colName = json.results.bindings[0].col?.value ? {
      displayName,
      authority: json.results.bindings[0].authority.value,
      colURI: json.results.bindings[0].col.value,
      treatments: {
        def: /* @__PURE__ */ new Set(),
        aug: /* @__PURE__ */ new Set(),
        dpr: /* @__PURE__ */ new Set(),
        cite: /* @__PURE__ */ new Set()
      }
    } : void 0;
    if (colName) {
      if (this.expanded.has(colName.colURI)) return;
      this.expanded.add(colName.colURI);
    }
    const authorizedNames = colName ? [colName] : [];
    const taxonNameURI = json.results.bindings[0].tn?.value;
    if (taxonNameURI) {
      if (this.expanded.has(taxonNameURI)) return;
      this.expanded.add(taxonNameURI);
    }
    for (const t of json.results.bindings) {
      if (t.tc && t.tcAuth?.value) {
        if (this.expanded.has(t.tc.value)) {
          return;
        }
        const def = this.makeTreatmentSet(t.defs?.value.split("|"));
        const aug = this.makeTreatmentSet(t.augs?.value.split("|"));
        const dpr = this.makeTreatmentSet(t.dprs?.value.split("|"));
        const cite = this.makeTreatmentSet(t.cites?.value.split("|"));
        if (colName && t.tcAuth?.value.split(" / ").includes(colName.authority)) {
          colName.authority = t.tcAuth?.value;
          colName.taxonConceptURI = t.tc.value;
          colName.treatments = {
            def,
            aug,
            dpr,
            cite
          };
        } else {
          authorizedNames.push({
            displayName,
            authority: t.tcAuth.value,
            taxonConceptURI: t.tc.value,
            treatments: {
              def,
              aug,
              dpr,
              cite
            }
          });
        }
        this.expanded.add(t.tc.value);
        def.forEach((t2) => treatmentPromises.push(t2));
        aug.forEach((t2) => treatmentPromises.push(t2));
        dpr.forEach((t2) => treatmentPromises.push(t2));
      }
    }
    const treats = this.makeTreatmentSet(
      json.results.bindings[0].tntreats?.value.split("|")
    );
    treats.forEach((t) => treatmentPromises.push(t));
    const name = {
      displayName,
      taxonNameURI,
      authorizedNames,
      justification,
      treatments: {
        treats,
        cite: this.makeTreatmentSet(
          json.results.bindings[0].tncites?.value.split("|")
        )
      },
      vernacularNames: taxonNameURI ? this.getVernacular(taxonNameURI) : Promise.resolve(/* @__PURE__ */ new Map())
    };
    let colPromises = [];
    if (colName) {
      [colName.acceptedColURI, colPromises] = await this.getAcceptedCol(
        colName.colURI,
        name
      );
    }
    this.pushName(name);
    const newSynonyms = /* @__PURE__ */ new Map();
    (await Promise.all(
      treatmentPromises.map(
        (treat) => treat.details.then((d) => {
          return [treat, d];
        })
      )
    )).map(([treat, d]) => {
      d.treats.aug.difference(this.expanded).forEach(
        (s) => newSynonyms.set(s, treat)
      );
      d.treats.def.difference(this.expanded).forEach(
        (s) => newSynonyms.set(s, treat)
      );
      d.treats.dpr.difference(this.expanded).forEach(
        (s) => newSynonyms.set(s, treat)
      );
      d.treats.treattn.difference(this.expanded).forEach(
        (s) => newSynonyms.set(s, treat)
      );
    });
    await Promise.allSettled(
      [
        ...colPromises,
        ...[...newSynonyms].map(
          ([n, treatment]) => this.getName(n, { searchTerm: false, parent: name, treatment })
        )
      ]
    );
  }
  /** @internal */
  async getAcceptedCol(colUri, parent) {
    const query = `
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?current ?current_status (GROUP_CONCAT(DISTINCT ?dpr; separator="|") AS ?dprs) WHERE {
  BIND(<${colUri}> AS ?col)
  {
    ?col dwc:acceptedName ?current .
    ?dpr dwc:acceptedName ?current .
    ?current dwc:taxonomicStatus ?current_status .
  } UNION {
    ?col dwc:taxonomicStatus ?current_status .
    OPTIONAL { ?dpr dwc:acceptedName ?col . }
    FILTER NOT EXISTS { ?col dwc:acceptedName ?current . }
    BIND(?col AS ?current)
  }
}
GROUP BY ?current ?current_status`;
    if (this.acceptedCol.has(colUri)) {
      return [this.acceptedCol.get(colUri), []];
    }
    const json = await this.sparqlEndpoint.getSparqlResultSet(
      query,
      { signal: this.controller.signal },
      `AcceptedCol ${colUri}`
    );
    const promises = [];
    for (const b of json.results.bindings) {
      for (const dpr of b.dprs.value.split("|")) {
        if (dpr) {
          if (!this.acceptedCol.has(b.current.value)) {
            this.acceptedCol.set(b.current.value, b.current.value);
            promises.push(
              this.getNameFromCol(b.current.value, {
                searchTerm: false,
                parent
              })
            );
          }
          this.acceptedCol.set(dpr, b.current.value);
          if (!this.ignoreDeprecatedCoL) {
            promises.push(
              this.getNameFromCol(dpr, { searchTerm: false, parent })
            );
          }
        }
      }
    }
    if (json.results.bindings.length === 0) {
      if (!this.acceptedCol.has(colUri)) {
        this.acceptedCol.set(colUri, "INVALID COL");
      }
      return [this.acceptedCol.get(colUri), promises];
    }
    if (!this.acceptedCol.has(colUri)) this.acceptedCol.set(colUri, colUri);
    return [this.acceptedCol.get(colUri), promises];
  }
  /** @internal */
  async getVernacular(uri) {
    const result = /* @__PURE__ */ new Map();
    const query = `SELECT DISTINCT ?n WHERE { <${uri}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`;
    const bindings = (await this.sparqlEndpoint.getSparqlResultSet(query, {
      signal: this.controller.signal
    }, `Vernacular ${uri}`)).results.bindings;
    for (const b of bindings) {
      if (b.n?.value) {
        if (b.n["xml:lang"]) {
          if (result.has(b.n["xml:lang"])) {
            result.get(b.n["xml:lang"]).push(b.n.value);
          } else result.set(b.n["xml:lang"], [b.n.value]);
        } else {
          if (result.has("??")) result.get("??").push(b.n.value);
          else result.set("??", [b.n.value]);
        }
      }
    }
    return result;
  }
  /** @internal */
  makeTreatmentSet(urls) {
    if (!urls) return /* @__PURE__ */ new Set();
    return new Set(
      urls.filter((url) => !!url).map((url) => {
        if (!this.treatments.has(url)) {
          const details = this.getTreatmentDetails(url);
          this.treatments.set(url, {
            url,
            details
          });
        }
        return this.treatments.get(url);
      })
    );
  }
  /** @internal */
  async getTreatmentDetails(treatmentUri) {
    const query = `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
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
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trttn;separator="|") as ?trttns)
  (group_concat(DISTINCT ?citetn;separator="|") as ?citetns)
WHERE {
  BIND (<${treatmentUri}> as ?treatment)
  ?treatment dc:creator ?creator .
  OPTIONAL { ?treatment trt:publishedIn/dc:date ?date . }
  OPTIONAL { ?treatment dc:title ?title }
  OPTIONAL { ?treatment trt:augmentsTaxonConcept ?aug . }
  OPTIONAL { ?treatment trt:definesTaxonConcept ?def . }
  OPTIONAL { ?treatment trt:deprecates ?dpr . }
  OPTIONAL { ?treatment cito:cites ?cite . ?cite a dwcFP:TaxonConcept . }
  OPTIONAL { ?treatment trt:treatsTaxonName ?trttn . }
  OPTIONAL { ?treatment trt:citesTaxonName ?citetn . }
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
    if (this.controller.signal.aborted) {
      return {
        materialCitations: [],
        figureCitations: [],
        treats: {
          def: /* @__PURE__ */ new Set(),
          aug: /* @__PURE__ */ new Set(),
          dpr: /* @__PURE__ */ new Set(),
          citetc: /* @__PURE__ */ new Set(),
          treattn: /* @__PURE__ */ new Set(),
          citetn: /* @__PURE__ */ new Set()
        }
      };
    }
    try {
      const json = await this.sparqlEndpoint.getSparqlResultSet(
        query,
        { signal: this.controller.signal },
        `TreatmentDetails ${treatmentUri}`
      );
      const materialCitations = json.results.bindings.filter((t) => t.mc && t.catalogNumbers?.value).map((t) => {
        const httpUri = t.httpUris?.value?.split("|");
        return {
          "catalogNumber": t.catalogNumbers.value,
          "collectionCode": t.collectionCodes?.value || void 0,
          "typeStatus": t.typeStatuss?.value || void 0,
          "countryCode": t.countryCodes?.value || void 0,
          "stateProvince": t.stateProvinces?.value || void 0,
          "municipality": t.municipalitys?.value || void 0,
          "county": t.countys?.value || void 0,
          "locality": t.localitys?.value || void 0,
          "verbatimLocality": t.verbatimLocalitys?.value || void 0,
          "recordedBy": t.recordedBys?.value || void 0,
          "eventDate": t.eventDates?.value || void 0,
          "samplingProtocol": t.samplingProtocols?.value || void 0,
          "decimalLatitude": t.decimalLatitudes?.value || void 0,
          "decimalLongitude": t.decimalLongitudes?.value || void 0,
          "verbatimElevation": t.verbatimElevations?.value || void 0,
          "gbifOccurrenceId": t.gbifOccurrenceIds?.value || void 0,
          "gbifSpecimenId": t.gbifSpecimenIds?.value || void 0,
          httpUri: httpUri?.length ? httpUri : void 0
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
        { signal: this.controller.signal },
        `TreatmentDetails/Figures ${treatmentUri}`
      )).results.bindings;
      const figureCitations = figures.filter((f) => f.url?.value).map(
        (f) => {
          return { url: f.url.value, description: f.description?.value };
        }
      );
      return {
        creators: json.results.bindings[0]?.creators?.value,
        date: json.results.bindings[0]?.date?.value ? parseInt(json.results.bindings[0].date.value, 10) : void 0,
        title: json.results.bindings[0]?.title?.value,
        materialCitations,
        figureCitations,
        treats: {
          def: new Set(
            json.results.bindings[0]?.defs?.value ? json.results.bindings[0].defs.value.split("|") : void 0
          ),
          aug: new Set(
            json.results.bindings[0]?.augs?.value ? json.results.bindings[0].augs.value.split("|") : void 0
          ),
          dpr: new Set(
            json.results.bindings[0]?.dprs?.value ? json.results.bindings[0].dprs.value.split("|") : void 0
          ),
          citetc: new Set(
            json.results.bindings[0]?.cites?.value ? json.results.bindings[0].cites.value.split("|") : void 0
          ),
          treattn: new Set(
            json.results.bindings[0]?.trttns?.value ? json.results.bindings[0].trttns.value.split("|") : void 0
          ),
          citetn: new Set(
            json.results.bindings[0]?.citetns?.value ? json.results.bindings[0].citetns.value.split("|") : void 0
          )
        }
      };
    } catch (error) {
      console.warn("SPARQL Error: " + error);
      return {
        materialCitations: [],
        figureCitations: [],
        treats: {
          def: /* @__PURE__ */ new Set(),
          aug: /* @__PURE__ */ new Set(),
          dpr: /* @__PURE__ */ new Set(),
          citetc: /* @__PURE__ */ new Set(),
          treattn: /* @__PURE__ */ new Set(),
          citetn: /* @__PURE__ */ new Set()
        }
      };
    }
  }
  /** Allows iterating over the synonyms while they are found */
  [Symbol.asyncIterator]() {
    let returnedSoFar = 0;
    return {
      next: () => new Promise(
        (resolve, reject) => {
          const callback = () => {
            if (this.controller.signal.aborted) {
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
        }
      )
    };
  }
};
export {
  SparqlEndpoint,
  SynonymGroup
};
//# sourceMappingURL=mod.js.map
