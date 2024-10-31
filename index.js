async function R(g){return await new Promise(n=>{setTimeout(n,g)})}var w=class{constructor(e){this.sparqlEnpointUri=e}async getSparqlResultSet(e,n={},r=""){
n.headers=n.headers||{},n.headers.Accept="application/sparql-results+json";let o=0,s=async()=>{try{let d=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(e),n);if(!d.ok)throw new Error("Response not ok. Status "+d.status);return await d.
json()}catch(d){if(n.signal?.aborted)throw d;if(o<10){let a=50*(1<<o++);return console.warn(`!! Fetch Error. Retrying in\
 ${a}ms (${o})`),await R(a),await s()}throw console.warn("!! Fetch Error:",e,`
---
`,d),d}};return await s()}};var O=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(e){this.
names.push(e),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(e,n,r=!0,o=!1){
if(this.sparqlEndpoint=e,this.ignoreDeprecatedCoL=r,this.startWithSubTaxa=o,n.startsWith("http"))this.getName(n,{searchTerm:!0,
subTaxon:!1}).catch(s=>{console.log("SynoGroup Failure: ",s),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let s=[...n.split(" ").filter(d=>!!d),void 0,void 0];this.getNameFromLatin(s,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}async getName(e,n){if(this.expanded.has(e)){console.log("Skipping known",e);return}if(e.startsWith(
"https://www.catalogueoflife.org"))await this.getNameFromCol(e,n);else if(e.startsWith("http://taxon-concept.plazi.org"))
await this.getNameFromTC(e,n);else if(e.startsWith("http://taxon-name.plazi.org"))await this.getNameFromTN(e,n);else throw`\
Cannot handle name-uri <${e}> !`;this.startWithSubTaxa&&n.searchTerm&&!n.subTaxon&&await this.getSubtaxa(e)}async getSubtaxa(e){
let n=e.startsWith("http://taxon-concept.plazi.org")?`
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?sub WHERE {
  BIND(<${e}> as ?url)
  ?sub trt:hasParentName*/^trt:hasTaxonName ?url .
}
LIMIT 5000`:`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?sub WHERE {
  BIND(<${e}> as ?url)
  ?sub (dwc:parent|trt:hasParentName)* ?url .
}
LIMIT 5000`;if(this.controller.signal?.aborted)return Promise.reject();let o=(await this.sparqlEndpoint.getSparqlResultSet(
n,{signal:this.controller.signal},`Subtaxa ${e}`)).results.bindings.map(s=>s.sub?.value).filter(s=>s&&!this.expanded.has(
s));await Promise.allSettled(o.map(s=>this.getName(s,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([e,n,r],o){let s=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${e}" .
  ${n?`?uri dwc:species|dwc:specificEpithet "${n}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${r?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${r}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let a=(await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`NameFromLatin ${e} ${n} ${r}`)).results.bindings.map(i=>i.uri?.value).filter(i=>i&&!this.
expanded.has(i));await Promise.allSettled(a.map(i=>this.getName(i,o)))}async getNameFromCol(e,n){let r=`
PREFIX dc: <http://purl.org/dc/elements/1.1/>
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
  BIND(<${e}> as ?col)
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
    ?tn dwc:rank ?trank .
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
      ?trtnt trt:treatsTaxonName ?tn .
      OPTIONAL { ?trtnt trt:publishedIn/dc:date ?trtndate . }
      BIND(CONCAT(STR(?trtnt), ">", COALESCE(?trtndate, "")) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn .
      OPTIONAL { ?citetnt trt:publishedIn/dc:date ?citetndate . }
      BIND(CONCAT(STR(?citetnt), ">", COALESCE(?citetndate, "")) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ;
          dwc:scientificNameAuthorship ?tcauth ;
          a dwcFP:TaxonConcept .
      OPTIONAL {
        ?augt trt:augmentsTaxonConcept ?tc .
        OPTIONAL { ?augt trt:publishedIn/dc:date ?augdate . }
        BIND(CONCAT(STR(?augt), ">", COALESCE(?augdate, "")) AS ?aug)
      }
      OPTIONAL {
        ?deft trt:definesTaxonConcept ?tc .
        OPTIONAL { ?deft trt:publishedIn/dc:date ?defdate . }
        BIND(CONCAT(STR(?deft), ">", COALESCE(?defdate, "")) AS ?def)
      }
      OPTIONAL {
        ?dprt trt:deprecates ?tc .
        OPTIONAL { ?dprt trt:publishedIn/dc:date ?dprdate . }
            BIND(CONCAT(STR(?dprt), ">", COALESCE(?dprdate, "")) AS ?dpr)
      }
      OPTIONAL {
        ?citet cito:cites ?tc . 
        OPTIONAL { ?citet trt:publishedIn/dc:date ?citedate . }
            BIND(CONCAT(STR(?citet), ">", COALESCE(?citedate, "")) AS ?cite)
      }
    }
  }
}
GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let o=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromCol ${e}`);return this.handleName(o,n)}async getNameFromTC(e,n){let r=`
PREFIX dc: <http://purl.org/dc/elements/1.1/>
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
  <${e}> trt:hasTaxonName ?tn .
  ?tc trt:hasTaxonName ?tn ;
      dwc:scientificNameAuthorship ?tcauth ;
      a dwcFP:TaxonConcept .

  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?rank .
  ?tn dwc:kingdom ?kingdom .
  ?tn dwc:genus ?genus .
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }
  }
  
  OPTIONAL {
    ?col dwc:taxonRank ?crank .
    FILTER(LCASE(?rank) = LCASE(?crank))
    OPTIONAL { ?col dwc:scientificNameAuthorship ?colAuth . }
    ?col dwc:scientificName ?fullName . # Note: contains authority
    ?col dwc:genericName ?genus .
    # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .

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
  }
  
  BIND(COALESCE(?fullName, CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), \
COALESCE(CONCAT(" ", ?infrasp), ""))) as ?name)
  BIND(COALESCE(?colAuth, "") as ?authority)

  OPTIONAL {
    ?trtnt trt:treatsTaxonName ?tn .
    OPTIONAL { ?trtnt trt:publishedIn/dc:date ?trtndate . }
    BIND(CONCAT(STR(?trtnt), ">", COALESCE(?trtndate, "")) AS ?trtn)
  }
  OPTIONAL {
    ?citetnt trt:citesTaxonName ?tn .
    OPTIONAL { ?citetnt trt:publishedIn/dc:date ?citetndate . }
    BIND(CONCAT(STR(?citetnt), ">", COALESCE(?citetndate, "")) AS ?citetn)
  }

  OPTIONAL {
    ?augt trt:augmentsTaxonConcept ?tc .
    OPTIONAL { ?augt trt:publishedIn/dc:date ?augdate . }
    BIND(CONCAT(STR(?augt), ">", COALESCE(?augdate, "")) AS ?aug)
  }
  OPTIONAL {
    ?deft trt:definesTaxonConcept ?tc .
    OPTIONAL { ?deft trt:publishedIn/dc:date ?defdate . }
    BIND(CONCAT(STR(?deft), ">", COALESCE(?defdate, "")) AS ?def)
  }
  OPTIONAL {
    ?dprt trt:deprecates ?tc .
    OPTIONAL { ?dprt trt:publishedIn/dc:date ?dprdate . }
        BIND(CONCAT(STR(?dprt), ">", COALESCE(?dprdate, "")) AS ?dpr)
  }
  OPTIONAL {
    ?citet cito:cites ?tc . 
    OPTIONAL { ?citet trt:publishedIn/dc:date ?citedate . }
        BIND(CONCAT(STR(?citet), ">", COALESCE(?citedate, "")) AS ?cite)
  }
}
GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let o=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromTC ${e}`);await this.handleName(o,n)}async getNameFromTN(e,n){let r=`
PREFIX dc: <http://purl.org/dc/elements/1.1/>
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
  BIND(<${e}> as ?tn)
  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?rank .
  ?tn dwc:genus ?genus .
  ?tn dwc:kingdom ?kingdom .
  OPTIONAL {
    ?tn dwc:species ?species .
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }
  }
  
  OPTIONAL {
    ?col dwc:taxonRank ?crank .
    FILTER(LCASE(?rank) = LCASE(?crank))
    OPTIONAL { ?col dwc:scientificNameAuthorship ?colAuth . }
    ?col dwc:scientificName ?fullName . # Note: contains authority
    ?col dwc:genericName ?genus .
    # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .

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
  }
  
  BIND(COALESCE(?fullName, CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), \
COALESCE(CONCAT(" ", ?infrasp), ""))) as ?name)
  BIND(COALESCE(?colAuth, "") as ?authority)

  OPTIONAL {
    ?trtnt trt:treatsTaxonName ?tn .
    OPTIONAL { ?trtnt trt:publishedIn/dc:date ?trtndate . }
    BIND(CONCAT(STR(?trtnt), ">", COALESCE(?trtndate, "")) AS ?trtn)
  }
  OPTIONAL {
    ?citetnt trt:citesTaxonName ?tn .
    OPTIONAL { ?citetnt trt:publishedIn/dc:date ?citetndate . }
    BIND(CONCAT(STR(?citetnt), ">", COALESCE(?citetndate, "")) AS ?citetn)
  }

  OPTIONAL {
    ?tc trt:hasTaxonName ?tn ;
        dwc:scientificNameAuthorship ?tcauth ;
        a dwcFP:TaxonConcept .
    OPTIONAL {
      ?augt trt:augmentsTaxonConcept ?tc .
      OPTIONAL { ?augt trt:publishedIn/dc:date ?augdate . }
      BIND(CONCAT(STR(?augt), ">", COALESCE(?augdate, "")) AS ?aug)
    }
    OPTIONAL {
      ?deft trt:definesTaxonConcept ?tc .
      OPTIONAL { ?deft trt:publishedIn/dc:date ?defdate . }
      BIND(CONCAT(STR(?deft), ">", COALESCE(?defdate, "")) AS ?def)
    }
    OPTIONAL {
      ?dprt trt:deprecates ?tc .
      OPTIONAL { ?dprt trt:publishedIn/dc:date ?dprdate . }
          BIND(CONCAT(STR(?dprt), ">", COALESCE(?dprdate, "")) AS ?dpr)
    }
    OPTIONAL {
      ?citet cito:cites ?tc . 
      OPTIONAL { ?citet trt:publishedIn/dc:date ?citedate . }
          BIND(CONCAT(STR(?citet), ">", COALESCE(?citedate, "")) AS ?cite)
    }
  }
}
GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let o=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromTN ${e}`);return this.handleName(o,n)}async handleName(e,n){let r=[],o=e.results.
bindings[0].name.value.replace(e.results.bindings[0].authority.value,"").trim(),s=[],d=[],a=e.results.bindings[0].tn?.value;
if(a){if(this.expanded.has(a))return;this.expanded.add(a)}for(let t of e.results.bindings){if(t.col){let c=t.col.value;if(!s.
find(u=>u.colURI===c)){if(this.expanded.has(c)){console.log("Skipping known",c);return}s.push({displayName:o,authority:t.
authority.value,colURI:t.col.value,treatments:{def:new Set,aug:new Set,dpr:new Set,cite:new Set}})}}if(t.tc&&t.tcAuth&&t.
tcAuth.value){let c=this.makeTreatmentSet(t.defs?.value.split("|")),u=this.makeTreatmentSet(t.augs?.value.split("|")),I=this.
makeTreatmentSet(t.dprs?.value.split("|")),N=this.makeTreatmentSet(t.cites?.value.split("|")),f=s.find(h=>t.tcAuth.value.
split(" / ").includes(h.authority));if(f)f.authority=t.tcAuth?.value,f.taxonConceptURI=t.tc.value,f.treatments={def:c,aug:u,
dpr:I,cite:N};else{if(this.expanded.has(t.tc.value))return;d.push({displayName:o,authority:t.tcAuth.value,taxonConceptURI:t.
tc.value,treatments:{def:c,aug:u,dpr:I,cite:N}})}c.forEach(h=>r.push(h)),u.forEach(h=>r.push(h)),I.forEach(h=>r.push(h))}}
let i=this.makeTreatmentSet(e.results.bindings[0].tntreats?.value.split("|"));i.forEach(t=>r.push(t));let m={displayName:o,
rank:e.results.bindings[0].rank.value,taxonNameURI:a,authorizedNames:[...s,...d],justification:n,treatments:{treats:i,cite:this.
makeTreatmentSet(e.results.bindings[0].tncites?.value.split("|"))},vernacularNames:a?this.getVernacular(a):Promise.resolve(
new Map)};for(let t of m.authorizedNames)t.colURI&&this.expanded.add(t.colURI),t.taxonConceptURI&&this.expanded.add(t.taxonConceptURI);
let l=[];await Promise.all(s.map(async t=>{let[c,u]=await this.getAcceptedCol(t.colURI,m);t.acceptedColURI=c,l.push(...u)})),
this.pushName(m);let p=new Map;(await Promise.all(r.map(t=>t.details.then(c=>[t,c])))).map(([t,c])=>{c.treats.aug.difference(
this.expanded).forEach(u=>p.set(u,t)),c.treats.def.difference(this.expanded).forEach(u=>p.set(u,t)),c.treats.dpr.difference(
this.expanded).forEach(u=>p.set(u,t)),c.treats.treattn.difference(this.expanded).forEach(u=>p.set(u,t))}),await Promise.
allSettled([...l,...[...p].map(([t,c])=>this.getName(t,{searchTerm:!1,parent:m,treatment:c}))])}async getAcceptedCol(e,n){
let r=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?current ?current_status (GROUP_CONCAT(DISTINCT ?dpr; separator="|") AS ?dprs) WHERE {
  BIND(<${e}> AS ?col)
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(e))return[this.acceptedCol.get(e),[]];let o=await this.sparqlEndpoint.
getSparqlResultSet(r,{signal:this.controller.signal},`AcceptedCol ${e}`),s=[];for(let d of o.results.bindings)for(let a of d.
dprs.value.split("|"))a&&(this.acceptedCol.has(d.current.value)||(this.acceptedCol.set(d.current.value,d.current.value),
s.push(this.getNameFromCol(d.current.value,{searchTerm:!1,parent:n}))),this.acceptedCol.set(a,d.current.value),this.ignoreDeprecatedCoL||
s.push(this.getNameFromCol(a,{searchTerm:!1,parent:n})));return o.results.bindings.length===0?(this.acceptedCol.has(e)||
this.acceptedCol.set(e,"INVALID COL"),[this.acceptedCol.get(e),s]):(this.acceptedCol.has(e)||this.acceptedCol.set(e,e),[
this.acceptedCol.get(e),s])}async getVernacular(e){let n=new Map,r=`SELECT DISTINCT ?n WHERE { <${e}> <http://rs.tdwg.or\
g/dwc/terms/vernacularName> ?n . }`,o=(await this.sparqlEndpoint.getSparqlResultSet(r,{signal:this.controller.signal},`V\
ernacular ${e}`)).results.bindings;for(let s of o)s.n?.value&&(s.n["xml:lang"]?n.has(s.n["xml:lang"])?n.get(s.n["xml:lan\
g"]).push(s.n.value):n.set(s.n["xml:lang"],[s.n.value]):n.has("??")?n.get("??").push(s.n.value):n.set("??",[s.n.value]));
return n}makeTreatmentSet(e){return e?new Set(e.filter(n=>!!n).map(n=>{let[r,o]=n.split(">");if(!this.treatments.has(r)){
let s=this.getTreatmentDetails(r);this.treatments.set(r,{url:r,date:o?parseInt(o,10):void 0,details:s})}return this.treatments.
get(r)})):new Set}async getTreatmentDetails(e){let n=`
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
  BIND (<${e}> as ?treatment)
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let r=await this.sparqlEndpoint.getSparqlResultSet(
n,{signal:this.controller.signal},`TreatmentDetails ${e}`),o=r.results.bindings.filter(i=>i.mc&&i.catalogNumbers?.value).
map(i=>{let m=i.httpUris?.value?.split("|");return{catalogNumber:i.catalogNumbers.value,collectionCode:i.collectionCodes?.
value||void 0,typeStatus:i.typeStatuss?.value||void 0,countryCode:i.countryCodes?.value||void 0,stateProvince:i.stateProvinces?.
value||void 0,municipality:i.municipalitys?.value||void 0,county:i.countys?.value||void 0,locality:i.localitys?.value||void 0,
verbatimLocality:i.verbatimLocalitys?.value||void 0,recordedBy:i.recordedBys?.value||void 0,eventDate:i.eventDates?.value||
void 0,samplingProtocol:i.samplingProtocols?.value||void 0,decimalLatitude:i.decimalLatitudes?.value||void 0,decimalLongitude:i.
decimalLongitudes?.value||void 0,verbatimElevation:i.verbatimElevations?.value||void 0,gbifOccurrenceId:i.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:i.gbifSpecimenIds?.value||void 0,httpUri:m?.length?m:void 0}}),s=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${e}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,a=(await this.sparqlEndpoint.getSparqlResultSet(s,{signal:this.controller.signal},`TreatmentDetails/Figures ${e}`)).
results.bindings.filter(i=>i.url?.value).map(i=>({url:i.url.value,description:i.description?.value}));return{creators:r.
results.bindings[0]?.creators?.value,title:r.results.bindings[0]?.title?.value,materialCitations:o,figureCitations:a,treats:{
def:new Set(r.results.bindings[0]?.defs?.value?r.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(r.results.
bindings[0]?.augs?.value?r.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(r.results.bindings[0]?.dprs?.value?
r.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(r.results.bindings[0]?.cites?.value?r.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(r.results.bindings[0]?.trttns?.value?r.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(r.results.bindings[0]?.citetns?.value?r.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(r){
return console.warn("SPARQL Error: "+r),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let e=0;return{next:()=>new Promise((n,r)=>{let o=()=>{
if(this.controller.signal.aborted)r(new Error("SynyonymGroup has been aborted"));else if(e<this.names.length)n({value:this.
names[e++]});else if(this.isFinished)n({done:!0,value:!0});else{let s=()=>{this.monitor.removeEventListener("updated",s),
o()};this.monitor.addEventListener("updated",s)}};o()})}}};function b(g){let e=new Set(g);return Array.from(e)}var C=new URLSearchParams(document.location.search),D=!C.has("show_col"),F=C.has("subtaxa"),_=C.has("sort_treatments_by_\
type"),k=C.get("server")||"https://treatment.ld.plazi.org/sparql",x=C.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",P=document.getElementById("root");var T={def:'<svg class="green" viewBox="0 0 24 24"><path fill="currentcolor" d="M17,13H13V17H11V13H7V11H11V7H13V11H17M12\
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
 0 24 24"></svg>'},S=class extends HTMLElement{constructor(e,n){super(),n==="full"?this.classList.add("expanded"):(this.
innerHTML=T[n]??T.unknown,this.addEventListener("click",()=>{this.classList.toggle("expanded")}));let r=document.createElement(
"span");e.date?r.innerText=""+e.date:(r.classList.add("missing"),r.innerText="No Date"),this.append(r);let o=document.createElement(
"progress");this.append(": ",o);let s=document.createElement("a");s.classList.add("treatment","uri"),s.href=e.url,s.target=
"_blank",s.innerText=e.url.replace("http://treatment.plazi.org/id/",""),s.innerHTML+=T.link,this.append(" ",s);let d=document.
createElement("div");d.classList.add("indent","details"),this.append(d),e.details.then(a=>{let i=document.createElement(
"span"),m=document.createElement("i");if(o.replaceWith(i," ",m),a.creators?i.innerText=a.creators:(i.classList.add("miss\
ing"),i.innerText="No Authors"),a.title?m.innerText="\u201C"+a.title+"\u201D":(m.classList.add("missing"),m.innerText="N\
o Title"),a.treats.def.size>0){let l=document.createElement("div");l.innerHTML=T.east,l.innerHTML+=T.def,(n==="def"||n===
"cite")&&l.classList.add("hidden"),d.append(l),a.treats.def.forEach(p=>{let t=document.createElement("a");t.classList.add(
"taxon","uri");let c=p.replace("http://taxon-concept.plazi.org/id/","");t.innerText=c,t.href="#"+c,t.title="show name",l.
append(t)})}if(a.treats.aug.size>0||a.treats.treattn.size>0){let l=document.createElement("div");l.innerHTML=T.east,l.innerHTML+=
T.aug,(n==="aug"||n==="cite")&&l.classList.add("hidden"),d.append(l),a.treats.aug.forEach(p=>{let t=document.createElement(
"a");t.classList.add("taxon","uri");let c=p.replace("http://taxon-concept.plazi.org/id/","");t.innerText=c,t.href="#"+c,
t.title="show name",l.append(t)}),a.treats.treattn.forEach(p=>{let t=document.createElement("a");t.classList.add("taxon",
"uri");let c=p.replace("http://taxon-name.plazi.org/id/","");t.innerText=c,t.href="#"+c,t.title="show name",l.append(t)})}
if(a.treats.dpr.size>0){let l=document.createElement("div");l.innerHTML=T.west,l.innerHTML+=T.dpr,(n==="dpr"||n==="cite")&&
l.classList.add("hidden"),d.append(l),a.treats.dpr.forEach(p=>{let t=document.createElement("a");t.classList.add("taxon",
"uri");let c=p.replace("http://taxon-concept.plazi.org/id/","");t.innerText=c,t.href="#"+c,t.title="show name",l.append(
t)})}if(a.treats.citetc.size>0||a.treats.citetn.size>0){let l=document.createElement("div");l.innerHTML=T.empty+T.cite,l.
classList.add("hidden"),d.append(l),a.treats.citetc.forEach(p=>{let t=document.createElement("a");t.classList.add("taxon",
"uri");let c=p.replace("http://taxon-concept.plazi.org/id/","");t.innerText=c,t.href="#"+c,t.title="show name",l.append(
t)}),a.treats.citetn.forEach(p=>{let t=document.createElement("a");t.classList.add("taxon","uri");let c=p.replace("http:\
//taxon-name.plazi.org/id/","");t.innerText=c,t.href="#"+c,t.title="show name",l.append(t)})}})}};customElements.define(
"syno-treatment",S);var L=class extends HTMLElement{constructor(e){super();let n=document.createElement("h2"),r=document.
createElement("i");r.innerText=e.displayName,n.append(r),this.append(n);let o=document.createElement("span");if(o.classList.
add("rank"),o.innerText=e.rank,n.append(" ",o),e.taxonNameURI){let a=document.createElement("a");a.classList.add("taxon",
"uri");let i=e.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");a.innerText=i,a.id=i,a.href=e.taxonNameURI,a.target=
"_blank",a.innerHTML+=T.link,n.append(" ",a)}let s=document.createElement("abbr");s.classList.add("justification"),s.innerText=
"...?",A(e).then(a=>s.title=`This ${a}`),n.append(" ",s);let d=document.createElement("div");if(d.classList.add("vernacu\
lar"),e.vernacularNames.then(a=>{a.size>0&&(d.innerText="\u201C"+b([...a.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(d),e.treatments.treats.size>0||e.treatments.cite.size>0){let a=document.createElement("ul");this.append(a);for(let i of e.
treatments.treats){let m=new S(i,"aug");a.append(m)}for(let i of e.treatments.cite){let m=new S(i,"cite");a.append(m)}}for(let a of e.
authorizedNames){let i=document.createElement("h3"),m=document.createElement("i");m.innerText=a.displayName,m.classList.
add("gray"),i.append(m),i.append(" ",a.authority),this.append(i);let l=document.createElement("ul");if(this.append(l),a.
taxonConceptURI){let t=document.createElement("a");t.classList.add("taxon","uri");let c=a.taxonConceptURI.replace("http:\
//taxon-concept.plazi.org/id/","");t.innerText=c,t.id=c,t.href=a.taxonConceptURI,t.target="_blank",t.innerHTML+=T.link,i.
append(" ",t)}if(a.colURI){let t=document.createElement("a");t.classList.add("col","uri");let c=a.colURI.replace("https:\
//www.catalogueoflife.org/data/taxon/","");t.innerText=c,t.id=c,t.href=a.colURI,t.target="_blank",t.innerHTML+=T.link,i.
append(" ",t);let u=document.createElement("div");u.classList.add("treatmentline"),u.innerHTML=a.acceptedColURI!==a.colURI?
T.dpr:T.aug,l.append(u);let I=document.createElement("span");I.innerText="Catalogue of Life",u.append(I);let N=document.
createElement("div");if(N.classList.add("indent"),u.append(N),a.acceptedColURI!==a.colURI){let f=document.createElement(
"div");f.innerHTML=T.east+T.aug,N.append(f);let h=document.createElement("a");h.classList.add("col","uri");let y=a.acceptedColURI.
replace("https://www.catalogueoflife.org/data/taxon/","");h.innerText=y,h.href=`#${y}`,h.title="show name",f.append(h)}}
let p=[];for(let t of a.treatments.def)p.push({trt:t,status:"def"});for(let t of a.treatments.aug)p.push({trt:t,status:"\
aug"});for(let t of a.treatments.dpr)p.push({trt:t,status:"dpr"});for(let t of a.treatments.cite)p.push({trt:t,status:"c\
ite"});_||p.sort((t,c)=>t.trt.date&&c.trt.date?t.trt.date-c.trt.date:t.trt.date?1:c.trt.date?-1:0);for(let{trt:t,status:c}of p){
let u=new S(t,c);l.append(u)}}}};customElements.define("syno-name",L);async function A(g){if(g.justification.searchTerm)
return g.justification.subTaxon?"is a sub-taxon of the search term.":"is the search term.";if(g.justification.treatment){
let e=await g.justification.treatment.details,n=await A(g.justification.parent);return`is, according to ${e.creators} ${g.
justification.treatment.date},
     a synonym of ${g.justification.parent.displayName} which ${n}`}else{let e=await A(g.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${g.justification.parent.displayName} which ${e}`}}var E=document.createElement("div");P.insertAdjacentElement(
"beforebegin",E);E.append(`Finding Synonyms for ${x} `);var B=document.createElement("progress");E.append(B);var M=performance.
now(),z=new w(k),v=new O(z,x,D,F);for await(let g of v){let e=new L(g);P.append(e)}var q=performance.now();E.innerHTML="";
E.innerText=`Found ${v.names.length} names with ${v.treatments.size} treatments. This took ${(q-M)/1e3} seconds.`;v.names.
length===0&&P.append(":[");
//# sourceMappingURL=index.js.map
