async function F(T){return await new Promise(s=>{setTimeout(s,T)})}var A=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,s={},i=""){
s.headers=s.headers||{},s.headers.Accept="application/sparql-results+json";let d=0,c=async()=>{try{let p=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),s);if(!p.ok)throw new Error("Response not ok. Status "+p.status);return await p.
json()}catch(p){if(s.signal?.aborted)throw p;if(d<10){let l=50*(1<<d++);return console.warn(`!! Fetch Error. Retrying in\
 ${l}ms (${d})`),await F(l),await c()}throw console.warn("!! Fetch Error:",t,`
---
`,p),p}};return await c()}};var v=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,s,i=!0,d=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=i,this.startWithSubTaxa=d,s.startsWith("http"))this.getName(s,{searchTerm:!0,
subTaxon:!1}).catch(c=>{console.log("SynoGroup Failure: ",c),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let c=[...s.split(" ").filter(p=>!!p),void 0,void 0];this.getNameFromLatin(c,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}findName(t){let s;for(let i of this.names){if(i.taxonNameURI===t||i.colURI===t){s=i;break}let d=i.
authorizedNames.find(c=>c.taxonConceptURI===t||c.colURI===t);if(d){s=d;break}}return s?Promise.resolve(s):new Promise((i,d)=>{
this.monitor.addEventListener("updated",()=>{(this.names.length===0||this.isFinished)&&d();let c=this.names.at(-1);if(c.
taxonNameURI===t||c.colURI===t){i(c);return}let p=c.authorizedNames.find(l=>l.taxonConceptURI===t||l.colURI===t);if(p){i(
p);return}})})}async getName(t,s){if(this.expanded.has(t)){console.log("Skipping known",t);return}if(t.startsWith("https\
://www.catalogueoflife.org"))await this.getNameFromCol(t,s);else if(t.startsWith("http://taxon-concept.plazi.org"))await this.
getNameFromTC(t,s);else if(t.startsWith("http://taxon-name.plazi.org"))await this.getNameFromTN(t,s);else throw`Cannot h\
andle name-uri <${t}> !`;this.startWithSubTaxa&&s.searchTerm&&!s.subTaxon&&await this.getSubtaxa(t)}async getSubtaxa(t){
let s=t.startsWith("http://taxon-concept.plazi.org")?`
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
s,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(c=>c.sub?.value).filter(c=>c&&!this.expanded.has(
c));await Promise.allSettled(d.map(c=>this.getName(c,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,s,i],d){let c=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${s?`?uri dwc:species|dwc:specificEpithet "${s}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${i?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${i}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let l=(await this.sparqlEndpoint.getSparqlResultSet(
c,{signal:this.controller.signal},`NameFromLatin ${t} ${s} ${i}`)).results.bindings.map(a=>a.uri?.value).filter(a=>a&&!this.
expanded.has(a));await Promise.allSettled(l.map(a=>this.getName(a,d)))}async getNameFromCol(t,s){let i=`
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
i,{signal:this.controller.signal},`NameFromCol ${t}`);return this.handleName(d,s)}async getNameFromTC(t,s){let i=`
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
i,{signal:this.controller.signal},`NameFromTC ${t}`);await this.handleName(d,s)}async getNameFromTN(t,s){let i=`
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
i,{signal:this.controller.signal},`NameFromTN ${t}`);return this.handleName(d,s)}async handleName(t,s){let i=[],d=t.results.
bindings[0].name.value.replace(t.results.bindings[0].authority.value,"").trim(),c,p=[],l=[],a=t.results.bindings[0].tn?.
value;if(a){if(this.expanded.has(a))return;this.expanded.add(a)}for(let e of t.results.bindings){if(e.col){let r=e.col.value;
if(e.authority?.value){if(!p.find(g=>g.colURI===r)){if(this.expanded.has(r)){console.log("Skipping known",r);return}p.push(
{displayName:d,authority:e.authority.value,colURI:e.col.value,treatments:{def:new Set,aug:new Set,dpr:new Set,cite:new Set}})}}else{
if(this.expanded.has(r)){console.log("Skipping known",r);return}c&&c!==r&&console.log("Duplicate unathorized COL:",c,r),
c=r}}if(e.tc&&e.tcAuth&&e.tcAuth.value){let r=this.makeTreatmentSet(e.defs?.value.split("|")),g=this.makeTreatmentSet(e.
augs?.value.split("|")),N=this.makeTreatmentSet(e.dprs?.value.split("|")),C=this.makeTreatmentSet(e.cites?.value.split("\
|")),S=p.find(f=>e.tcAuth.value.split(" / ").includes(f.authority));if(S)S.authority=e.tcAuth?.value,S.taxonConceptURI=e.
tc.value,S.treatments={def:r,aug:g,dpr:N,cite:C};else{if(this.expanded.has(e.tc.value))return;l.push({displayName:d,authority:e.
tcAuth.value,taxonConceptURI:e.tc.value,treatments:{def:r,aug:g,dpr:N,cite:C}})}r.forEach(f=>i.push(f)),g.forEach(f=>i.push(
f)),N.forEach(f=>i.push(f))}}let h=this.makeTreatmentSet(t.results.bindings[0].tntreats?.value.split("|"));h.forEach(e=>i.
push(e));let o={displayName:d,rank:t.results.bindings[0].rank.value,taxonNameURI:a,authorizedNames:[...p,...l],colURI:c,
justification:s,treatments:{treats:h,cite:this.makeTreatmentSet(t.results.bindings[0].tncites?.value.split("|"))},vernacularNames:a?
this.getVernacular(a):Promise.resolve(new Map)};for(let e of o.authorizedNames)e.colURI&&this.expanded.add(e.colURI),e.taxonConceptURI&&
this.expanded.add(e.taxonConceptURI);let u=[];if(c){let[e,r]=await this.getAcceptedCol(c,o);o.acceptedColURI=e,u.push(...r)}
await Promise.all(p.map(async e=>{let[r,g]=await this.getAcceptedCol(e.colURI,o);e.acceptedColURI=r,u.push(...g)})),this.
pushName(o);let n=new Map;(await Promise.all(i.map(e=>e.details.then(r=>[e,r])))).map(([e,r])=>{r.treats.aug.difference(
this.expanded).forEach(g=>n.set(g,e)),r.treats.def.difference(this.expanded).forEach(g=>n.set(g,e)),r.treats.dpr.difference(
this.expanded).forEach(g=>n.set(g,e)),r.treats.treattn.difference(this.expanded).forEach(g=>n.set(g,e))}),await Promise.
allSettled([...u,...[...n].map(([e,r])=>this.getName(e,{searchTerm:!1,parent:o,treatment:r}))])}async getAcceptedCol(t,s){
let i=`
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
getSparqlResultSet(i,{signal:this.controller.signal},`AcceptedCol ${t}`),c=[];for(let p of d.results.bindings)for(let l of p.
dprs.value.split("|"))l&&(this.acceptedCol.has(p.current.value)||(this.acceptedCol.set(p.current.value,p.current.value),
c.push(this.getNameFromCol(p.current.value,{searchTerm:!1,parent:s}))),this.acceptedCol.set(l,p.current.value),this.ignoreDeprecatedCoL||
c.push(this.getNameFromCol(l,{searchTerm:!1,parent:s})));return d.results.bindings.length===0?(this.acceptedCol.has(t)||
this.acceptedCol.set(t,"INVALID COL"),[this.acceptedCol.get(t),c]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[
this.acceptedCol.get(t),c])}async getVernacular(t){let s=new Map,i=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.or\
g/dwc/terms/vernacularName> ?n . }`,d=(await this.sparqlEndpoint.getSparqlResultSet(i,{signal:this.controller.signal},`V\
ernacular ${t}`)).results.bindings;for(let c of d)c.n?.value&&(c.n["xml:lang"]?s.has(c.n["xml:lang"])?s.get(c.n["xml:lan\
g"]).push(c.n.value):s.set(c.n["xml:lang"],[c.n.value]):s.has("??")?s.get("??").push(c.n.value):s.set("??",[c.n.value]));
return s}makeTreatmentSet(t){return t?new Set(t.filter(s=>!!s).map(s=>{let[i,d]=s.split(">");if(!this.treatments.has(i)){
let c=this.getTreatmentDetails(i);this.treatments.set(i,{url:i,date:d?parseInt(d,10):void 0,details:c})}return this.treatments.
get(i)})):new Set}async getTreatmentDetails(t){let s=`
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let i=await this.sparqlEndpoint.getSparqlResultSet(
s,{signal:this.controller.signal},`TreatmentDetails ${t}`),d=i.results.bindings.filter(a=>a.mc&&a.catalogNumbers?.value).
map(a=>{let h=a.httpUris?.value?.split("|");return{catalogNumber:a.catalogNumbers.value,collectionCode:a.collectionCodes?.
value||void 0,typeStatus:a.typeStatuss?.value||void 0,countryCode:a.countryCodes?.value||void 0,stateProvince:a.stateProvinces?.
value||void 0,municipality:a.municipalitys?.value||void 0,county:a.countys?.value||void 0,locality:a.localitys?.value||void 0,
verbatimLocality:a.verbatimLocalitys?.value||void 0,recordedBy:a.recordedBys?.value||void 0,eventDate:a.eventDates?.value||
void 0,samplingProtocol:a.samplingProtocols?.value||void 0,decimalLatitude:a.decimalLatitudes?.value||void 0,decimalLongitude:a.
decimalLongitudes?.value||void 0,verbatimElevation:a.verbatimElevations?.value||void 0,gbifOccurrenceId:a.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:a.gbifSpecimenIds?.value||void 0,httpUri:h?.length?h:void 0}}),c=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,l=(await this.sparqlEndpoint.getSparqlResultSet(c,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(a=>a.url?.value).map(a=>({url:a.url.value,description:a.description?.value}));return{creators:i.
results.bindings[0]?.creators?.value,title:i.results.bindings[0]?.title?.value,materialCitations:d,figureCitations:l,treats:{
def:new Set(i.results.bindings[0]?.defs?.value?i.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(i.results.
bindings[0]?.augs?.value?i.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(i.results.bindings[0]?.dprs?.value?
i.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(i.results.bindings[0]?.cites?.value?i.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(i.results.bindings[0]?.trttns?.value?i.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(i.results.bindings[0]?.citetns?.value?i.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(i){
return console.warn("SPARQL Error: "+i),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((s,i)=>{let d=()=>{
if(this.controller.signal.aborted)i(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)s({value:this.
names[t++]});else if(this.isFinished)s({done:!0,value:!0});else{let c=()=>{this.monitor.removeEventListener("updated",c),
d()};this.monitor.addEventListener("updated",c)}};d()})}}};function R(T){let t=new Set(T);return Array.from(t)}var w=new URLSearchParams(document.location.search),_=!w.has("show_col"),k=w.has("subtaxa"),z=w.has("sort_treatments_by_\
type"),U=w.get("server")||"https://treatment.ld.plazi.org/sparql",D=w.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",x=document.getElementById("root");var m={def:'<svg class="green" viewBox="0 0 24 24"><path fill="currentcolor" d="M17,13H13V17H11V13H7V11H11V7H13V11H17M12\
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
 0 24 24"></svg>'},L=document.createElement("div");x.insertAdjacentElement("beforebegin",L);L.append(`Finding Synonyms f\
or ${D} `);var B=document.createElement("progress");L.append(B);var M=performance.now(),H=new A(U),I=new v(H,D,_,k),E=class extends HTMLElement{constructor(t,s){
super(),s==="full"?this.classList.add("expanded"):(this.innerHTML=m[s]??m.unknown,this.addEventListener("click",()=>{this.
classList.toggle("expanded")}));let i=document.createElement("span");t.date?i.innerText=""+t.date:(i.classList.add("miss\
ing"),i.innerText="No Date"),this.append(i);let d=document.createElement("progress");this.append(": ",d);let c=document.
createElement("a");c.classList.add("treatment","uri"),c.href=t.url,c.target="_blank",c.innerText=t.url.replace("http://t\
reatment.plazi.org/id/",""),c.innerHTML+=m.link,this.append(" ",c);let p=document.createElement("div");p.classList.add("\
indent","details"),this.append(p),t.details.then(l=>{let a=document.createElement("span"),h=document.createElement("i");
if(d.replaceWith(a," ",h),l.creators?a.innerText=l.creators:(a.classList.add("missing"),a.innerText="No Authors"),l.title?
h.innerText="\u201C"+l.title+"\u201D":(h.classList.add("missing"),h.innerText="No Title"),l.treats.def.size>0){let o=document.
createElement("div");o.innerHTML=m.east,o.innerHTML+=m.def,(s==="def"||s==="cite")&&o.classList.add("hidden"),p.append(o),
l.treats.def.forEach(u=>{let n=document.createElement("a");n.classList.add("taxon","uri");let e=u.replace("http://taxon-\
concept.plazi.org/id/","");n.innerText=e,n.href="#"+e,n.title="show name",o.append(" ",n),I.findName(u).then(r=>{n.classList.
remove("uri"),r.authority?n.innerText=r.displayName+" "+r.authority:n.innerText=r.displayName},()=>{n.removeAttribute("h\
ref")})})}if(l.treats.aug.size>0||l.treats.treattn.size>0){let o=document.createElement("div");o.innerHTML=m.east,o.innerHTML+=
m.aug,(s==="aug"||s==="cite")&&o.classList.add("hidden"),p.append(o),l.treats.aug.forEach(u=>{let n=document.createElement(
"a");n.classList.add("taxon","uri");let e=u.replace("http://taxon-concept.plazi.org/id/","");n.innerText=e,n.href="#"+e,
n.title="show name",o.append(" ",n),I.findName(u).then(r=>{n.classList.remove("uri"),r.authority?n.innerText=r.displayName+
" "+r.authority:n.innerText=r.displayName},()=>{n.removeAttribute("href")})}),l.treats.treattn.forEach(u=>{let n=document.
createElement("a");n.classList.add("taxon","uri");let e=u.replace("http://taxon-name.plazi.org/id/","");n.innerText=e,n.
href="#"+e,n.title="show name",o.append(" ",n),I.findName(u).then(r=>{n.classList.remove("uri"),r.authority?n.innerText=
r.displayName+" "+r.authority:n.innerText=r.displayName},()=>{n.removeAttribute("href")})})}if(l.treats.dpr.size>0){let o=document.
createElement("div");o.innerHTML=m.west,o.innerHTML+=m.dpr,(s==="dpr"||s==="cite")&&o.classList.add("hidden"),p.append(o),
l.treats.dpr.forEach(u=>{let n=document.createElement("a");n.classList.add("taxon","uri");let e=u.replace("http://taxon-\
concept.plazi.org/id/","");n.innerText=e,n.href="#"+e,n.title="show name",o.append(" ",n),I.findName(u).then(r=>{n.classList.
remove("uri"),r.authority?n.innerText=r.displayName+" "+r.authority:n.innerText=r.displayName},()=>{n.removeAttribute("h\
ref")})})}if(l.treats.citetc.size>0||l.treats.citetn.size>0){let o=document.createElement("div");o.innerHTML=m.empty+m.cite,
o.classList.add("hidden"),p.append(o),l.treats.citetc.forEach(u=>{let n=document.createElement("a");n.classList.add("tax\
on","uri");let e=u.replace("http://taxon-concept.plazi.org/id/","");n.innerText=e,n.href="#"+e,n.title="show name",o.append(
" ",n),I.findName(u).then(r=>{n.classList.remove("uri"),r.authority?n.innerText=r.displayName+" "+r.authority:n.innerText=
r.displayName},()=>{n.removeAttribute("href")})}),l.treats.citetn.forEach(u=>{let n=document.createElement("a");n.classList.
add("taxon","uri");let e=u.replace("http://taxon-name.plazi.org/id/","");n.innerText=e,n.href="#"+e,n.title="show name",
o.append(" ",n),I.findName(u).then(r=>{n.classList.remove("uri"),r.authority?n.innerText=r.displayName+" "+r.authority:n.
innerText=r.displayName},()=>{n.removeAttribute("href")})})}if(l.materialCitations.length>0){let o=document.createElement(
"div");o.innerHTML=m.empty+m.cite+" Material Citations:<br>",o.classList.add("hidden"),p.append(o),o.innerText+=l.materialCitations.
map(u=>JSON.stringify(u)).join(`
`)}if(l.figureCitations.length>0){let o=document.createElement("div");o.innerHTML=m.empty+m.cite+" Figures:<br>",o.classList.
add("hidden"),p.append(o),o.innerText+=l.figureCitations.map(u=>JSON.stringify(u)).join(`
`)}})}};customElements.define("syno-treatment",E);var y=class extends HTMLElement{constructor(t){super();let s=document.
createElement("h2"),i=document.createElement("i");i.innerText=t.displayName,s.append(i),this.append(s);let d=document.createElement(
"span");if(d.classList.add("rank"),d.innerText=t.rank,s.append(" ",d),t.taxonNameURI){let a=document.createElement("a");
a.classList.add("taxon","uri");let h=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");a.innerText=h,a.id=h,a.
href=t.taxonNameURI,a.target="_blank",a.innerHTML+=m.link,s.append(" ",a)}let c=document.createElement("div");c.classList.
add("vernacular"),t.vernacularNames.then(a=>{a.size>0&&(c.innerText="\u201C"+R([...a.values()].flat()).join("\u201D, \u201C")+
"\u201D")}),this.append(c);let p=document.createElement("ul");if(this.append(p),t.colURI){let a=document.createElement("\
a");a.classList.add("col","uri");let h=t.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");a.innerText=h,
a.id=h,a.href=t.colURI,a.target="_blank",a.innerHTML+=m.link,s.append(" ",a);let o=document.createElement("div");o.classList.
add("treatmentline"),o.innerHTML=t.acceptedColURI!==t.colURI?m.dpr:m.aug,p.append(o);let u=document.createElement("span");
u.innerText="Catalogue of Life",o.append(u);let n=document.createElement("div");if(n.classList.add("indent"),o.append(n),
t.acceptedColURI!==t.colURI){let e=document.createElement("div");e.innerHTML=m.east+m.aug,n.append(e);let r=document.createElement(
"a");r.classList.add("col","uri");let g=t.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");r.innerText=
g,r.href=`#${g}`,r.title="show name",e.append(r),I.findName(t.acceptedColURI).then(N=>{N.authority?r.innerText=N.displayName+
" "+N.authority:r.innerText=N.displayName},()=>{r.removeAttribute("href")})}}if(t.treatments.treats.size>0||t.treatments.
cite.size>0){for(let a of t.treatments.treats){let h=new E(a,"aug");p.append(h)}for(let a of t.treatments.cite){let h=new E(
a,"cite");p.append(h)}}let l=document.createElement("abbr");l.classList.add("justification"),l.innerText="...?",P(t).then(
a=>l.title=`This ${a}`),s.append(" ",l);for(let a of t.authorizedNames){let h=document.createElement("h3"),o=document.createElement(
"i");o.innerText=a.displayName,o.classList.add("gray"),h.append(o),h.append(" ",a.authority),this.append(h);let u=document.
createElement("ul");if(this.append(u),a.taxonConceptURI){let e=document.createElement("a");e.classList.add("taxon","uri");
let r=a.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/","");e.innerText=r,e.id=r,e.href=a.taxonConceptURI,e.
target="_blank",e.innerHTML+=m.link,h.append(" ",e)}if(a.colURI){let e=document.createElement("a");e.classList.add("col",
"uri");let r=a.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");e.innerText=r,e.id=r,e.href=a.colURI,e.target=
"_blank",e.innerHTML+=m.link,h.append(" ",e);let g=document.createElement("div");g.classList.add("treatmentline"),g.innerHTML=
a.acceptedColURI!==a.colURI?m.dpr:m.aug,u.append(g);let N=document.createElement("span");N.innerText="Catalogue of Life",
g.append(N);let C=document.createElement("div");if(C.classList.add("indent"),g.append(C),a.acceptedColURI!==a.colURI){let S=document.
createElement("div");S.innerHTML=m.east+m.aug,C.append(S);let f=document.createElement("a");f.classList.add("col","uri");
let b=a.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");f.innerText=b,f.href=`#${b}`,f.title="s\
how name",S.append(" ",f),I.findName(a.acceptedColURI).then(O=>{f.classList.remove("uri"),O.authority?f.innerText=O.displayName+
" "+O.authority:f.innerText=O.displayName},()=>{f.removeAttribute("href")})}}let n=[];for(let e of a.treatments.def)n.push(
{trt:e,status:"def"});for(let e of a.treatments.aug)n.push({trt:e,status:"aug"});for(let e of a.treatments.dpr)n.push({trt:e,
status:"dpr"});for(let e of a.treatments.cite)n.push({trt:e,status:"cite"});z||n.sort((e,r)=>e.trt.date&&r.trt.date?e.trt.
date-r.trt.date:e.trt.date?1:r.trt.date?-1:0);for(let{trt:e,status:r}of n){let g=new E(e,r);u.append(g)}}}};customElements.
define("syno-name",y);async function P(T){if(T.justification.searchTerm)return T.justification.subTaxon?"is a sub-taxon \
of the search term.":"is the search term.";if(T.justification.treatment){let t=await T.justification.treatment.details,s=await P(
T.justification.parent);return`is, according to ${t.creators} ${T.justification.treatment.date},
     a synonym of ${T.justification.parent.displayName} which ${s}`}else{let t=await P(T.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${T.justification.parent.displayName} which ${t}`}}for await(let T of I){let t=new y(T);x.append(t)}var q=performance.
now();L.innerHTML="";L.innerText=`Found ${I.names.length} names with ${I.treatments.size} treatments. This took ${(q-M)/
1e3} seconds.`;I.names.length===0&&x.append(":[");
//# sourceMappingURL=index.js.map
