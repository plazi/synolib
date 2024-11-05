async function U(h){return await new Promise(i=>{setTimeout(i,h)})}var A=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,i={},s=""){
i.headers=i.headers||{},i.headers.Accept="application/sparql-results+json";let l=0,c=async()=>{try{let d=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),i);if(!d.ok)throw new Error("Response not ok. Status "+d.status);return await d.
json()}catch(d){if(i.signal?.aborted)throw d;if(l<10){let u=50*(1<<l++);return console.warn(`!! Fetch Error. Retrying in\
 ${u}ms (${l})`),await U(u),await c()}throw console.warn("!! Fetch Error:",t,`
---
`,d),d}};return await c()}};var x=`PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?col ?rank ?genus ?subgenus ?species ?infrasp ?name ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)`,P="GROUP BY ?tn ?tc ?col ?rank ?genus ?subgenus ?species ?\
infrasp ?name ?authority",q=h=>`${x} WHERE {
BIND(<${h}> as ?col)
  ?col dwc:taxonRank ?rank .
  ?col dwc:scientificName ?name .
  ?col dwc:genericName ?genus .
  # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .
  OPTIONAL {
    ?col dwc:specificEpithet ?species .
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
  }
  OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }

  OPTIONAL {
    ?tn dwc:rank ?trank ;
       a dwcFP:TaxonName .
    FILTER(LCASE(?rank) = LCASE(?trank))
    ?tn dwc:genus ?genus .
    ?tn dwc:kingdom ?kingdom .
    {
      ?col dwc:specificEpithet ?species .
      ?tn dwc:species ?species .
      {
        ?col dwc:infraspecificEpithet ?infrasp .
        ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp .
      } UNION {
        FILTER NOT EXISTS { ?col dwc:infraspecificEpithet ?infrasp . }
        FILTER NOT EXISTS { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }
      }
    } UNION {
      FILTER NOT EXISTS { ?col dwc:specificEpithet ?species . }
      FILTER NOT EXISTS { ?tn dwc:species ?species . }
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
}
${P}
LIMIT 500`,k=h=>`${x} WHERE {
  <${h}> trt:hasTaxonName ?tn .
  ?tc trt:hasTaxonName ?tn ;
      dwc:scientificNameAuthorship ?tcauth ;
      a dwcFP:TaxonConcept .

  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?tnrank .
  ?tn dwc:kingdom ?kingdom .
  ?tn dwc:genus ?genus .
  OPTIONAL { ?tn dwc:subGenus ?subgenus . }
  OPTIONAL {
    ?tn dwc:species ?tnspecies .
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?tninfrasp . }
  }
  
  BIND(LCASE(?tnrank) AS ?rank)
  BIND(COALESCE(?tnspecies, "") AS ?species)
  BIND(COALESCE(?tninfrasp, "") AS ?infrasp)
  
  OPTIONAL {
    ?col dwc:taxonRank ?rank .
    ?col dwc:scientificName ?name . # Note: contains authority
    ?col dwc:genericName ?genus .
    # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .

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
LIMIT 500`,_=h=>`${x} WHERE {
  BIND(<${h}> as ?tn)
  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?tnrank .
  ?tn dwc:genus ?genus .
  ?tn dwc:kingdom ?kingdom .
  OPTIONAL { ?tn dwc:subGenus ?subgenus . }
  OPTIONAL {
    ?tn dwc:species ?tnspecies .
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?tninfrasp . }
  }
  
  BIND(LCASE(?tnrank) AS ?rank)
  BIND(COALESCE(?tnspecies, "") AS ?species)
  BIND(COALESCE(?tninfrasp, "") AS ?infrasp)
  
  OPTIONAL {
    ?col dwc:taxonRank ?rank .
    ?col dwc:scientificName ?name . # Note: contains authority
    ?col dwc:genericName ?genus .
    # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .

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
LIMIT 500`;var O=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,i,s=!0,l=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=s,this.startWithSubTaxa=l,i.startsWith("http"))this.getName(i,{searchTerm:!0,
subTaxon:!1}).catch(c=>{console.log("SynoGroup Failure: ",c),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let c=[...i.split(" ").filter(d=>!!d),void 0,void 0];this.getNameFromLatin(c,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}findName(t){let i;for(let s of this.names){if(s.taxonNameURI===t||s.colURI===t){i=s;break}let l=s.
authorizedNames.find(c=>c.taxonConceptURI===t||c.colURI===t);if(l){i=l;break}}return i?Promise.resolve(i):new Promise((s,l)=>{
this.monitor.addEventListener("updated",()=>{(this.names.length===0||this.isFinished)&&l();let c=this.names.at(-1);if(c.
taxonNameURI===t||c.colURI===t){s(c);return}let d=c.authorizedNames.find(u=>u.taxonConceptURI===t||u.colURI===t);if(d){s(
d);return}})})}async getName(t,i){if(this.expanded.has(t)){console.log("Skipping known",t);return}if(this.controller.signal?.
aborted)return Promise.reject();let s;if(t.startsWith("https://www.catalogueoflife.org"))s=await this.sparqlEndpoint.getSparqlResultSet(
q(t),{signal:this.controller.signal},`NameFromCol ${t}`);else if(t.startsWith("http://taxon-concept.plazi.org"))s=await this.
sparqlEndpoint.getSparqlResultSet(k(t),{signal:this.controller.signal},`NameFromTC ${t}`);else if(t.startsWith("http://t\
axon-name.plazi.org"))s=await this.sparqlEndpoint.getSparqlResultSet(_(t),{signal:this.controller.signal},`NameFromTN ${t}`);else
throw`Cannot handle name-uri <${t}> !`;await this.handleName(s,i),this.startWithSubTaxa&&i.searchTerm&&!i.subTaxon&&await this.
getSubtaxa(t)}async getSubtaxa(t){let i=t.startsWith("http://taxon-concept.plazi.org")?`
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
LIMIT 5000`;if(this.controller.signal?.aborted)return Promise.reject();let l=(await this.sparqlEndpoint.getSparqlResultSet(
i,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(c=>c.sub?.value).filter(c=>c&&!this.expanded.has(
c));await Promise.allSettled(l.map(c=>this.getName(c,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,i,s],l){let c=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${i?`?uri dwc:species|dwc:specificEpithet "${i}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${s?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${s}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let u=(await this.sparqlEndpoint.getSparqlResultSet(
c,{signal:this.controller.signal},`NameFromLatin ${t} ${i} ${s}`)).results.bindings.map(a=>a.uri?.value).filter(a=>a&&!this.
expanded.has(a));await Promise.allSettled(u.map(a=>this.getName(a,l)))}async handleName(t,i){let s=[],l=n=>{switch(n){case"\
variety":return"var.";case"subspecies":return"subsp.";case"form":return"f.";default:return n}},c=(t.results.bindings[0].
name?t.results.bindings[0].authority?t.results.bindings[0].name.value.replace(t.results.bindings[0].authority.value,""):
t.results.bindings[0].name.value:t.results.bindings[0].genus.value+(t.results.bindings[0].subgenus?.value?` (${t.results.
bindings[0].subgenus.value})`:"")+(t.results.bindings[0].species?.value?` ${t.results.bindings[0].species.value}`:"")+(t.
results.bindings[0].infrasp?.value?` ${l(t.results.bindings[0].rank.value)} ${t.results.bindings[0].infrasp.value}`:"")).
trim(),d,u=[],a=[],m=t.results.bindings[0].tn?.value;if(m){if(this.expanded.has(m))return;this.expanded.add(m)}for(let n of t.
results.bindings){if(n.col){let r=n.col.value;if(n.authority?.value){if(!u.find(f=>f.colURI===r)){if(this.expanded.has(r)){
console.log("Skipping known",r);return}u.push({displayName:c,authority:n.authority.value,colURI:n.col.value,treatments:{
def:new Set,aug:new Set,dpr:new Set,cite:new Set}})}}else{if(this.expanded.has(r)){console.log("Skipping known",r);return}
d&&d!==r&&console.log("Duplicate unathorized COL:",d,r),d=r}}if(n.tc&&n.tcAuth&&n.tcAuth.value){let r=this.makeTreatmentSet(
n.defs?.value.split("|")),f=this.makeTreatmentSet(n.augs?.value.split("|")),S=this.makeTreatmentSet(n.dprs?.value.split(
"|")),w=this.makeTreatmentSet(n.cites?.value.split("|")),N=u.find(v=>n.tcAuth.value.split(" / ").includes(v.authority));
if(N)N.authority=n.tcAuth?.value,N.taxonConceptURI=n.tc.value,N.treatments={def:r,aug:f,dpr:S,cite:w};else{if(this.expanded.
has(n.tc.value))return;a.push({displayName:c,authority:n.tcAuth.value,taxonConceptURI:n.tc.value,treatments:{def:r,aug:f,
dpr:S,cite:w}})}r.forEach(v=>s.push(v)),f.forEach(v=>s.push(v)),S.forEach(v=>s.push(v))}}let T=this.makeTreatmentSet(t.results.
bindings[0].tntreats?.value.split("|"));T.forEach(n=>s.push(n));let o={displayName:c,rank:t.results.bindings[0].rank.value,
taxonNameURI:m,authorizedNames:[...u,...a],colURI:d,justification:i,treatments:{treats:T,cite:this.makeTreatmentSet(t.results.
bindings[0].tncites?.value.split("|"))},vernacularNames:m?this.getVernacular(m):Promise.resolve(new Map)};for(let n of o.
authorizedNames)n.colURI&&this.expanded.add(n.colURI),n.taxonConceptURI&&this.expanded.add(n.taxonConceptURI);let p=[];if(d){
let[n,r]=await this.getAcceptedCol(d,o);o.acceptedColURI=n,p.push(...r)}await Promise.all(u.map(async n=>{let[r,f]=await this.
getAcceptedCol(n.colURI,o);n.acceptedColURI=r,p.push(...f)})),this.pushName(o);let e=new Map;(await Promise.all(s.map(n=>n.
details.then(r=>[n,r])))).map(([n,r])=>{r.treats.aug.difference(this.expanded).forEach(f=>e.set(f,n)),r.treats.def.difference(
this.expanded).forEach(f=>e.set(f,n)),r.treats.dpr.difference(this.expanded).forEach(f=>e.set(f,n)),r.treats.treattn.difference(
this.expanded).forEach(f=>e.set(f,n))}),await Promise.allSettled([...p,...[...e].map(([n,r])=>this.getName(n,{searchTerm:!1,
parent:o,treatment:r}))])}async getAcceptedCol(t,i){let s=`
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[this.acceptedCol.get(t),[]];let l=await this.sparqlEndpoint.
getSparqlResultSet(s,{signal:this.controller.signal},`AcceptedCol ${t}`),c=[];for(let d of l.results.bindings)for(let u of d.
dprs.value.split("|"))u&&(this.acceptedCol.has(d.current.value)||(this.acceptedCol.set(d.current.value,d.current.value),
c.push(this.getName(d.current.value,{searchTerm:!1,parent:i}))),this.acceptedCol.set(u,d.current.value),this.ignoreDeprecatedCoL||
c.push(this.getName(u,{searchTerm:!1,parent:i})));return l.results.bindings.length===0?(this.acceptedCol.has(t)||this.acceptedCol.
set(t,"INVALID COL"),[this.acceptedCol.get(t),c]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[this.acceptedCol.
get(t),c])}async getVernacular(t){let i=new Map,s=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.org/dwc/terms/verna\
cularName> ?n . }`,l=(await this.sparqlEndpoint.getSparqlResultSet(s,{signal:this.controller.signal},`Vernacular ${t}`)).
results.bindings;for(let c of l)c.n?.value&&(c.n["xml:lang"]?i.has(c.n["xml:lang"])?i.get(c.n["xml:lang"]).push(c.n.value):
i.set(c.n["xml:lang"],[c.n.value]):i.has("??")?i.get("??").push(c.n.value):i.set("??",[c.n.value]));return i}makeTreatmentSet(t){
return t?new Set(t.filter(i=>!!i).map(i=>{let[s,l]=i.split(">");if(!this.treatments.has(s)){let c=this.getTreatmentDetails(
s);this.treatments.set(s,{url:s,date:l?parseInt(l,10):void 0,details:c})}return this.treatments.get(s)})):new Set}async getTreatmentDetails(t){
let i=`
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
i,{signal:this.controller.signal},`TreatmentDetails ${t}`),l=s.results.bindings.filter(a=>a.mc&&a.catalogNumbers?.value).
map(a=>{let m=a.httpUris?.value?.split("|");return{catalogNumber:a.catalogNumbers.value,collectionCode:a.collectionCodes?.
value||void 0,typeStatus:a.typeStatuss?.value||void 0,countryCode:a.countryCodes?.value||void 0,stateProvince:a.stateProvinces?.
value||void 0,municipality:a.municipalitys?.value||void 0,county:a.countys?.value||void 0,locality:a.localitys?.value||void 0,
verbatimLocality:a.verbatimLocalitys?.value||void 0,recordedBy:a.recordedBys?.value||void 0,eventDate:a.eventDates?.value||
void 0,samplingProtocol:a.samplingProtocols?.value||void 0,decimalLatitude:a.decimalLatitudes?.value||void 0,decimalLongitude:a.
decimalLongitudes?.value||void 0,verbatimElevation:a.verbatimElevations?.value||void 0,gbifOccurrenceId:a.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:a.gbifSpecimenIds?.value||void 0,httpUri:m?.length?m:void 0}}),c=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,u=(await this.sparqlEndpoint.getSparqlResultSet(c,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(a=>a.url?.value).map(a=>({url:a.url.value,description:a.description?.value}));return{creators:s.
results.bindings[0]?.creators?.value,title:s.results.bindings[0]?.title?.value,materialCitations:l,figureCitations:u,treats:{
def:new Set(s.results.bindings[0]?.defs?.value?s.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(s.results.
bindings[0]?.augs?.value?s.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(s.results.bindings[0]?.dprs?.value?
s.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(s.results.bindings[0]?.cites?.value?s.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(s.results.bindings[0]?.trttns?.value?s.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(s.results.bindings[0]?.citetns?.value?s.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(s){
return console.warn("SPARQL Error: "+s),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((i,s)=>{let l=()=>{
if(this.controller.signal.aborted)s(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)i({value:this.
names[t++]});else if(this.isFinished)i({done:!0,value:!0});else{let c=()=>{this.monitor.removeEventListener("updated",c),
l()};this.monitor.addEventListener("updated",c)}};l()})}}};function F(h){let t=new Set(h);return Array.from(t)}var E=new URLSearchParams(document.location.search),M=!E.has("show_col"),$=E.has("subtaxa"),H=E.has("sort_treatments_by_\
type"),Q=E.get("server")||"https://treatment.ld.plazi.org/sparql",z=E.get("q")||"https://www.catalogueoflife.org/data/ta\
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
"beforebegin",L);L.append(`Finding Synonyms for ${z} `);var X=document.createElement("progress");L.append(X);var Z=performance.
now(),W=new A(Q),I=new O(W,z,M,$),C=class extends HTMLElement{constructor(t,i){super(),this.innerHTML=g[i]??g.unknown;let s=document.
createElement("button");s.classList.add("icon","button"),s.innerHTML=g.expand,s.addEventListener("click",()=>{this.classList.
toggle("expanded")?s.innerHTML=g.collapse:s.innerHTML=g.expand});let l=document.createElement("span");t.date?l.innerText=
""+t.date:(l.classList.add("missing"),l.innerText="No Date"),this.append(l);let c=document.createElement("progress");this.
append(": ",c);let d=document.createElement("a");d.classList.add("treatment","uri"),d.href=t.url,d.target="_blank",d.innerText=
t.url.replace("http://treatment.plazi.org/id/",""),d.innerHTML+=g.link,this.append(" ",d),this.append(s);let u=document.
createElement("div");u.classList.add("indent","details"),this.append(u),t.details.then(a=>{let m=document.createElement(
"span"),T=document.createElement("i");if(c.replaceWith(m," ",T),a.creators?m.innerText=a.creators:(m.classList.add("miss\
ing"),m.innerText="No Authors"),a.title?T.innerText="\u201C"+a.title+"\u201D":(T.classList.add("missing"),T.innerText="N\
o Title"),a.treats.def.size>0){let o=document.createElement("div");o.innerHTML=g.east,o.innerHTML+=g.def,(i==="def"||i===
"cite")&&o.classList.add("hidden"),u.append(o),a.treats.def.forEach(p=>{let e=document.createElement("a");e.classList.add(
"taxon","uri");let n=p.replace("http://taxon-concept.plazi.org/id/","");e.innerText=n,e.href="#"+n,e.title="show name",o.
append(" ",e),I.findName(p).then(r=>{e.classList.remove("uri"),r.authority?e.innerText=r.displayName+" "+r.authority:e.innerText=
r.displayName},()=>{e.removeAttribute("href")})})}if(a.treats.aug.size>0||a.treats.treattn.size>0){let o=document.createElement(
"div");o.innerHTML=g.east,o.innerHTML+=g.aug,(i==="aug"||i==="cite")&&o.classList.add("hidden"),u.append(o),a.treats.aug.
forEach(p=>{let e=document.createElement("a");e.classList.add("taxon","uri");let n=p.replace("http://taxon-concept.plazi\
.org/id/","");e.innerText=n,e.href="#"+n,e.title="show name",o.append(" ",e),I.findName(p).then(r=>{e.classList.remove("\
uri"),r.authority?e.innerText=r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("href")})}),
a.treats.treattn.forEach(p=>{let e=document.createElement("a");e.classList.add("taxon","uri");let n=p.replace("http://ta\
xon-name.plazi.org/id/","");e.innerText=n,e.href="#"+n,e.title="show name",o.append(" ",e),I.findName(p).then(r=>{e.classList.
remove("uri"),r.authority?e.innerText=r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("h\
ref")})})}if(a.treats.dpr.size>0){let o=document.createElement("div");o.innerHTML=g.west,o.innerHTML+=g.dpr,(i==="dpr"||
i==="cite")&&o.classList.add("hidden"),u.append(o),a.treats.dpr.forEach(p=>{let e=document.createElement("a");e.classList.
add("taxon","uri");let n=p.replace("http://taxon-concept.plazi.org/id/","");e.innerText=n,e.href="#"+n,e.title="show nam\
e",o.append(" ",e),I.findName(p).then(r=>{e.classList.remove("uri"),r.authority?e.innerText=r.displayName+" "+r.authority:
e.innerText=r.displayName},()=>{e.removeAttribute("href")})})}if(a.treats.citetc.size>0||a.treats.citetn.size>0){let o=document.
createElement("div");o.innerHTML=g.empty+g.cite,o.classList.add("hidden"),u.append(o),a.treats.citetc.forEach(p=>{let e=document.
createElement("a");e.classList.add("taxon","uri");let n=p.replace("http://taxon-concept.plazi.org/id/","");e.innerText=n,
e.href="#"+n,e.title="show name",o.append(" ",e),I.findName(p).then(r=>{e.classList.remove("uri"),r.authority?e.innerText=
r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("href")})}),a.treats.citetn.forEach(p=>{
let e=document.createElement("a");e.classList.add("taxon","uri");let n=p.replace("http://taxon-name.plazi.org/id/","");e.
innerText=n,e.href="#"+n,e.title="show name",o.append(" ",e),I.findName(p).then(r=>{e.classList.remove("uri"),r.authority?
e.innerText=r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("href")})})}if(a.figureCitations.
length>0){let o=document.createElement("div");o.classList.add("figures","hidden"),u.append(o);for(let p of a.figureCitations){
let e=document.createElement("figure");o.append(e);let n=document.createElement("img");n.src=p.url,n.loading="lazy",n.alt=
p.description??"Cited Figure without caption",e.append(n);let r=document.createElement("figcaption");r.innerText=p.description??
"",e.append(r)}}if(a.materialCitations.length>0){let o=document.createElement("div");o.innerHTML=g.empty+g.cite+" Materi\
al Citations:<br> -",o.classList.add("hidden"),u.append(o),o.innerText+=a.materialCitations.map(p=>JSON.stringify(p).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",C);var b=class extends HTMLElement{constructor(t){super();let i=document.
createElement("h2"),s=document.createElement("i");s.innerText=t.displayName,i.append(s),this.append(i);let l=document.createElement(
"span");if(l.classList.add("rank"),l.innerText=t.rank,i.append(" ",l),t.taxonNameURI){let a=document.createElement("a");
a.classList.add("taxon","uri");let m=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");a.innerText=m,a.id=m,a.
href=t.taxonNameURI,a.target="_blank",a.innerHTML+=g.link,i.append(" ",a)}let c=document.createElement("div");c.classList.
add("vernacular"),t.vernacularNames.then(a=>{a.size>0&&(c.innerText="\u201C"+F([...a.values()].flat()).join("\u201D, \u201C")+
"\u201D")}),this.append(c);let d=document.createElement("ul");if(this.append(d),t.colURI){let a=document.createElement("\
a");a.classList.add("col","uri");let m=t.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");a.innerText=m,
a.id=m,a.href=t.colURI,a.target="_blank",a.innerHTML+=g.link,i.append(" ",a);let T=document.createElement("div");T.classList.
add("treatmentline"),T.innerHTML=t.acceptedColURI!==t.colURI?g.col_dpr:g.col_aug,d.append(T);let o=document.createElement(
"span");o.innerText="Catalogue of Life",T.append(o);let p=document.createElement("div");if(p.classList.add("indent"),T.append(
p),t.acceptedColURI!==t.colURI){let e=document.createElement("div");e.innerHTML=g.east+g.col_aug,p.append(e);let n=document.
createElement("a");n.classList.add("col","uri");let r=t.acceptedColURI.replace("https://www.catalogueoflife.org/data/tax\
on/","");n.innerText=r,n.href=`#${r}`,n.title="show name",e.append(n),I.findName(t.acceptedColURI).then(f=>{f.authority?
n.innerText=f.displayName+" "+f.authority:n.innerText=f.displayName},()=>{n.removeAttribute("href")})}}if(t.treatments.treats.
size>0||t.treatments.cite.size>0){for(let a of t.treatments.treats){let m=new C(a,"aug");d.append(m)}for(let a of t.treatments.
cite){let m=new C(a,"cite");d.append(m)}}let u=document.createElement("abbr");u.classList.add("justification"),u.innerText=
"...?",R(t).then(a=>u.title=`This ${a}`),i.append(" ",u);for(let a of t.authorizedNames){let m=document.createElement("h\
3"),T=document.createElement("i");T.innerText=a.displayName,T.classList.add("gray"),m.append(T),m.append(" ",a.authority),
this.append(m);let o=document.createElement("ul");if(this.append(o),a.taxonConceptURI){let e=document.createElement("a");
e.classList.add("taxon","uri");let n=a.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/","");e.innerText=n,e.
id=n,e.href=a.taxonConceptURI,e.target="_blank",e.innerHTML+=g.link,m.append(" ",e)}if(a.colURI){let e=document.createElement(
"a");e.classList.add("col","uri");let n=a.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");e.innerText=n,
e.id=n,e.href=a.colURI,e.target="_blank",e.innerHTML+=g.link,m.append(" ",e);let r=document.createElement("div");r.classList.
add("treatmentline"),r.innerHTML=a.acceptedColURI!==a.colURI?g.col_dpr:g.col_aug,o.append(r);let f=document.createElement(
"span");f.innerText="Catalogue of Life",r.append(f);let S=document.createElement("div");if(S.classList.add("indent"),r.append(
S),a.acceptedColURI!==a.colURI){let w=document.createElement("div");w.innerHTML=g.east+g.col_aug,S.append(w);let N=document.
createElement("a");N.classList.add("col","uri");let v=a.acceptedColURI.replace("https://www.catalogueoflife.org/data/tax\
on/","");N.innerText=v,N.href=`#${v}`,N.title="show name",w.append(" ",N),I.findName(a.acceptedColURI).then(y=>{N.classList.
remove("uri"),y.authority?N.innerText=y.displayName+" "+y.authority:N.innerText=y.displayName},()=>{N.removeAttribute("h\
ref")})}}let p=[];for(let e of a.treatments.def)p.push({trt:e,status:"def"});for(let e of a.treatments.aug)p.push({trt:e,
status:"aug"});for(let e of a.treatments.dpr)p.push({trt:e,status:"dpr"});for(let e of a.treatments.cite)p.push({trt:e,status:"\
cite"});H||p.sort((e,n)=>e.trt.date&&n.trt.date?e.trt.date-n.trt.date:e.trt.date?1:n.trt.date?-1:0);for(let{trt:e,status:n}of p){
let r=new C(e,n);o.append(r)}}}};customElements.define("syno-name",b);async function R(h){if(h.justification.searchTerm)
return h.justification.subTaxon?"is a sub-taxon of the search term.":"is the search term.";if(h.justification.treatment){
let t=await h.justification.treatment.details,i=await R(h.justification.parent);return`is, according to ${t.creators} ${h.
justification.treatment.date},
     a synonym of ${h.justification.parent.displayName} which ${i}`}else{let t=await R(h.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${h.justification.parent.displayName} which ${t}`}}for await(let h of I){let t=new b(h);D.append(t)}var J=performance.
now();L.innerHTML="";L.innerText=`Found ${I.names.length} names with ${I.treatments.size} treatments. This took ${(J-Z)/
1e3} seconds.`;I.names.length===0&&D.append(":[");
//# sourceMappingURL=index.js.map
