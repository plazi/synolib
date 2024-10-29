async function x(m){return await new Promise(e=>{setTimeout(e,m)})}var S=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,e={},r=""){
e.headers=e.headers||{},e.headers.Accept="application/sparql-results+json";let i=0,s=async()=>{try{let n=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),e);if(!n.ok)throw new Error("Response not ok. Status "+n.status);return await n.
json()}catch(n){if(e.signal?.aborted)throw n;if(i<10){let o=50*(1<<i++);return console.warn(`!! Fetch Error. Retrying in\
 ${o}ms (${i})`),await x(o),await s()}throw console.warn("!! Fetch Error:",t,`
---
`,n),n}};return await s()}};var E=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,e,r=!0,i=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=r,this.startWithSubTaxa=i,e.startsWith("http"))this.getName(e,{searchTerm:!0,
subTaxon:!1}).finally(()=>this.finish());else{let s=[...e.split(" ").filter(n=>!!n),void 0,void 0];this.getNameFromLatin(
s,{searchTerm:!0,subTaxon:!1}).finally(()=>this.finish())}}async getName(t,e){if(this.expanded.has(t)){console.log("Skip\
ping known",t);return}if(t.startsWith("https://www.catalogueoflife.org"))await this.getNameFromCol(t,e);else if(t.startsWith(
"http://taxon-concept.plazi.org"))await this.getNameFromTC(t,e);else if(t.startsWith("http://taxon-name.plazi.org"))await this.
getNameFromTN(t,e);else throw`Cannot handle name-uri <${t}> !`;this.startWithSubTaxa&&e.searchTerm&&!e.subTaxon&&await this.
getSubtaxa(t)}async getSubtaxa(t){let e=t.startsWith("http://taxon-concept.plazi.org")?`
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?sub WHERE {
  BIND(<${t}> as ?url)
  ?sub trt:hasParentName*/^trt:hasTaxonName ?url .
}
LIMIT 5000`:`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?sub WHERE {
  BIND(<${t}> as ?url)
  ?sub (dwc:parent|trt:hasParentName)* ?url .
}
LIMIT 5000`;if(this.controller.signal?.aborted)return Promise.reject();let i=(await this.sparqlEndpoint.getSparqlResultSet(
e,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(s=>s.sub?.value).filter(s=>s&&!this.expanded.has(
s));await Promise.allSettled(i.map(s=>this.getName(s,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,e,r],i){let s=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${e?`?uri dwc:species|dwc:specificEpithet "${e}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${r?`?uri dwc:subspecies|dwc:variety|dwc:infraspecificEpithet "${r}" .`:"FILTER NOT EXISTS { ?uri dwc:subspecies|dwc:v\
ariety|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let o=(await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`NameFromLatin ${t} ${e} ${r}`)).results.bindings.map(a=>a.uri?.value).filter(a=>a&&!this.
expanded.has(a));await Promise.allSettled(o.map(a=>this.getName(a,i)))}async getNameFromCol(t,e){let r=`
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
  BIND(<${t}> as ?col)
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let i=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromCol ${t}`);return this.handleName(i,e)}async getNameFromTC(t,e){let r=`
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
  <${t}> trt:hasTaxonName ?tn .
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let i=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromTC ${t}`);await this.handleName(i,e)}async getNameFromTN(t,e){let r=`
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
  BIND(<${t}> as ?tn)
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let i=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromTN ${t}`);return this.handleName(i,e)}async handleName(t,e){let r=[],i=t.results.
bindings[0].name.value.replace(t.results.bindings[0].authority.value,"").trim(),s=t.results.bindings[0].col?.value?{displayName:i,
authority:t.results.bindings[0].authority.value,colURI:t.results.bindings[0].col.value,treatments:{def:new Set,aug:new Set,
dpr:new Set,cite:new Set}}:void 0;if(s){if(this.expanded.has(s.colURI))return;this.expanded.add(s.colURI)}let n=s?[s]:[],
o=t.results.bindings[0].tn?.value;if(o){if(this.expanded.has(o))return;this.expanded.add(o)}for(let p of t.results.bindings)
if(p.tc&&p.tcAuth?.value){if(this.expanded.has(p.tc.value))return;let g=this.makeTreatmentSet(p.defs?.value.split("|")),
T=this.makeTreatmentSet(p.augs?.value.split("|")),N=this.makeTreatmentSet(p.dprs?.value.split("|")),f=this.makeTreatmentSet(
p.cites?.value.split("|"));s&&p.tcAuth?.value.split(" / ").includes(s.authority)?(s.authority=p.tcAuth?.value,s.taxonConceptURI=
p.tc.value,s.treatments={def:g,aug:T,dpr:N,cite:f}):n.push({displayName:i,authority:p.tcAuth.value,taxonConceptURI:p.tc.
value,treatments:{def:g,aug:T,dpr:N,cite:f}}),this.expanded.add(p.tc.value),g.forEach(I=>r.push(I)),T.forEach(I=>r.push(
I)),N.forEach(I=>r.push(I))}let a=this.makeTreatmentSet(t.results.bindings[0].tntreats?.value.split("|"));a.forEach(p=>r.
push(p));let l={displayName:i,taxonNameURI:o,authorizedNames:n,justification:e,treatments:{treats:a,cite:this.makeTreatmentSet(
t.results.bindings[0].tncites?.value.split("|"))},vernacularNames:o?this.getVernacular(o):Promise.resolve(new Map)},d=[];
s&&([s.acceptedColURI,d]=await this.getAcceptedCol(s.colURI,l)),this.pushName(l);let c=new Map;(await Promise.all(r.map(
p=>p.details.then(g=>[p,g])))).map(([p,g])=>{g.treats.aug.difference(this.expanded).forEach(T=>c.set(T,p)),g.treats.def.
difference(this.expanded).forEach(T=>c.set(T,p)),g.treats.dpr.difference(this.expanded).forEach(T=>c.set(T,p)),g.treats.
treattn.difference(this.expanded).forEach(T=>c.set(T,p))}),await Promise.allSettled([...d,...[...c].map(([p,g])=>this.getName(
p,{searchTerm:!1,parent:l,treatment:g}))])}async getAcceptedCol(t,e){let r=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?current ?current_status (GROUP_CONCAT(DISTINCT ?dpr; separator="|") AS ?dprs) WHERE {
  BIND(<${t}> AS ?col)
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[this.acceptedCol.get(t),[]];let i=await this.sparqlEndpoint.
getSparqlResultSet(r,{signal:this.controller.signal},`AcceptedCol ${t}`),s=[];for(let n of i.results.bindings)for(let o of n.
dprs.value.split("|"))o&&(this.acceptedCol.has(n.current.value)||(this.acceptedCol.set(n.current.value,n.current.value),
s.push(this.getNameFromCol(n.current.value,{searchTerm:!1,parent:e}))),this.acceptedCol.set(o,n.current.value),this.ignoreDeprecatedCoL||
s.push(this.getNameFromCol(o,{searchTerm:!1,parent:e})));return i.results.bindings.length===0?(this.acceptedCol.has(t)||
this.acceptedCol.set(t,"INVALID COL"),[this.acceptedCol.get(t),s]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[
this.acceptedCol.get(t),s])}async getVernacular(t){let e=new Map,r=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.or\
g/dwc/terms/vernacularName> ?n . }`,i=(await this.sparqlEndpoint.getSparqlResultSet(r,{signal:this.controller.signal},`V\
ernacular ${t}`)).results.bindings;for(let s of i)s.n?.value&&(s.n["xml:lang"]?e.has(s.n["xml:lang"])?e.get(s.n["xml:lan\
g"]).push(s.n.value):e.set(s.n["xml:lang"],[s.n.value]):e.has("??")?e.get("??").push(s.n.value):e.set("??",[s.n.value]));
return e}makeTreatmentSet(t){return t?new Set(t.filter(e=>!!e).map(e=>{if(!this.treatments.has(e)){let r=this.getTreatmentDetails(
e);this.treatments.set(e,{url:e,details:r})}return this.treatments.get(e)})):new Set}async getTreatmentDetails(t){let e=`\

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
  BIND (<${t}> as ?treatment)
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
GROUP BY ?date ?title ?mc`;if(this.controller.signal.aborted)return{materialCitations:[],figureCitations:[],treats:{def:new Set,
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let r=await this.sparqlEndpoint.getSparqlResultSet(
e,{signal:this.controller.signal},`TreatmentDetails ${t}`),i=r.results.bindings.filter(a=>a.mc&&a.catalogNumbers?.value).
map(a=>{let l=a.httpUris?.value?.split("|");return{catalogNumber:a.catalogNumbers.value,collectionCode:a.collectionCodes?.
value||void 0,typeStatus:a.typeStatuss?.value||void 0,countryCode:a.countryCodes?.value||void 0,stateProvince:a.stateProvinces?.
value||void 0,municipality:a.municipalitys?.value||void 0,county:a.countys?.value||void 0,locality:a.localitys?.value||void 0,
verbatimLocality:a.verbatimLocalitys?.value||void 0,recordedBy:a.recordedBys?.value||void 0,eventDate:a.eventDates?.value||
void 0,samplingProtocol:a.samplingProtocols?.value||void 0,decimalLatitude:a.decimalLatitudes?.value||void 0,decimalLongitude:a.
decimalLongitudes?.value||void 0,verbatimElevation:a.verbatimElevations?.value||void 0,gbifOccurrenceId:a.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:a.gbifSpecimenIds?.value||void 0,httpUri:l?.length?l:void 0}}),s=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,o=(await this.sparqlEndpoint.getSparqlResultSet(s,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(a=>a.url?.value).map(a=>({url:a.url.value,description:a.description?.value}));return{creators:r.
results.bindings[0]?.creators?.value,date:r.results.bindings[0]?.date?.value?parseInt(r.results.bindings[0].date.value,10):
void 0,title:r.results.bindings[0]?.title?.value,materialCitations:i,figureCitations:o,treats:{def:new Set(r.results.bindings[0]?.
defs?.value?r.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(r.results.bindings[0]?.augs?.value?r.results.
bindings[0].augs.value.split("|"):void 0),dpr:new Set(r.results.bindings[0]?.dprs?.value?r.results.bindings[0].dprs.value.
split("|"):void 0),citetc:new Set(r.results.bindings[0]?.cites?.value?r.results.bindings[0].cites.value.split("|"):void 0),
treattn:new Set(r.results.bindings[0]?.trttns?.value?r.results.bindings[0].trttns.value.split("|"):void 0),citetn:new Set(
r.results.bindings[0]?.citetns?.value?r.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(r){return console.warn(
"SPARQL Error: "+r),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,citetc:new Set,
treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((e,r)=>{let i=()=>{if(this.
controller.signal.aborted)r(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)e({value:this.names[t++]});else if(this.
isFinished)e({done:!0,value:!0});else{let s=()=>{this.monitor.removeEventListener("updated",s),i()};this.monitor.addEventListener(
"updated",s)}};i()})}}};var L=new URLSearchParams(document.location.search),b=!L.has("show_col"),A=L.has("subtaxa"),R=L.get("server")||"https://\
treatment.ld.plazi.org/sparql",P=L.get("q")||"https://www.catalogueoflife.org/data/taxon/3WD9M",y=document.getElementById(
"root");var u={def:'<svg class="green" viewBox="0 0 24 24"><path fill="currentcolor" d="M17,13H13V17H11V13H7V11H11V7H13V11H17M12\
,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>',aug:'<svg class="blue" viewBox="0 0 \
24 24"><path fill="currentcolor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg\
>',dpr:'<svg class="red" viewBox="0 0 24 24"><path fill="currentcolor" d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 \
12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L\
17,15.59L13.41,12L17,8.41L15.59,7Z"/></svg>',cite:'<svg class="gray" viewBox="0 0 24 24"><path fill="currentcolor" d="M1\
2,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>',unknown:'<svg class="gray" viewBox=\
"0 0 24 24"><path fill="currentcolor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2\
v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-\
2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>',link:'<svg class="gray" viewBox="0 0 24 \
24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3\
.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',east:'<svg class="gray" viewBox="0 0 24 24"><path fill="currentCol\
or" d="M15,5l-1.41,1.41L18.17,11H2V13h16.17l-4.59,4.59L15,19l7-7L15,5z"/></svg>',west:'<svg class="gray" viewBox="0 0 24\
 24"><path fill="currentColor" d="M9,19l1.41-1.41L5.83,13H22V11H5.83l4.59-4.59L9,5l-7,7L9,19z"/></svg>',line:'<svg class\
="gray" viewBox="0 0 24 24"><rect fill="currentColor" height="2" width="16" x="4" y="11"/></svg>',empty:'<svg viewBox="0\
 0 24 24"></svg>'},h=class extends HTMLElement{constructor(t,e){super(),this.innerHTML=u[e]??u.unknown;let r=document.createElement(
"span");r.innerText="\u2026",this.append(r);let i=document.createElement("span");i.innerText="\u2026",this.append(" ",i);
let s=document.createElement("i");s.innerText="\u2026",this.append(" ",s);let n=document.createElement("a");n.classList.
add("treatment","uri"),n.href=t.url,n.innerText=t.url.replace("http://treatment.plazi.org/id/",""),n.innerHTML+=u.link,this.
append(" ",n);let o=document.createElement("div");o.classList.add("indent"),this.append(o),t.details.then(a=>{if(a.creators?
r.innerText=a.creators:(r.classList.add("missing"),r.innerText="No Authors"),a.date?i.innerText=""+a.date:(i.classList.add(
"missing"),i.innerText="No Date"),a.title?s.innerText="\u201C"+a.title+"\u201D":(s.classList.add("missing"),s.innerText=
"No Title"),e!=="def"&&a.treats.def.size>0&&e!=="cite"){let l=document.createElement("div");l.innerHTML=e==="cite"?u.line:
u.east,l.innerHTML+=u.def,o.append(l),a.treats.def.forEach(d=>{let c=document.createElement("code");c.classList.add("tax\
on","uri"),c.innerText=d.replace("http://taxon-concept.plazi.org/id/",""),l.append(c)})}if(e!=="aug"&&(a.treats.aug.size>
0||a.treats.treattn.size>0)&&e!=="cite"){let l=document.createElement("div");l.innerHTML=e==="cite"?u.line:u.east,l.innerHTML+=
u.aug,o.append(l),a.treats.aug.forEach(d=>{let c=document.createElement("code");c.classList.add("taxon","uri"),c.innerText=
d.replace("http://taxon-concept.plazi.org/id/",""),l.append(c)}),a.treats.treattn.forEach(d=>{let c=document.createElement(
"code");c.classList.add("taxon","uri"),c.innerText=d.replace("http://taxon-name.plazi.org/id/",""),l.append(c)})}if(e!==
"dpr"&&a.treats.dpr.size>0&&e!=="cite"){let l=document.createElement("div");l.innerHTML=e==="cite"?u.line:u.west,l.innerHTML+=
u.dpr,o.append(l),a.treats.dpr.forEach(d=>{let c=document.createElement("code");c.classList.add("taxon","uri"),c.innerText=
d.replace("http://taxon-concept.plazi.org/id/",""),l.append(c)})}if(e!=="dpr"&&(a.treats.citetc.size>0||a.treats.citetn.
size>0)&&e!=="cite"){let l=document.createElement("div");l.innerHTML=u.empty+u.cite,o.append(l),a.treats.citetc.forEach(
d=>{let c=document.createElement("code");c.classList.add("taxon","uri"),c.innerText=d.replace("http://taxon-concept.plaz\
i.org/id/",""),l.append(c)}),a.treats.citetn.forEach(d=>{let c=document.createElement("code");c.classList.add("taxon","u\
ri"),c.innerText=d.replace("http://taxon-name.plazi.org/id/",""),l.append(c)})}})}};customElements.define("syno-treatmen\
t",h);var v=class extends HTMLElement{constructor(t){super();let e=document.createElement("h2"),r=document.createElement(
"i");if(r.innerText=t.displayName,e.append(r),this.append(e),t.taxonNameURI){let n=document.createElement("code");n.classList.
add("taxon","uri"),n.innerText=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/",""),n.title=t.taxonNameURI,e.append(
n)}let i=document.createElement("abbr");i.classList.add("justification"),i.innerText="...?",O(t).then(n=>i.title=`This ${n}`),
e.append(i);let s=document.createElement("code");if(s.classList.add("vernacular"),t.vernacularNames.then(n=>{n.size>0&&(s.
innerText="\u201C"+[...n.values()].join("\u201D, \u201C")+"\u201D")}),this.append(s),t.treatments.treats.size>0||t.treatments.
cite.size>0){let n=document.createElement("ul");this.append(n);for(let o of t.treatments.treats){let a=new h(o,"aug");n.
append(a)}for(let o of t.treatments.cite){let a=new h(o,"cite");n.append(a)}}for(let n of t.authorizedNames){let o=document.
createElement("h3"),a=document.createElement("i");a.innerText=n.displayName,a.classList.add("gray"),o.append(a),o.append(
" ",n.authority),this.append(o);let l=document.createElement("ul");if(this.append(l),n.taxonConceptURI){let d=document.createElement(
"code");d.classList.add("taxon","uri"),d.innerText=n.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/",""),d.
title=n.taxonConceptURI,o.append(d)}if(n.colURI){let d=document.createElement("code");d.classList.add("col","uri");let c=n.
colURI.replace("https://www.catalogueoflife.org/data/taxon/","");d.innerText=c,d.id=c,d.title=n.colURI,o.append(d);let p=document.
createElement("div");p.classList.add("treatmentline"),p.innerHTML=n.acceptedColURI!==n.colURI?u.dpr:u.aug,l.append(p);let g=document.
createElement("span");g.innerText="Catalogue of Life",p.append(g);let T=document.createElement("div");if(p.append(T),n.acceptedColURI!==
n.colURI){let N=document.createElement("div");N.innerHTML=u.east+u.aug,T.append(N);let f=document.createElement("a");f.classList.
add("col","uri");let I=n.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");f.innerText=I,f.href=`\
#${I}`,f.title=n.acceptedColURI,N.append(f)}}for(let d of n.treatments.def){let c=new h(d,"def");l.append(c)}for(let d of n.
treatments.aug){let c=new h(d,"aug");l.append(c)}for(let d of n.treatments.dpr){let c=new h(d,"dpr");l.append(c)}for(let d of n.
treatments.cite){let c=new h(d,"cite");l.append(c)}}}};customElements.define("syno-name",v);async function O(m){if(m.justification.
searchTerm)return m.justification.subTaxon?"is a sub-taxon of the search term.":"is the search term.";if(m.justification.
treatment){let t=await m.justification.treatment.details,e=await O(m.justification.parent);return`is, according to ${t.creators}\
 ${t.date},
     a synonym of ${m.justification.parent.displayName} which ${e}`}else{let t=await O(m.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${m.justification.parent.displayName} which ${t}`}}var w=document.createElement("div");y.insertAdjacentElement(
"beforebegin",w);w.append(`Finding Synonyms for ${P} `);w.append(document.createElement("progress"));var D=performance.now(),
F=new S(R),C=new E(F,P,b,A);for await(let m of C){let t=new v(m);y.append(t)}var _=performance.now();w.innerHTML="";w.innerText=
`Found ${C.names.length} names with ${C.treatments.size} treatments. This took ${(_-D)/1e3} seconds.`;C.names.length===0&&
y.append(":[");
//# sourceMappingURL=index.js.map
