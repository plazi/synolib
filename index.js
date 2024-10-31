async function D(T){return await new Promise(n=>{setTimeout(n,T)})}var L=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,n={},r=""){
n.headers=n.headers||{},n.headers.Accept="application/sparql-results+json";let d=0,s=async()=>{try{let l=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),n);if(!l.ok)throw new Error("Response not ok. Status "+l.status);return await l.
json()}catch(l){if(n.signal?.aborted)throw l;if(d<10){let p=50*(1<<d++);return console.warn(`!! Fetch Error. Retrying in\
 ${p}ms (${d})`),await D(p),await s()}throw console.warn("!! Fetch Error:",t,`
---
`,l),l}};return await s()}};var O=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,n,r=!0,d=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=r,this.startWithSubTaxa=d,n.startsWith("http"))this.getName(n,{searchTerm:!0,
subTaxon:!1}).catch(s=>{console.log("SynoGroup Failure: ",s),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let s=[...n.split(" ").filter(l=>!!l),void 0,void 0];this.getNameFromLatin(s,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}async getName(t,n){if(this.expanded.has(t)){console.log("Skipping known",t);return}if(t.startsWith(
"https://www.catalogueoflife.org"))await this.getNameFromCol(t,n);else if(t.startsWith("http://taxon-concept.plazi.org"))
await this.getNameFromTC(t,n);else if(t.startsWith("http://taxon-name.plazi.org"))await this.getNameFromTN(t,n);else throw`\
Cannot handle name-uri <${t}> !`;this.startWithSubTaxa&&n.searchTerm&&!n.subTaxon&&await this.getSubtaxa(t)}async getSubtaxa(t){
let n=t.startsWith("http://taxon-concept.plazi.org")?`
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
LIMIT 5000`;if(this.controller.signal?.aborted)return Promise.reject();let d=(await this.sparqlEndpoint.getSparqlResultSet(
n,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(s=>s.sub?.value).filter(s=>s&&!this.expanded.has(
s));await Promise.allSettled(d.map(s=>this.getName(s,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,n,r],d){let s=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${n?`?uri dwc:species|dwc:specificEpithet "${n}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${r?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${r}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let p=(await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`NameFromLatin ${t} ${n} ${r}`)).results.bindings.map(a=>a.uri?.value).filter(a=>a&&!this.
expanded.has(a));await Promise.allSettled(p.map(a=>this.getName(a,d)))}async getNameFromCol(t,n){let r=`
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let d=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromCol ${t}`);return this.handleName(d,n)}async getNameFromTC(t,n){let r=`
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let d=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromTC ${t}`);await this.handleName(d,n)}async getNameFromTN(t,n){let r=`
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
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let d=await this.sparqlEndpoint.getSparqlResultSet(
r,{signal:this.controller.signal},`NameFromTN ${t}`);return this.handleName(d,n)}async handleName(t,n){let r=[],d=t.results.
bindings[0].name.value.replace(t.results.bindings[0].authority.value,"").trim(),s,l=[],p=[],a=t.results.bindings[0].tn?.
value;if(a){if(this.expanded.has(a))return;this.expanded.add(a)}for(let e of t.results.bindings){if(e.col){let c=e.col.value;
if(e.authority?.value){if(!l.find(m=>m.colURI===c)){if(this.expanded.has(c)){console.log("Skipping known",c);return}l.push(
{displayName:d,authority:e.authority.value,colURI:e.col.value,treatments:{def:new Set,aug:new Set,dpr:new Set,cite:new Set}})}}else{
if(this.expanded.has(c)){console.log("Skipping known",c);return}s&&s!==c&&console.log("Duplicate unathorized COL:",s,c),
s=c}}if(e.tc&&e.tcAuth&&e.tcAuth.value){let c=this.makeTreatmentSet(e.defs?.value.split("|")),m=this.makeTreatmentSet(e.
augs?.value.split("|")),N=this.makeTreatmentSet(e.dprs?.value.split("|")),S=this.makeTreatmentSet(e.cites?.value.split("\
|")),I=l.find(f=>e.tcAuth.value.split(" / ").includes(f.authority));if(I)I.authority=e.tcAuth?.value,I.taxonConceptURI=e.
tc.value,I.treatments={def:c,aug:m,dpr:N,cite:S};else{if(this.expanded.has(e.tc.value))return;p.push({displayName:d,authority:e.
tcAuth.value,taxonConceptURI:e.tc.value,treatments:{def:c,aug:m,dpr:N,cite:S}})}c.forEach(f=>r.push(f)),m.forEach(f=>r.push(
f)),N.forEach(f=>r.push(f))}}let u=this.makeTreatmentSet(t.results.bindings[0].tntreats?.value.split("|"));u.forEach(e=>r.
push(e));let o={displayName:d,rank:t.results.bindings[0].rank.value,taxonNameURI:a,authorizedNames:[...l,...p],colURI:s,
justification:n,treatments:{treats:u,cite:this.makeTreatmentSet(t.results.bindings[0].tncites?.value.split("|"))},vernacularNames:a?
this.getVernacular(a):Promise.resolve(new Map)};for(let e of o.authorizedNames)e.colURI&&this.expanded.add(e.colURI),e.taxonConceptURI&&
this.expanded.add(e.taxonConceptURI);let h=[];if(s){let[e,c]=await this.getAcceptedCol(s,o);o.acceptedColURI=e,h.push(...c)}
await Promise.all(l.map(async e=>{let[c,m]=await this.getAcceptedCol(e.colURI,o);e.acceptedColURI=c,h.push(...m)})),this.
pushName(o);let i=new Map;(await Promise.all(r.map(e=>e.details.then(c=>[e,c])))).map(([e,c])=>{c.treats.aug.difference(
this.expanded).forEach(m=>i.set(m,e)),c.treats.def.difference(this.expanded).forEach(m=>i.set(m,e)),c.treats.dpr.difference(
this.expanded).forEach(m=>i.set(m,e)),c.treats.treattn.difference(this.expanded).forEach(m=>i.set(m,e))}),await Promise.
allSettled([...h,...[...i].map(([e,c])=>this.getName(e,{searchTerm:!1,parent:o,treatment:c}))])}async getAcceptedCol(t,n){
let r=`
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[this.acceptedCol.get(t),[]];let d=await this.sparqlEndpoint.
getSparqlResultSet(r,{signal:this.controller.signal},`AcceptedCol ${t}`),s=[];for(let l of d.results.bindings)for(let p of l.
dprs.value.split("|"))p&&(this.acceptedCol.has(l.current.value)||(this.acceptedCol.set(l.current.value,l.current.value),
s.push(this.getNameFromCol(l.current.value,{searchTerm:!1,parent:n}))),this.acceptedCol.set(p,l.current.value),this.ignoreDeprecatedCoL||
s.push(this.getNameFromCol(p,{searchTerm:!1,parent:n})));return d.results.bindings.length===0?(this.acceptedCol.has(t)||
this.acceptedCol.set(t,"INVALID COL"),[this.acceptedCol.get(t),s]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[
this.acceptedCol.get(t),s])}async getVernacular(t){let n=new Map,r=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.or\
g/dwc/terms/vernacularName> ?n . }`,d=(await this.sparqlEndpoint.getSparqlResultSet(r,{signal:this.controller.signal},`V\
ernacular ${t}`)).results.bindings;for(let s of d)s.n?.value&&(s.n["xml:lang"]?n.has(s.n["xml:lang"])?n.get(s.n["xml:lan\
g"]).push(s.n.value):n.set(s.n["xml:lang"],[s.n.value]):n.has("??")?n.get("??").push(s.n.value):n.set("??",[s.n.value]));
return n}makeTreatmentSet(t){return t?new Set(t.filter(n=>!!n).map(n=>{let[r,d]=n.split(">");if(!this.treatments.has(r)){
let s=this.getTreatmentDetails(r);this.treatments.set(r,{url:r,date:d?parseInt(d,10):void 0,details:s})}return this.treatments.
get(r)})):new Set}async getTreatmentDetails(t){let n=`
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let r=await this.sparqlEndpoint.getSparqlResultSet(
n,{signal:this.controller.signal},`TreatmentDetails ${t}`),d=r.results.bindings.filter(a=>a.mc&&a.catalogNumbers?.value).
map(a=>{let u=a.httpUris?.value?.split("|");return{catalogNumber:a.catalogNumbers.value,collectionCode:a.collectionCodes?.
value||void 0,typeStatus:a.typeStatuss?.value||void 0,countryCode:a.countryCodes?.value||void 0,stateProvince:a.stateProvinces?.
value||void 0,municipality:a.municipalitys?.value||void 0,county:a.countys?.value||void 0,locality:a.localitys?.value||void 0,
verbatimLocality:a.verbatimLocalitys?.value||void 0,recordedBy:a.recordedBys?.value||void 0,eventDate:a.eventDates?.value||
void 0,samplingProtocol:a.samplingProtocols?.value||void 0,decimalLatitude:a.decimalLatitudes?.value||void 0,decimalLongitude:a.
decimalLongitudes?.value||void 0,verbatimElevation:a.verbatimElevations?.value||void 0,gbifOccurrenceId:a.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:a.gbifSpecimenIds?.value||void 0,httpUri:u?.length?u:void 0}}),s=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,p=(await this.sparqlEndpoint.getSparqlResultSet(s,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(a=>a.url?.value).map(a=>({url:a.url.value,description:a.description?.value}));return{creators:r.
results.bindings[0]?.creators?.value,title:r.results.bindings[0]?.title?.value,materialCitations:d,figureCitations:p,treats:{
def:new Set(r.results.bindings[0]?.defs?.value?r.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(r.results.
bindings[0]?.augs?.value?r.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(r.results.bindings[0]?.dprs?.value?
r.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(r.results.bindings[0]?.cites?.value?r.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(r.results.bindings[0]?.trttns?.value?r.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(r.results.bindings[0]?.citetns?.value?r.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(r){
return console.warn("SPARQL Error: "+r),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((n,r)=>{let d=()=>{
if(this.controller.signal.aborted)r(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)n({value:this.
names[t++]});else if(this.isFinished)n({done:!0,value:!0});else{let s=()=>{this.monitor.removeEventListener("updated",s),
d()};this.monitor.addEventListener("updated",s)}};d()})}}};function x(T){let t=new Set(T);return Array.from(t)}var E=new URLSearchParams(document.location.search),F=!E.has("show_col"),_=E.has("subtaxa"),k=E.has("sort_treatments_by_\
type"),B=E.get("server")||"https://treatment.ld.plazi.org/sparql",R=E.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",y=document.getElementById("root");var g={def:'<svg class="green" viewBox="0 0 24 24"><path fill="currentcolor" d="M17,13H13V17H11V13H7V11H11V7H13V11H17M12\
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
 0 24 24"></svg>'},C=class extends HTMLElement{constructor(t,n){super(),n==="full"?this.classList.add("expanded"):(this.
innerHTML=g[n]??g.unknown,this.addEventListener("click",()=>{this.classList.toggle("expanded")}));let r=document.createElement(
"span");t.date?r.innerText=""+t.date:(r.classList.add("missing"),r.innerText="No Date"),this.append(r);let d=document.createElement(
"progress");this.append(": ",d);let s=document.createElement("a");s.classList.add("treatment","uri"),s.href=t.url,s.target=
"_blank",s.innerText=t.url.replace("http://treatment.plazi.org/id/",""),s.innerHTML+=g.link,this.append(" ",s);let l=document.
createElement("div");l.classList.add("indent","details"),this.append(l),t.details.then(p=>{let a=document.createElement(
"span"),u=document.createElement("i");if(d.replaceWith(a," ",u),p.creators?a.innerText=p.creators:(a.classList.add("miss\
ing"),a.innerText="No Authors"),p.title?u.innerText="\u201C"+p.title+"\u201D":(u.classList.add("missing"),u.innerText="N\
o Title"),p.treats.def.size>0){let o=document.createElement("div");o.innerHTML=g.east,o.innerHTML+=g.def,(n==="def"||n===
"cite")&&o.classList.add("hidden"),l.append(o),p.treats.def.forEach(h=>{let i=document.createElement("a");i.classList.add(
"taxon","uri");let e=h.replace("http://taxon-concept.plazi.org/id/","");i.innerText=e,i.href="#"+e,i.title="show name",o.
append(i)})}if(p.treats.aug.size>0||p.treats.treattn.size>0){let o=document.createElement("div");o.innerHTML=g.east,o.innerHTML+=
g.aug,(n==="aug"||n==="cite")&&o.classList.add("hidden"),l.append(o),p.treats.aug.forEach(h=>{let i=document.createElement(
"a");i.classList.add("taxon","uri");let e=h.replace("http://taxon-concept.plazi.org/id/","");i.innerText=e,i.href="#"+e,
i.title="show name",o.append(i)}),p.treats.treattn.forEach(h=>{let i=document.createElement("a");i.classList.add("taxon",
"uri");let e=h.replace("http://taxon-name.plazi.org/id/","");i.innerText=e,i.href="#"+e,i.title="show name",o.append(i)})}
if(p.treats.dpr.size>0){let o=document.createElement("div");o.innerHTML=g.west,o.innerHTML+=g.dpr,(n==="dpr"||n==="cite")&&
o.classList.add("hidden"),l.append(o),p.treats.dpr.forEach(h=>{let i=document.createElement("a");i.classList.add("taxon",
"uri");let e=h.replace("http://taxon-concept.plazi.org/id/","");i.innerText=e,i.href="#"+e,i.title="show name",o.append(
i)})}if(p.treats.citetc.size>0||p.treats.citetn.size>0){let o=document.createElement("div");o.innerHTML=g.empty+g.cite,o.
classList.add("hidden"),l.append(o),p.treats.citetc.forEach(h=>{let i=document.createElement("a");i.classList.add("taxon",
"uri");let e=h.replace("http://taxon-concept.plazi.org/id/","");i.innerText=e,i.href="#"+e,i.title="show name",o.append(
i)}),p.treats.citetn.forEach(h=>{let i=document.createElement("a");i.classList.add("taxon","uri");let e=h.replace("http:\
//taxon-name.plazi.org/id/","");i.innerText=e,i.href="#"+e,i.title="show name",o.append(i)})}})}};customElements.define(
"syno-treatment",C);var v=class extends HTMLElement{constructor(t){super();let n=document.createElement("h2"),r=document.
createElement("i");r.innerText=t.displayName,n.append(r),this.append(n);let d=document.createElement("span");if(d.classList.
add("rank"),d.innerText=t.rank,n.append(" ",d),t.taxonNameURI){let a=document.createElement("a");a.classList.add("taxon",
"uri");let u=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");a.innerText=u,a.id=u,a.href=t.taxonNameURI,a.target=
"_blank",a.innerHTML+=g.link,n.append(" ",a)}let s=document.createElement("div");s.classList.add("vernacular"),t.vernacularNames.
then(a=>{a.size>0&&(s.innerText="\u201C"+x([...a.values()].flat()).join("\u201D, \u201C")+"\u201D")}),this.append(s);let l=document.
createElement("ul");if(this.append(l),t.colURI){let a=document.createElement("a");a.classList.add("col","uri");let u=t.colURI.
replace("https://www.catalogueoflife.org/data/taxon/","");a.innerText=u,a.id=u,a.href=t.colURI,a.target="_blank",a.innerHTML+=
g.link,n.append(" ",a);let o=document.createElement("div");o.classList.add("treatmentline"),o.innerHTML=t.acceptedColURI!==
t.colURI?g.dpr:g.aug,l.append(o);let h=document.createElement("span");h.innerText="Catalogue of Life",o.append(h);let i=document.
createElement("div");if(i.classList.add("indent"),o.append(i),t.acceptedColURI!==t.colURI){let e=document.createElement(
"div");e.innerHTML=g.east+g.aug,i.append(e);let c=document.createElement("a");c.classList.add("col","uri");let m=t.acceptedColURI.
replace("https://www.catalogueoflife.org/data/taxon/","");c.innerText=m,c.href=`#${m}`,c.title="show name",e.append(c)}}
if(t.treatments.treats.size>0||t.treatments.cite.size>0){for(let a of t.treatments.treats){let u=new C(a,"aug");l.append(
u)}for(let a of t.treatments.cite){let u=new C(a,"cite");l.append(u)}}let p=document.createElement("abbr");p.classList.add(
"justification"),p.innerText="...?",P(t).then(a=>p.title=`This ${a}`),n.append(" ",p);for(let a of t.authorizedNames){let u=document.
createElement("h3"),o=document.createElement("i");o.innerText=a.displayName,o.classList.add("gray"),u.append(o),u.append(
" ",a.authority),this.append(u);let h=document.createElement("ul");if(this.append(h),a.taxonConceptURI){let e=document.createElement(
"a");e.classList.add("taxon","uri");let c=a.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/","");e.innerText=
c,e.id=c,e.href=a.taxonConceptURI,e.target="_blank",e.innerHTML+=g.link,u.append(" ",e)}if(a.colURI){let e=document.createElement(
"a");e.classList.add("col","uri");let c=a.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");e.innerText=c,
e.id=c,e.href=a.colURI,e.target="_blank",e.innerHTML+=g.link,u.append(" ",e);let m=document.createElement("div");m.classList.
add("treatmentline"),m.innerHTML=a.acceptedColURI!==a.colURI?g.dpr:g.aug,h.append(m);let N=document.createElement("span");
N.innerText="Catalogue of Life",m.append(N);let S=document.createElement("div");if(S.classList.add("indent"),m.append(S),
a.acceptedColURI!==a.colURI){let I=document.createElement("div");I.innerHTML=g.east+g.aug,S.append(I);let f=document.createElement(
"a");f.classList.add("col","uri");let b=a.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");f.innerText=
b,f.href=`#${b}`,f.title="show name",I.append(f)}}let i=[];for(let e of a.treatments.def)i.push({trt:e,status:"def"});for(let e of a.
treatments.aug)i.push({trt:e,status:"aug"});for(let e of a.treatments.dpr)i.push({trt:e,status:"dpr"});for(let e of a.treatments.
cite)i.push({trt:e,status:"cite"});k||i.sort((e,c)=>e.trt.date&&c.trt.date?e.trt.date-c.trt.date:e.trt.date?1:c.trt.date?
-1:0);for(let{trt:e,status:c}of i){let m=new C(e,c);h.append(m)}}}};customElements.define("syno-name",v);async function P(T){
if(T.justification.searchTerm)return T.justification.subTaxon?"is a sub-taxon of the search term.":"is the search term.";
if(T.justification.treatment){let t=await T.justification.treatment.details,n=await P(T.justification.parent);return`is,\
 according to ${t.creators} ${T.justification.treatment.date},
     a synonym of ${T.justification.parent.displayName} which ${n}`}else{let t=await P(T.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${T.justification.parent.displayName} which ${t}`}}var w=document.createElement("div");y.insertAdjacentElement(
"beforebegin",w);w.append(`Finding Synonyms for ${R} `);var U=document.createElement("progress");w.append(U);var M=performance.
now(),z=new L(B),A=new O(z,R,F,_);for await(let T of A){let t=new v(T);y.append(t)}var q=performance.now();w.innerHTML="";
w.innerText=`Found ${A.names.length} names with ${A.treatments.size} treatments. This took ${(q-M)/1e3} seconds.`;A.names.
length===0&&y.append(":[");
//# sourceMappingURL=index.js.map
