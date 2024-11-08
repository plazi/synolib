async function U(T){return await new Promise(r=>{setTimeout(r,T)})}var O=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,r={},s=""){
r.headers=r.headers||{},r.headers.Accept="application/sparql-results+json";let u=0,o=async()=>{try{let l=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),r);if(!l.ok)throw new Error("Response not ok. Status "+l.status);return await l.
json()}catch(l){if(r.signal?.aborted)throw l;if(u<10){let m=50*(1<<u++);return console.warn(`!! Fetch Error. Retrying in\
 ${m}ms (${u})`),await U(m),await o()}throw console.warn("!! Fetch Error:",t,`
---
`,l),l}};return await o()}};var x=`PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?kingdom ?tn ?tc ?col ?rank ?genus ?subgenus ?species ?infrasp ?name ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)`,P="GROUP BY ?kingdom ?tn ?tc ?col ?rank ?genus ?subgenus ?\
species ?infrasp ?name ?authority",k=T=>`${x} WHERE {
BIND(<${T}> as ?col)
  ?col dwc:taxonRank ?rank .
  ?col dwc:scientificName ?name .
  ?col dwc:genericName ?genus .
  OPTIONAL { ?col (dwc:parent|dwc:acceptedName)* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?colkingdom . }
  BIND(COALESCE(?colkingdom, "") AS ?kingdom)
  OPTIONAL { ?col dwc:infragenericEpithet ?colsubgenus . }
  BIND(COALESCE(?colsubgenus, "") AS ?subgenus)
  OPTIONAL {
    ?col dwc:specificEpithet ?species .
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
  }
  OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }

  OPTIONAL {
    ?tn dwc:rank ?trank ;
       a dwcFP:TaxonName .
    FILTER(LCASE(?rank) = LCASE(?trank))
    ?tn dwc:kingdom ?kingdom .
    ?tn dwc:genus ?genus .

    OPTIONAL { ?tn dwc:subGenus ?tnsubgenus . }
    FILTER(?subgenus = COALESCE(?tnsubgenus, ""))
    OPTIONAL { ?tn dwc:species ?tnspecies . }
    FILTER(?species = COALESCE(?tnspecies, ""))
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?tninfrasp . }
    FILTER(?infrasp = COALESCE(?tninfrasp, ""))

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?tcauth ; a dwcFP:TaxonConcept .

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
}
${P}
LIMIT 500`,_=T=>`${x} WHERE {
  <${T}> trt:hasTaxonName ?tn .
  ?tc trt:hasTaxonName ?tn ;
      dwc:scientificNameAuthorship ?tcauth ;
      a dwcFP:TaxonConcept .

  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?tnrank .
  ?tn dwc:kingdom ?kingdom .
  ?tn dwc:genus ?genus .
  OPTIONAL { ?tn dwc:subGenus ?tnsubgenus . }
  OPTIONAL {
    ?tn dwc:species ?tnspecies .
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?tninfrasp . }
  }
  
  BIND(LCASE(?tnrank) AS ?rank)
  BIND(COALESCE(?tnsubgenus, "") AS ?subgenus)
  BIND(COALESCE(?tnspecies, "") AS ?species)
  BIND(COALESCE(?tninfrasp, "") AS ?infrasp)
  
  OPTIONAL {
    ?col dwc:taxonRank ?rank .
    ?col dwc:scientificName ?name . # Note: contains authority
    ?col dwc:genericName ?genus .
    OPTIONAL { ?col (dwc:parent|dwc:acceptedName)* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?colkingdom . }
    FILTER(?kingdom = COALESCE(?colkingdom, ""))

    OPTIONAL { ?col dwc:infragenericEpithet ?colsubgenus . }
    FILTER(?subgenus = COALESCE(?colsubgenus, ""))
    OPTIONAL { ?col dwc:specificEpithet ?colspecies . }
    FILTER(?species = COALESCE(?colspecies, ""))
    OPTIONAL { ?col dwc:infraspecificEpithet ?colinfrasp . }
    FILTER(?infrasp = COALESCE(?colinfrasp, ""))
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
  }

  OPTIONAL {
    ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
    BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
  }
  OPTIONAL {
    ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
    BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
  }

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
${P}
LIMIT 500`,F=T=>`${x} WHERE {
  BIND(<${T}> as ?tn)
  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?tnrank .
  ?tn dwc:genus ?genus .
  ?tn dwc:kingdom ?kingdom .
  OPTIONAL { ?tn dwc:subGenus ?tnsubgenus . }
  OPTIONAL {
    ?tn dwc:species ?tnspecies .
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?tninfrasp . }
  }
  
  BIND(LCASE(?tnrank) AS ?rank)
  BIND(COALESCE(?tnsubgenus, "") AS ?subgenus)
  BIND(COALESCE(?tnspecies, "") AS ?species)
  BIND(COALESCE(?tninfrasp, "") AS ?infrasp)
  
  OPTIONAL {
    ?col dwc:taxonRank ?rank .
    ?col dwc:scientificName ?name . # Note: contains authority
    ?col dwc:genericName ?genus .
    OPTIONAL { ?col (dwc:parent|dwc:acceptedName)* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?colkingdom . }
    FILTER(?kingdom = COALESCE(?colkingdom, ""))

    OPTIONAL { ?col dwc:infragenericEpithet ?colsubgenus . }
    FILTER(?subgenus = COALESCE(?colsubgenus, ""))
    OPTIONAL { ?col dwc:specificEpithet ?colspecies . }
    FILTER(?species = COALESCE(?colspecies, ""))
    OPTIONAL { ?col dwc:infraspecificEpithet ?colinfrasp . }
    FILTER(?infrasp = COALESCE(?colinfrasp, ""))
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
  }

  OPTIONAL {
    ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
    BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
  }
  OPTIONAL {
    ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
    BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
  }

  OPTIONAL {
    ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?tcauth ; a dwcFP:TaxonConcept .

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
${P}
LIMIT 500`;var b=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,r,s=!0,u=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=s,this.startWithSubTaxa=u,r.startsWith("http"))this.getName(r,{searchTerm:!0,
subTaxon:!1}).catch(o=>{console.log("SynoGroup Failure: ",o),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let o=[...r.split(" ").filter(l=>!!l),void 0,void 0];this.getNameFromLatin(o,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}findName(t){let r;for(let s of this.names){if(s.taxonNameURI===t||s.colURI===t){r=s;break}let u=s.
authorizedNames.find(o=>o.taxonConceptURI===t||o.colURI===t);if(u){r=u;break}}return r?Promise.resolve(r):new Promise((s,u)=>{
this.monitor.addEventListener("updated",()=>{(this.names.length===0||this.isFinished)&&u();let o=this.names.at(-1);if(o.
taxonNameURI===t||o.colURI===t){s(o);return}let l=o.authorizedNames.find(m=>m.taxonConceptURI===t||m.colURI===t);if(l){s(
l);return}})})}async getName(t,r){if(this.expanded.has(t)){console.log("Skipping known",t);return}if(this.controller.signal?.
aborted)return Promise.reject();let s;if(t.startsWith("https://www.catalogueoflife.org"))s=await this.sparqlEndpoint.getSparqlResultSet(
k(t),{signal:this.controller.signal},`NameFromCol ${t}`);else if(t.startsWith("http://taxon-concept.plazi.org"))s=await this.
sparqlEndpoint.getSparqlResultSet(_(t),{signal:this.controller.signal},`NameFromTC ${t}`);else if(t.startsWith("http://t\
axon-name.plazi.org"))s=await this.sparqlEndpoint.getSparqlResultSet(F(t),{signal:this.controller.signal},`NameFromTN ${t}`);else
throw`Cannot handle name-uri <${t}> !`;await this.handleName(s,r),this.startWithSubTaxa&&r.searchTerm&&!r.subTaxon&&await this.
getSubtaxa(t)}async getSubtaxa(t){let r=t.startsWith("http://taxon-concept.plazi.org")?`
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
LIMIT 5000`;if(this.controller.signal?.aborted)return Promise.reject();let u=(await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(o=>o.sub?.value).filter(o=>o&&!this.expanded.has(
o));await Promise.allSettled(u.map(o=>this.getName(o,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,r,s],u){let o=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${r?`?uri dwc:species|dwc:specificEpithet "${r}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${s?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${s}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let m=(await this.sparqlEndpoint.getSparqlResultSet(
o,{signal:this.controller.signal},`NameFromLatin ${t} ${r} ${s}`)).results.bindings.map(i=>i.uri?.value).filter(i=>i&&!this.
expanded.has(i));await Promise.allSettled(m.map(i=>this.getName(i,u)))}async handleName(t,r){let s=[],u=e=>{switch(e){case"\
variety":return"var.";case"subspecies":return"subsp.";case"form":return"f.";default:return e}},o=(t.results.bindings[0].
name?t.results.bindings[0].authority?t.results.bindings[0].name.value.replace(t.results.bindings[0].authority.value,""):
t.results.bindings[0].name.value:t.results.bindings[0].genus.value+(t.results.bindings[0].subgenus?.value?` (${t.results.
bindings[0].subgenus.value})`:"")+(t.results.bindings[0].species?.value?` ${t.results.bindings[0].species.value}`:"")+(t.
results.bindings[0].infrasp?.value?` ${u(t.results.bindings[0].rank.value)} ${t.results.bindings[0].infrasp.value}`:"")).
trim(),l,m=[],i=[],c=t.results.bindings[0].tn?.value;if(c){if(this.expanded.has(c))return;this.expanded.add(c)}for(let e of t.
results.bindings){if(e.col){let n=e.col.value;if(e.authority?.value){if(!m.find(h=>h.colURI===n)){if(this.expanded.has(n)){
console.log("Skipping known",n);return}m.push({displayName:o,authority:e.authority.value,colURI:e.col.value,treatments:{
def:new Set,aug:new Set,dpr:new Set,cite:new Set}})}}else{if(this.expanded.has(n)){console.log("Skipping known",n);return}
l&&l!==n&&console.log("Duplicate unathorized COL:",l,n),l=n}}if(e.tc&&e.tcAuth&&e.tcAuth.value){let n=this.makeTreatmentSet(
e.defs?.value.split("|")),h=this.makeTreatmentSet(e.augs?.value.split("|")),v=this.makeTreatmentSet(e.dprs?.value.split(
"|")),w=this.makeTreatmentSet(e.cites?.value.split("|")),S=m.find(N=>e.tcAuth.value.split(" / ").includes(N.authority));
if(S)S.authority=e.tcAuth?.value,S.taxonConceptURI=e.tc.value,S.treatments={def:n,aug:h,dpr:v,cite:w};else{if(this.expanded.
has(e.tc.value))return;i.push({displayName:o,authority:e.tcAuth.value,taxonConceptURI:e.tc.value,treatments:{def:n,aug:h,
dpr:v,cite:w}})}n.forEach(N=>s.push(N)),h.forEach(N=>s.push(N)),v.forEach(N=>s.push(N))}}let f=this.makeTreatmentSet(t.results.
bindings[0].tntreats?.value.split("|"));f.forEach(e=>s.push(e));let d={kingdom:t.results.bindings[0].kingdom.value,displayName:o,
rank:t.results.bindings[0].rank.value,taxonNameURI:c,authorizedNames:[...m,...i],colURI:l,justification:r,treatments:{treats:f,
cite:this.makeTreatmentSet(t.results.bindings[0].tncites?.value.split("|"))},vernacularNames:c?this.getVernacular(c):Promise.
resolve(new Map)};for(let e of d.authorizedNames)e.colURI&&this.expanded.add(e.colURI),e.taxonConceptURI&&this.expanded.
add(e.taxonConceptURI);let p=[];if(l){let[e,n]=await this.getAcceptedCol(l,d);d.acceptedColURI=e,p.push(...n)}await Promise.
all(m.map(async e=>{let[n,h]=await this.getAcceptedCol(e.colURI,d);e.acceptedColURI=n,p.push(...h)})),this.pushName(d);let a=new Map;
(await Promise.all(s.map(e=>e.details.then(n=>[e,n])))).map(([e,n])=>{n.treats.aug.difference(this.expanded).forEach(h=>a.
set(h,e)),n.treats.def.difference(this.expanded).forEach(h=>a.set(h,e)),n.treats.dpr.difference(this.expanded).forEach(h=>a.
set(h,e)),n.treats.treattn.difference(this.expanded).forEach(h=>a.set(h,e))}),await Promise.allSettled([...p,...[...a].map(
([e,n])=>this.getName(e,{searchTerm:!1,parent:d,treatment:n}))])}async getAcceptedCol(t,r){let s=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?current ?current_status (GROUP_CONCAT(DISTINCT ?dpr; separator="|") AS ?dprs) WHERE {
  BIND(<${t}> AS ?col)
  {
    ?col dwc:acceptedName ?current .
    ?dpr dwc:acceptedName ?current .
    OPTIONAL { ?current dwc:taxonomicStatus ?current_status . }
  } UNION {
    ?col dwc:taxonomicStatus ?current_status .
    OPTIONAL { ?dpr dwc:acceptedName ?col . }
    FILTER NOT EXISTS { ?col dwc:acceptedName ?_ . }
    BIND(?col AS ?current)
  }
}
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[this.acceptedCol.get(t),[]];let u=await this.sparqlEndpoint.
getSparqlResultSet(s,{signal:this.controller.signal},`AcceptedCol ${t}`),o=[];for(let l of u.results.bindings)for(let m of l.
dprs.value.split("|"))m&&(this.acceptedCol.has(l.current.value)||(this.acceptedCol.set(l.current.value,l.current.value),
o.push(this.getName(l.current.value,{searchTerm:!1,parent:r}))),this.acceptedCol.set(m,l.current.value),this.ignoreDeprecatedCoL||
o.push(this.getName(m,{searchTerm:!1,parent:r})));return u.results.bindings.length===0?(this.acceptedCol.has(t)||this.acceptedCol.
set(t,"INVALID COL"),[this.acceptedCol.get(t),o]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[this.acceptedCol.
get(t),o])}async getVernacular(t){let r=new Map,s=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.org/dwc/terms/verna\
cularName> ?n . }`,u=(await this.sparqlEndpoint.getSparqlResultSet(s,{signal:this.controller.signal},`Vernacular ${t}`)).
results.bindings;for(let o of u)o.n?.value&&(o.n["xml:lang"]?r.has(o.n["xml:lang"])?r.get(o.n["xml:lang"]).push(o.n.value):
r.set(o.n["xml:lang"],[o.n.value]):r.has("??")?r.get("??").push(o.n.value):r.set("??",[o.n.value]));return r}makeTreatmentSet(t){
return t?new Set(t.filter(r=>!!r).map(r=>{let[s,u]=r.split(">");if(!this.treatments.has(s)){let o=this.getTreatmentDetails(
s);this.treatments.set(s,{url:s,date:u?parseInt(u,10):void 0,details:o})}return this.treatments.get(s)})):new Set}async getTreatmentDetails(t){
let r=`
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let s=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`TreatmentDetails ${t}`),u=s.results.bindings.filter(i=>i.mc&&i.catalogNumbers?.value).
map(i=>{let c=i.httpUris?.value?.split("|");return{catalogNumber:i.catalogNumbers.value,collectionCode:i.collectionCodes?.
value||void 0,typeStatus:i.typeStatuss?.value||void 0,countryCode:i.countryCodes?.value||void 0,stateProvince:i.stateProvinces?.
value||void 0,municipality:i.municipalitys?.value||void 0,county:i.countys?.value||void 0,locality:i.localitys?.value||void 0,
verbatimLocality:i.verbatimLocalitys?.value||void 0,recordedBy:i.recordedBys?.value||void 0,eventDate:i.eventDates?.value||
void 0,samplingProtocol:i.samplingProtocols?.value||void 0,decimalLatitude:i.decimalLatitudes?.value||void 0,decimalLongitude:i.
decimalLongitudes?.value||void 0,verbatimElevation:i.verbatimElevations?.value||void 0,gbifOccurrenceId:i.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:i.gbifSpecimenIds?.value||void 0,httpUri:c?.length?c:void 0}}),o=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,m=(await this.sparqlEndpoint.getSparqlResultSet(o,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(i=>i.url?.value).map(i=>({url:i.url.value,description:i.description?.value}));return{creators:s.
results.bindings[0]?.creators?.value,title:s.results.bindings[0]?.title?.value,materialCitations:u,figureCitations:m,treats:{
def:new Set(s.results.bindings[0]?.defs?.value?s.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(s.results.
bindings[0]?.augs?.value?s.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(s.results.bindings[0]?.dprs?.value?
s.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(s.results.bindings[0]?.cites?.value?s.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(s.results.bindings[0]?.trttns?.value?s.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(s.results.bindings[0]?.citetns?.value?s.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(s){
return console.warn("SPARQL Error: "+s),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((r,s)=>{let u=()=>{
if(this.controller.signal.aborted)s(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)r({value:this.
names[t++]});else if(this.isFinished)r({done:!0,value:!0});else{let o=()=>{this.monitor.removeEventListener("updated",o),
u()};this.monitor.addEventListener("updated",o)}};u()})}}};function z(T){let t=new Set(T);return Array.from(t)}var E=new URLSearchParams(document.location.search),$=!E.has("show_col"),H=E.has("subtaxa"),Q=E.has("sort_treatments_by_\
type"),Z=E.get("server")||"https://treatment.ld.plazi.org/sparql",B=E.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",D=document.getElementById("root");var g={def:'<svg class="green" viewBox="0 -960 960 960"><path fill="currentcolor" d="M444-288h72v-156h156v-72H516v-156h-\
72v156H288v72h156v156Zm36.28 192Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-1\
22T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-15\
6 629.28-126q-69.73 30-149 30Z"/></svg>',aug:'<svg class="blue" viewBox="0 -960 960 960"><path fill="currentcolor" d="M4\
80.28-96Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 1\
49.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-1\
49 30Z"/></svg>',dpr:'<svg class="red" viewBox="0 -960 960 960"><path fill="currentcolor" d="m339-288 141-141 141 141 51\
-51-141-141 141-141-51-51-141 141-141-141-51 51 141 141-141 141 51 51ZM480-96q-79 0-149-30t-122.5-82.5Q156-261 126-331T9\
6-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 1\
22.5Q699-156 629.5-126T480-96Z"/></svg>',cite:'<svg class="gray" viewBox="0 -960 960 960"><path fill="currentcolor" d="M\
480.28-96Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 \
149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-\
149 30Zm-.28-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z"/></svg>',unknown:'\
<svg class="gray" viewBox="0 -960 960 960"><path fill="currentcolor" d="M480-240q20 0 34-14t14-34q0-20-14-34t-34-14q-20 \
0-34 14t-14 34q0 20 14 34t34 14Zm-36-153h73q0-37 6.5-52.5T555-485q35-34 48.5-58t13.5-53q0-55-37.5-89.5T484-720q-51 0-88.\
5 27T343-620l65 27q9-28 28.5-43.5T482-652q28 0 46 16t18 42q0 23-15.5 41T496-518q-35 32-43.5 52.5T444-393Zm36 297q-79 0-1\
49-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 83\
4-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-2\
21 91t-91 221q0 130 91 221t221 91Zm0-312Z"/></svg>',col_aug:'<svg class="blue" viewBox="0 -960 960 960"><path fill="curr\
entcolor" d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29\
.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Z"\
/></svg>',col_dpr:'<svg class="red" viewBox="0 -960 960 960"><path fill="currentcolor" d="m350-300 129.77-129.77L609.53-\
300 660-350.47 530.23-480.23 660-610l-50-50-129.77 129.77L350.47-660 300-609.53l129.77 129.76L300-350l50 50ZM216-144q-29\
.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v52\
8q0 29.7-21.15 50.85Q773.7-144 744-144H216Z"/></svg>',link:'<svg class="gray" viewBox="0 -960 960 960"><path fill="curre\
ntColor" d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v\
-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z"/></svg>',
expand:'<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M240-240v-240h72v168h168v72H240Zm408-240\
v-168H480v-72h240v240h-72Z"/></svg>',collapse:'<svg class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M\
432-432v240h-72v-168H192v-72h240Zm168-336v168h168v72H528v-240h72Z"/></svg>',east:'<svg class="gray" viewBox="0 -960 960 \
960"><path fill="currentColor" d="m600-216-51-51 177-177H96v-72h630L549-693l51-51 264 264-264 264Z"/></svg>',west:'<svg \
class="gray" viewBox="0 -960 960 960"><path fill="currentColor" d="M360-216 96-480l264-264 51 51-177 177h630v72H234l177 \
177-51 51Z"/></svg>',empty:'<svg viewBox="0 -960 960 960"></svg>'},L=document.createElement("div");D.insertAdjacentElement(
"beforebegin",L);L.append(`Finding Synonyms for ${B} `);var X=document.createElement("progress");L.append(X);var W=performance.
now(),J=new O(Z),I=new b(J,B,$,H),C=class extends HTMLElement{constructor(t,r){super(),this.innerHTML=g[r]??g.unknown;let s=document.
createElement("button");s.classList.add("icon","button"),s.innerHTML=g.expand,s.addEventListener("click",()=>{this.classList.
toggle("expanded")?s.innerHTML=g.collapse:s.innerHTML=g.expand});let u=document.createElement("span");t.date?u.innerText=
""+t.date:(u.classList.add("missing"),u.innerText="No Date"),this.append(u);let o=document.createElement("progress");this.
append(": ",o);let l=document.createElement("a");l.classList.add("treatment","uri"),l.href=t.url,l.target="_blank",l.innerText=
t.url.replace("http://treatment.plazi.org/id/",""),l.innerHTML+=g.link,this.append(" ",l),this.append(s);let m=document.
createElement("div");m.classList.add("indent","details"),this.append(m),t.details.then(i=>{let c=document.createElement(
"span"),f=document.createElement("i");if(o.replaceWith(c," ",f),i.creators?c.innerText=i.creators:(c.classList.add("miss\
ing"),c.innerText="No Authors"),i.title?f.innerText="\u201C"+i.title+"\u201D":(f.classList.add("missing"),f.innerText="N\
o Title"),i.treats.def.size>0){let d=document.createElement("div");d.innerHTML=g.east,d.innerHTML+=g.def,(r==="def"||r===
"cite")&&d.classList.add("hidden"),m.append(d),i.treats.def.forEach(p=>{let a=document.createElement("a");a.classList.add(
"taxon","uri");let e=p.replace("http://taxon-concept.plazi.org/id/","");a.innerText=e,a.href="#"+e,a.title="show name",d.
append(" ",a),I.findName(p).then(n=>{a.classList.remove("uri"),n.authority?a.innerText=n.displayName+" "+n.authority:a.innerText=
n.displayName},()=>{a.removeAttribute("href")})})}if(i.treats.aug.size>0||i.treats.treattn.size>0){let d=document.createElement(
"div");d.innerHTML=g.east,d.innerHTML+=g.aug,(r==="aug"||r==="cite")&&d.classList.add("hidden"),m.append(d),i.treats.aug.
forEach(p=>{let a=document.createElement("a");a.classList.add("taxon","uri");let e=p.replace("http://taxon-concept.plazi\
.org/id/","");a.innerText=e,a.href="#"+e,a.title="show name",d.append(" ",a),I.findName(p).then(n=>{a.classList.remove("\
uri"),n.authority?a.innerText=n.displayName+" "+n.authority:a.innerText=n.displayName},()=>{a.removeAttribute("href")})}),
i.treats.treattn.forEach(p=>{let a=document.createElement("a");a.classList.add("taxon","uri");let e=p.replace("http://ta\
xon-name.plazi.org/id/","");a.innerText=e,a.href="#"+e,a.title="show name",d.append(" ",a),I.findName(p).then(n=>{a.classList.
remove("uri"),n.authority?a.innerText=n.displayName+" "+n.authority:a.innerText=n.displayName},()=>{a.removeAttribute("h\
ref")})})}if(i.treats.dpr.size>0){let d=document.createElement("div");d.innerHTML=g.west,d.innerHTML+=g.dpr,(r==="dpr"||
r==="cite")&&d.classList.add("hidden"),m.append(d),i.treats.dpr.forEach(p=>{let a=document.createElement("a");a.classList.
add("taxon","uri");let e=p.replace("http://taxon-concept.plazi.org/id/","");a.innerText=e,a.href="#"+e,a.title="show nam\
e",d.append(" ",a),I.findName(p).then(n=>{a.classList.remove("uri"),n.authority?a.innerText=n.displayName+" "+n.authority:
a.innerText=n.displayName},()=>{a.removeAttribute("href")})})}if(i.treats.citetc.size>0||i.treats.citetn.size>0){let d=document.
createElement("div");d.innerHTML=g.empty+g.cite,d.classList.add("hidden"),m.append(d),i.treats.citetc.forEach(p=>{let a=document.
createElement("a");a.classList.add("taxon","uri");let e=p.replace("http://taxon-concept.plazi.org/id/","");a.innerText=e,
a.href="#"+e,a.title="show name",d.append(" ",a),I.findName(p).then(n=>{a.classList.remove("uri"),n.authority?a.innerText=
n.displayName+" "+n.authority:a.innerText=n.displayName},()=>{a.removeAttribute("href")})}),i.treats.citetn.forEach(p=>{
let a=document.createElement("a");a.classList.add("taxon","uri");let e=p.replace("http://taxon-name.plazi.org/id/","");a.
innerText=e,a.href="#"+e,a.title="show name",d.append(" ",a),I.findName(p).then(n=>{a.classList.remove("uri"),n.authority?
a.innerText=n.displayName+" "+n.authority:a.innerText=n.displayName},()=>{a.removeAttribute("href")})})}if(i.figureCitations.
length>0){let d=document.createElement("div");d.classList.add("figures","hidden"),m.append(d);for(let p of i.figureCitations){
let a=document.createElement("figure");d.append(a);let e=document.createElement("img");e.src=p.url,e.loading="lazy",e.alt=
p.description??"Cited Figure without caption",a.append(e);let n=document.createElement("figcaption");n.innerText=p.description??
"",a.append(n)}}if(i.materialCitations.length>0){let d=document.createElement("div");d.innerHTML=g.empty+g.cite+" Materi\
al Citations:<br> -",d.classList.add("hidden"),m.append(d),d.innerText+=i.materialCitations.map(p=>JSON.stringify(p).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",C);var y=class extends HTMLElement{constructor(t){super();let r=document.
createElement("h2"),s=document.createElement("i");s.innerText=t.displayName,r.append(s),this.append(r);let u=document.createElement(
"span");u.classList.add("rank"),u.innerText=t.rank;let o=document.createElement("span");if(o.classList.add("rank"),o.innerText=
t.kingdom||"Missing Kingdom",r.append(" ",o," ",u),t.taxonNameURI){let c=document.createElement("a");c.classList.add("ta\
xon","uri");let f=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");c.innerText=f,c.id=f,c.href=t.taxonNameURI,
c.target="_blank",c.innerHTML+=g.link,r.append(" ",c)}let l=document.createElement("div");l.classList.add("vernacular"),
t.vernacularNames.then(c=>{c.size>0&&(l.innerText="\u201C"+z([...c.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(l);let m=document.createElement("ul");if(this.append(m),t.colURI){let c=document.createElement("a");c.classList.
add("col","uri");let f=t.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");c.innerText=f,c.id=f,c.href=t.
colURI,c.target="_blank",c.innerHTML+=g.link,r.append(" ",c);let d=document.createElement("div");d.classList.add("treatm\
entline"),d.innerHTML=t.acceptedColURI!==t.colURI?g.col_dpr:g.col_aug,m.append(d);let p=document.createElement("span");p.
innerText="Catalogue of Life",d.append(p);let a=document.createElement("div");if(a.classList.add("indent"),d.append(a),t.
acceptedColURI!==t.colURI){let e=document.createElement("div");e.innerHTML=g.east+g.col_aug,a.append(e);let n=document.createElement(
"a");n.classList.add("col","uri");let h=t.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");n.innerText=
h,n.href=`#${h}`,n.title="show name",e.append(n),I.findName(t.acceptedColURI).then(v=>{v.authority?n.innerText=v.displayName+
" "+v.authority:n.innerText=v.displayName},()=>{n.removeAttribute("href")})}}if(t.treatments.treats.size>0||t.treatments.
cite.size>0){for(let c of t.treatments.treats){let f=new C(c,"aug");m.append(f)}for(let c of t.treatments.cite){let f=new C(
c,"cite");m.append(f)}}let i=document.createElement("abbr");i.classList.add("justification"),i.innerText="...?",R(t).then(
c=>i.title=`This ${c}`),r.append(" ",i);for(let c of t.authorizedNames){let f=document.createElement("h3"),d=document.createElement(
"i");d.innerText=c.displayName,d.classList.add("gray"),f.append(d),f.append(" ",c.authority),this.append(f);let p=document.
createElement("ul");if(this.append(p),c.taxonConceptURI){let e=document.createElement("a");e.classList.add("taxon","uri");
let n=c.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/","");e.innerText=n,e.id=n,e.href=c.taxonConceptURI,e.
target="_blank",e.innerHTML+=g.link,f.append(" ",e)}if(c.colURI){let e=document.createElement("a");e.classList.add("col",
"uri");let n=c.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");e.innerText=n,e.id=n,e.href=c.colURI,e.target=
"_blank",e.innerHTML+=g.link,f.append(" ",e);let h=document.createElement("div");h.classList.add("treatmentline"),h.innerHTML=
c.acceptedColURI!==c.colURI?g.col_dpr:g.col_aug,p.append(h);let v=document.createElement("span");v.innerText="Catalogue \
of Life",h.append(v);let w=document.createElement("div");if(w.classList.add("indent"),h.append(w),c.acceptedColURI!==c.colURI){
let S=document.createElement("div");S.innerHTML=g.east+g.col_aug,w.append(S);let N=document.createElement("a");N.classList.
add("col","uri");let q=c.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");N.innerText=q,N.href=`\
#${q}`,N.title="show name",S.append(" ",N),I.findName(c.acceptedColURI).then(A=>{N.classList.remove("uri"),A.authority?N.
innerText=A.displayName+" "+A.authority:N.innerText=A.displayName},()=>{N.removeAttribute("href")})}}let a=[];for(let e of c.
treatments.def)a.push({trt:e,status:"def"});for(let e of c.treatments.aug)a.push({trt:e,status:"aug"});for(let e of c.treatments.
dpr)a.push({trt:e,status:"dpr"});for(let e of c.treatments.cite)a.push({trt:e,status:"cite"});Q||a.sort((e,n)=>e.trt.date&&
n.trt.date?e.trt.date-n.trt.date:e.trt.date?1:n.trt.date?-1:0);for(let{trt:e,status:n}of a){let h=new C(e,n);p.append(h)}}}};
customElements.define("syno-name",y);async function R(T){if(T.justification.searchTerm)return T.justification.subTaxon?"\
is a sub-taxon of the search term.":"is the search term.";if(T.justification.treatment){let t=await T.justification.treatment.
details,r=await R(T.justification.parent);return`is, according to ${t.creators} ${T.justification.treatment.date},
     a synonym of ${T.justification.parent.displayName} which ${r}`}else{let t=await R(T.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${T.justification.parent.displayName} which ${t}`}}for await(let T of I){let t=new y(T);D.append(t)}var G=performance.
now();L.innerHTML="";L.innerText=`Found ${I.names.length} names with ${I.treatments.size} treatments. This took ${(G-W)/
1e3} seconds.`;I.names.length===0&&D.append(":[");
//# sourceMappingURL=index.js.map
