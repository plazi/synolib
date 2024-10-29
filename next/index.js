async function b(m){return await new Promise(e=>{setTimeout(e,m)})}var E=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,e={},s=""){
e.headers=e.headers||{},e.headers.Accept="application/sparql-results+json";let c=0,r=async()=>{try{let n=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),e);if(!n.ok)throw new Error("Response not ok. Status "+n.status);return await n.
json()}catch(n){if(e.signal?.aborted)throw n;if(c<10){let d=50*(1<<c++);return console.warn(`!! Fetch Error. Retrying in\
 ${d}ms (${c})`),await b(d),await r()}throw console.warn("!! Fetch Error:",t,`
---
`,n),n}};return await r()}};var w=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,e,s=!0,c=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=s,this.startWithSubTaxa=c,e.startsWith("http"))this.getName(e,{searchTerm:!0,
subTaxon:!1}).finally(()=>this.finish());else{let r=[...e.split(" ").filter(n=>!!n),void 0,void 0];this.getNameFromLatin(
r,{searchTerm:!0,subTaxon:!1}).finally(()=>this.finish())}}async getName(t,e){if(this.expanded.has(t)){console.log("Skip\
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
LIMIT 5000`;if(this.controller.signal?.aborted)return Promise.reject();let c=(await this.sparqlEndpoint.getSparqlResultSet(
e,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(r=>r.sub?.value).filter(r=>r&&!this.expanded.has(
r));await Promise.allSettled(c.map(r=>this.getName(r,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,e,s],c){let r=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${e?`?uri dwc:species|dwc:specificEpithet "${e}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${s?`?uri dwc:subspecies|dwc:variety|dwc:infraspecificEpithet "${s}" .`:"FILTER NOT EXISTS { ?uri dwc:subspecies|dwc:v\
ariety|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let d=(await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromLatin ${t} ${e} ${s}`)).results.bindings.map(a=>a.uri?.value).filter(a=>a&&!this.
expanded.has(a));await Promise.allSettled(d.map(a=>this.getName(a,c)))}async getNameFromCol(t,e){let s=`
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let c=await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`NameFromCol ${t}`);return this.handleName(c,e)}async getNameFromTC(t,e){let s=`
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let c=await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`NameFromTC ${t}`);await this.handleName(c,e)}async getNameFromTN(t,e){let s=`
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let c=await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`NameFromTN ${t}`);return this.handleName(c,e)}async handleName(t,e){let s=[],c=t.results.
bindings[0].name.value.replace(t.results.bindings[0].authority.value,"").trim(),r=t.results.bindings[0].col?.value?{displayName:c,
authority:t.results.bindings[0].authority.value,colURI:t.results.bindings[0].col.value,treatments:{def:new Set,aug:new Set,
dpr:new Set,cite:new Set}}:void 0;if(r){if(this.expanded.has(r.colURI))return;this.expanded.add(r.colURI)}let n=r?[r]:[],
d=t.results.bindings[0].tn?.value;if(d){if(this.expanded.has(d))return;this.expanded.add(d)}for(let l of t.results.bindings)
if(l.tc&&l.tcAuth?.value){if(this.expanded.has(l.tc.value))return;let u=this.makeTreatmentSet(l.defs?.value.split("|")),
T=this.makeTreatmentSet(l.augs?.value.split("|")),I=this.makeTreatmentSet(l.dprs?.value.split("|")),f=this.makeTreatmentSet(
l.cites?.value.split("|"));r&&l.tcAuth?.value.split(" / ").includes(r.authority)?(r.authority=l.tcAuth?.value,r.taxonConceptURI=
l.tc.value,r.treatments={def:u,aug:T,dpr:I,cite:f}):n.push({displayName:c,authority:l.tcAuth.value,taxonConceptURI:l.tc.
value,treatments:{def:u,aug:T,dpr:I,cite:f}}),this.expanded.add(l.tc.value),u.forEach(h=>s.push(h)),T.forEach(h=>s.push(
h)),I.forEach(h=>s.push(h))}let a=this.makeTreatmentSet(t.results.bindings[0].tntreats?.value.split("|"));a.forEach(l=>s.
push(l));let o={displayName:c,taxonNameURI:d,authorizedNames:n,justification:e,treatments:{treats:a,cite:this.makeTreatmentSet(
t.results.bindings[0].tncites?.value.split("|"))},vernacularNames:d?this.getVernacular(d):Promise.resolve(new Map)},p=[];
r&&([r.acceptedColURI,p]=await this.getAcceptedCol(r.colURI,o)),this.pushName(o);let i=new Map;(await Promise.all(s.map(
l=>l.details.then(u=>[l,u])))).map(([l,u])=>{u.treats.aug.difference(this.expanded).forEach(T=>i.set(T,l)),u.treats.def.
difference(this.expanded).forEach(T=>i.set(T,l)),u.treats.dpr.difference(this.expanded).forEach(T=>i.set(T,l)),u.treats.
treattn.difference(this.expanded).forEach(T=>i.set(T,l))}),await Promise.allSettled([...p,...[...i].map(([l,u])=>this.getName(
l,{searchTerm:!1,parent:o,treatment:u}))])}async getAcceptedCol(t,e){let s=`
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[this.acceptedCol.get(t),[]];let c=await this.sparqlEndpoint.
getSparqlResultSet(s,{signal:this.controller.signal},`AcceptedCol ${t}`),r=[];for(let n of c.results.bindings)for(let d of n.
dprs.value.split("|"))d&&(this.acceptedCol.has(n.current.value)||(this.acceptedCol.set(n.current.value,n.current.value),
r.push(this.getNameFromCol(n.current.value,{searchTerm:!1,parent:e}))),this.acceptedCol.set(d,n.current.value),this.ignoreDeprecatedCoL||
r.push(this.getNameFromCol(d,{searchTerm:!1,parent:e})));return c.results.bindings.length===0?(this.acceptedCol.has(t)||
this.acceptedCol.set(t,"INVALID COL"),[this.acceptedCol.get(t),r]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[
this.acceptedCol.get(t),r])}async getVernacular(t){let e=new Map,s=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.or\
g/dwc/terms/vernacularName> ?n . }`,c=(await this.sparqlEndpoint.getSparqlResultSet(s,{signal:this.controller.signal},`V\
ernacular ${t}`)).results.bindings;for(let r of c)r.n?.value&&(r.n["xml:lang"]?e.has(r.n["xml:lang"])?e.get(r.n["xml:lan\
g"]).push(r.n.value):e.set(r.n["xml:lang"],[r.n.value]):e.has("??")?e.get("??").push(r.n.value):e.set("??",[r.n.value]));
return e}makeTreatmentSet(t){return t?new Set(t.filter(e=>!!e).map(e=>{let[s,c]=e.split(">");if(!this.treatments.has(s)){
let r=this.getTreatmentDetails(s);this.treatments.set(s,{url:s,date:c?parseInt(c,10):void 0,details:r})}return this.treatments.
get(s)})):new Set}async getTreatmentDetails(t){let e=`
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
e,{signal:this.controller.signal},`TreatmentDetails ${t}`),c=s.results.bindings.filter(a=>a.mc&&a.catalogNumbers?.value).
map(a=>{let o=a.httpUris?.value?.split("|");return{catalogNumber:a.catalogNumbers.value,collectionCode:a.collectionCodes?.
value||void 0,typeStatus:a.typeStatuss?.value||void 0,countryCode:a.countryCodes?.value||void 0,stateProvince:a.stateProvinces?.
value||void 0,municipality:a.municipalitys?.value||void 0,county:a.countys?.value||void 0,locality:a.localitys?.value||void 0,
verbatimLocality:a.verbatimLocalitys?.value||void 0,recordedBy:a.recordedBys?.value||void 0,eventDate:a.eventDates?.value||
void 0,samplingProtocol:a.samplingProtocols?.value||void 0,decimalLatitude:a.decimalLatitudes?.value||void 0,decimalLongitude:a.
decimalLongitudes?.value||void 0,verbatimElevation:a.verbatimElevations?.value||void 0,gbifOccurrenceId:a.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:a.gbifSpecimenIds?.value||void 0,httpUri:o?.length?o:void 0}}),r=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,d=(await this.sparqlEndpoint.getSparqlResultSet(r,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(a=>a.url?.value).map(a=>({url:a.url.value,description:a.description?.value}));return{creators:s.
results.bindings[0]?.creators?.value,title:s.results.bindings[0]?.title?.value,materialCitations:c,figureCitations:d,treats:{
def:new Set(s.results.bindings[0]?.defs?.value?s.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(s.results.
bindings[0]?.augs?.value?s.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(s.results.bindings[0]?.dprs?.value?
s.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(s.results.bindings[0]?.cites?.value?s.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(s.results.bindings[0]?.trttns?.value?s.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(s.results.bindings[0]?.citetns?.value?s.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(s){
return console.warn("SPARQL Error: "+s),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((e,s)=>{let c=()=>{
if(this.controller.signal.aborted)s(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)e({value:this.
names[t++]});else if(this.isFinished)e({done:!0,value:!0});else{let r=()=>{this.monitor.removeEventListener("updated",r),
c()};this.monitor.addEventListener("updated",r)}};c()})}}};var S=new URLSearchParams(document.location.search),x=!S.has("show_col"),R=S.has("subtaxa"),D=S.has("sort_treatments_by_\
type"),F=S.get("server")||"https://treatment.ld.plazi.org/sparql",y=S.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",A=document.getElementById("root");var g={def:'<svg class="green" viewBox="0 0 24 24"><path fill="currentcolor" d="M17,13H13V17H11V13H7V11H11V7H13V11H17M12\
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
 0 24 24"></svg>'},N=class extends HTMLElement{constructor(t,e){super(),e==="full"?this.classList.add("expanded"):(this.
innerHTML=g[e]??g.unknown,this.addEventListener("click",()=>{this.classList.toggle("expanded")}));let s=document.createElement(
"span");t.date?s.innerText=""+t.date:(s.classList.add("missing"),s.innerText="No Date"),this.append(s);let c=document.createElement(
"span");c.innerText="\u2026",this.append(": ",c);let r=document.createElement("i");r.innerText="\u2026",this.append(" ",
r);let n=document.createElement("a");n.classList.add("treatment","uri"),n.href=t.url,n.innerText=t.url.replace("http://t\
reatment.plazi.org/id/",""),n.innerHTML+=g.link,this.append(" ",n);let d=document.createElement("div");d.classList.add("\
indent","details"),this.append(d),t.details.then(a=>{if(a.creators?c.innerText=a.creators:(c.classList.add("missing"),c.
innerText="No Authors"),a.title?r.innerText="\u201C"+a.title+"\u201D":(r.classList.add("missing"),r.innerText="No Title"),
a.treats.def.size>0){let o=document.createElement("div");o.innerHTML=g.east,o.innerHTML+=g.def,(e==="def"||e==="cite")&&
o.classList.add("hidden"),d.append(o),a.treats.def.forEach(p=>{let i=document.createElement("code");i.classList.add("tax\
on","uri"),i.innerText=p.replace("http://taxon-concept.plazi.org/id/",""),o.append(i)})}if(a.treats.aug.size>0||a.treats.
treattn.size>0){let o=document.createElement("div");o.innerHTML=g.east,o.innerHTML+=g.aug,(e==="aug"||e==="cite")&&o.classList.
add("hidden"),d.append(o),a.treats.aug.forEach(p=>{let i=document.createElement("code");i.classList.add("taxon","uri"),i.
innerText=p.replace("http://taxon-concept.plazi.org/id/",""),o.append(i)}),a.treats.treattn.forEach(p=>{let i=document.createElement(
"code");i.classList.add("taxon","uri"),i.innerText=p.replace("http://taxon-name.plazi.org/id/",""),o.append(i)})}if(a.treats.
dpr.size>0){let o=document.createElement("div");o.innerHTML=g.west,o.innerHTML+=g.dpr,(e==="dpr"||e==="cite")&&o.classList.
add("hidden"),d.append(o),a.treats.dpr.forEach(p=>{let i=document.createElement("code");i.classList.add("taxon","uri"),i.
innerText=p.replace("http://taxon-concept.plazi.org/id/",""),o.append(i)})}if(a.treats.citetc.size>0||a.treats.citetn.size>
0){let o=document.createElement("div");o.innerHTML=g.empty+g.cite,o.classList.add("hidden"),d.append(o),a.treats.citetc.
forEach(p=>{let i=document.createElement("code");i.classList.add("taxon","uri"),i.innerText=p.replace("http://taxon-conc\
ept.plazi.org/id/",""),o.append(i)}),a.treats.citetn.forEach(p=>{let i=document.createElement("code");i.classList.add("t\
axon","uri"),i.innerText=p.replace("http://taxon-name.plazi.org/id/",""),o.append(i)})}})}};customElements.define("syno-\
treatment",N);var O=class extends HTMLElement{constructor(t){super();let e=document.createElement("h2"),s=document.createElement(
"i");if(s.innerText=t.displayName,e.append(s),this.append(e),t.taxonNameURI){let n=document.createElement("code");n.classList.
add("taxon","uri"),n.innerText=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/",""),n.title=t.taxonNameURI,e.append(
n)}let c=document.createElement("abbr");c.classList.add("justification"),c.innerText="...?",v(t).then(n=>c.title=`This ${n}`),
e.append(c);let r=document.createElement("code");if(r.classList.add("vernacular"),t.vernacularNames.then(n=>{n.size>0&&(r.
innerText="\u201C"+[...n.values()].join("\u201D, \u201C")+"\u201D")}),this.append(r),t.treatments.treats.size>0||t.treatments.
cite.size>0){let n=document.createElement("ul");this.append(n);for(let d of t.treatments.treats){let a=new N(d,"aug");n.
append(a)}for(let d of t.treatments.cite){let a=new N(d,"cite");n.append(a)}}for(let n of t.authorizedNames){let d=document.
createElement("h3"),a=document.createElement("i");a.innerText=n.displayName,a.classList.add("gray"),d.append(a),d.append(
" ",n.authority),this.append(d);let o=document.createElement("ul");if(this.append(o),n.taxonConceptURI){let i=document.createElement(
"code");i.classList.add("taxon","uri"),i.innerText=n.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/",""),i.
title=n.taxonConceptURI,d.append(i)}if(n.colURI){let i=document.createElement("code");i.classList.add("col","uri");let l=n.
colURI.replace("https://www.catalogueoflife.org/data/taxon/","");i.innerText=l,i.id=l,i.title=n.colURI,d.append(i);let u=document.
createElement("div");u.classList.add("treatmentline"),u.innerHTML=n.acceptedColURI!==n.colURI?g.dpr:g.aug,o.append(u);let T=document.
createElement("span");T.innerText="Catalogue of Life",u.append(T);let I=document.createElement("div");if(I.classList.add(
"indent"),u.append(I),n.acceptedColURI!==n.colURI){let f=document.createElement("div");f.innerHTML=g.east+g.aug,I.append(
f);let h=document.createElement("a");h.classList.add("col","uri");let P=n.acceptedColURI.replace("https://www.catalogueo\
flife.org/data/taxon/","");h.innerText=P,h.href=`#${P}`,h.title=n.acceptedColURI,f.append(h)}}let p=[];for(let i of n.treatments.
def)p.push({trt:i,status:"def"});for(let i of n.treatments.aug)p.push({trt:i,status:"aug"});for(let i of n.treatments.dpr)
p.push({trt:i,status:"dpr"});for(let i of n.treatments.cite)p.push({trt:i,status:"cite"});D||p.sort((i,l)=>i.trt.date&&l.
trt.date?i.trt.date-l.trt.date:i.trt.date?1:l.trt.date?-1:0);for(let{trt:i,status:l}of p){let u=new N(i,l);o.append(u)}}}};
customElements.define("syno-name",O);async function v(m){if(m.justification.searchTerm)return m.justification.subTaxon?"\
is a sub-taxon of the search term.":"is the search term.";if(m.justification.treatment){let t=await m.justification.treatment.
details,e=await v(m.justification.parent);return`is, according to ${t.creators} ${m.justification.treatment.date},
     a synonym of ${m.justification.parent.displayName} which ${e}`}else{let t=await v(m.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${m.justification.parent.displayName} which ${t}`}}var C=document.createElement("div");A.insertAdjacentElement(
"beforebegin",C);C.append(`Finding Synonyms for ${y} `);C.append(document.createElement("progress"));var _=performance.now(),
B=new E(F),L=new w(B,y,x,R);for await(let m of L){let t=new O(m);A.append(t)}var k=performance.now();C.innerHTML="";C.innerText=
`Found ${L.names.length} names with ${L.treatments.size} treatments. This took ${(k-_)/1e3} seconds.`;L.names.length===0&&
A.append(":[");
//# sourceMappingURL=index.js.map
