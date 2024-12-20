async function M(f){return await new Promise(a=>{setTimeout(a,f)})}var b=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,a={},n=""){
a.headers=a.headers||{},a.headers.Accept="application/sparql-results+json";let d=0,i=async()=>{try{let u=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),a);if(!u.ok)throw new Error("Response not ok. Status "+u.status);return await u.
json()}catch(u){if(a.signal?.aborted)throw u;if(d<10){let p=50*(1<<d++);return console.info(`!! Fetch Error. Retrying in\
 ${p}ms (${d})`),await M(p),await i()}throw console.warn("!! Fetch Error:",t,`
---
`,u),u}};return await i()}};var P=`PREFIX dc: <http://purl.org/dc/elements/1.1/>
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
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)`,R="GROUP BY ?kingdom ?tn ?tc ?col ?rank ?genus ?subgenus ?\
species ?infrasp ?name ?authority",F=f=>`${P} WHERE {
BIND(<${f}> as ?col)
  ?col dwc:taxonRank ?rank .
  ?col dwc:scientificName ?name .
  ?col dwc:genericName ?genus .
  OPTIONAL { ?col (dwc:parent|dwc:acceptedName)* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?colkingdom . }
  OPTIONAL { ?col dwc:infragenericEpithet ?colsubgenus . }
  OPTIONAL {
    ?col dwc:specificEpithet ?colspecies .
    OPTIONAL { ?col dwc:infraspecificEpithet ?colinfrasp . }
  }
  OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }

  BIND(COALESCE(?colkingdom, "") AS ?kingdom)
  BIND(COALESCE(?colsubgenus, "") AS ?subgenus)
  BIND(COALESCE(?colspecies, "") AS ?species)
  BIND(COALESCE(?colinfrasp, "") AS ?infrasp)

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
${R}
LIMIT 500`,_=f=>`${P} WHERE {
  <${f}> trt:hasTaxonName ?tn .
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
${R}
LIMIT 500`,B=f=>`${P} WHERE {
  BIND(<${f}> as ?tn)
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
${R}
LIMIT 500`;function D(f,t){let a=f.split(/\s*[,]\s*/),n=t.split(/\s*[,]\s*/),d=a.length>0&&/\d{4}/.test(a.at(-1))?a.pop():null,i=n.
length>0&&/\d{4}/.test(n.at(-1))?n.pop():null,u=a.length>0&&/\s*et\.?\s*al\.?/.test(a.at(-1)),p=n.length>0&&/\s*et\.?\s*al\.?/.
test(n.at(-1));if(u&&(a[a.length-1]=a[a.length-1].replace(/\s*et\.?\s*al\.?/,"")),p&&(n[n.length-1]=n[n.length-1].replace(
/\s*et\.?\s*al\.?/,"")),!u&&!p&&a.length!=n.length)return null;let s=[],o=0;for(;o<a.length&&o<n.length;o++){let g=$(a[o],
n[o]);if(g!==null)s.push(g);else return null}for(let g=o;g<a.length;g++)a[g]&&s.push(a[g]);for(let g=o;g<n.length;g++)n[g]&&
s.push(n[g]);if(d&&i)if(d===i)s.push(d);else return null;else d?s.push(d):i&&s.push(i);return s.join(", ")}function $(f,t){
let a=f.replaceAll("-"," "),n=t.replaceAll("-"," ");if(a.endsWith(".")||n.endsWith(".")){let d=a.normalize("NFKC"),i=n.normalize(
"NFKC"),u=d.lastIndexOf("."),p=i.lastIndexOf("."),s=u!==-1?p!==-1?Math.min(u,p):u:p;a=d.substring(0,s),n=i.substring(0,s)}
if(Q(a,n)){let d=f.normalize("NFD"),i=t.normalize("NFD");return d.length>=i.length?f:t}return null}function Q(f,t){return f.
localeCompare(t,"en",{sensitivity:"base",usage:"search"})===0}var y=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;names=[];pushName(t){this.
names.push(t),this.monitor.dispatchEvent(new CustomEvent("updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(
new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,a,n=!0,d=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=n,this.startWithSubTaxa=d,a.startsWith("http"))this.getName(a,{searchTerm:!0,
subTaxon:!1}).catch(i=>{console.log("SynoGroup Failure: ",i),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let i=[...a.split(" ").filter(u=>!!u),void 0,void 0];this.getNameFromLatin(i,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}findName(t){let a;for(let n of this.names){if(n.taxonNameURI===t||n.colURI===t){a=n;break}let d=n.
authorizedNames.find(i=>i.colURI===t||i.taxonConceptURIs.includes(t));if(d){a=d;break}}return a?Promise.resolve(a):new Promise(
(n,d)=>{this.monitor.addEventListener("updated",()=>{(this.names.length===0||this.isFinished)&&d();let i=this.names.at(-1);
if(i.taxonNameURI===t||i.colURI===t){n(i);return}let u=i.authorizedNames.find(p=>p.colURI===t||p.taxonConceptURIs.includes(
t));if(u){n(u);return}})})}async getName(t,a){if(this.expanded.has(t)){console.log("Skipping known",t);return}if(this.controller.
signal?.aborted)return Promise.reject();let n;if(t.startsWith("https://www.catalogueoflife.org"))n=await this.sparqlEndpoint.
getSparqlResultSet(F(t),{signal:this.controller.signal},`NameFromCol ${t}`);else if(t.startsWith("http://taxon-concept.p\
lazi.org"))n=await this.sparqlEndpoint.getSparqlResultSet(_(t),{signal:this.controller.signal},`NameFromTC ${t}`);else if(t.
startsWith("http://taxon-name.plazi.org"))n=await this.sparqlEndpoint.getSparqlResultSet(B(t),{signal:this.controller.signal},
`NameFromTN ${t}`);else throw`Cannot handle name-uri <${t}> !`;await this.handleName(n,a),this.startWithSubTaxa&&a.searchTerm&&
!a.subTaxon&&await this.getSubtaxa(t)}async getSubtaxa(t){let a=t.startsWith("http://taxon-concept.plazi.org")?`
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
a,{signal:this.controller.signal},`Subtaxa ${t}`)).results.bindings.map(i=>i.sub?.value).filter(i=>i&&!this.expanded.has(
i));await Promise.allSettled(d.map(i=>this.getName(i,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,a,n],d){let i=`\

    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${a?`?uri dwc:species|dwc:specificEpithet "${a}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${n?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${n}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let p=(await this.sparqlEndpoint.getSparqlResultSet(
i,{signal:this.controller.signal},`NameFromLatin ${t} ${a} ${n}`)).results.bindings.map(s=>s.uri?.value).filter(s=>s&&!this.
expanded.has(s));await Promise.allSettled(p.map(s=>this.getName(s,d)))}async handleName(t,a){let n=[],d=e=>{switch(e){case"\
variety":return"var.";case"subspecies":return"subsp.";case"form":return"f.";default:return e}},i=(t.results.bindings[0].
name?t.results.bindings[0].authority?t.results.bindings[0].name.value.replace(t.results.bindings[0].authority.value,""):
t.results.bindings[0].name.value:t.results.bindings[0].genus.value+(t.results.bindings[0].subgenus?.value?` (${t.results.
bindings[0].subgenus.value})`:"")+(t.results.bindings[0].species?.value?` ${t.results.bindings[0].species.value}`:"")+(t.
results.bindings[0].infrasp?.value?` ${d(t.results.bindings[0].rank.value)} ${t.results.bindings[0].infrasp.value}`:"")).
trim(),u,p=[],s=t.results.bindings[0].tn?.value;if(s){if(this.expanded.has(s))return;this.expanded.add(s)}let o=new Set;
for(let e of t.results.bindings){if(e.col){let m=e.col.value;if(e.authority?.value){if(!p.find(N=>N.colURI===m)){if(this.
expanded.has(m)){console.log("Skipping known",m);return}o.has(m)||(o.add(m),p.push({displayName:i,authority:e.authority.
value,authorities:[e.authority.value],colURI:e.col.value,taxonConceptURIs:[],treatments:{def:new Set,aug:new Set,dpr:new Set,
cite:new Set}}))}}else{if(this.expanded.has(m)){console.log("Skipping known",m);return}u&&u!==m&&console.log("Duplicate \
unathorized COL:",u,m),u=m}}if(e.tc&&e.tcAuth&&e.tcAuth.value){if(this.expanded.has(e.tc.value)){console.log("Skipping k\
nown",e.tc.value);return}else if(!o.has(e.tc.value)){o.add(e.tc.value);let m=this.makeTreatmentSet(e.defs?.value.split("\
|")),N=this.makeTreatmentSet(e.augs?.value.split("|")),w=this.makeTreatmentSet(e.dprs?.value.split("|")),C=this.makeTreatmentSet(
e.cites?.value.split("|"));m.forEach(v=>n.push(v)),N.forEach(v=>n.push(v)),w.forEach(v=>n.push(v));let I=p.find(v=>D(v.authority,
e.tcAuth.value)!==null);if(I){let v=e.tcAuth.value;I.authority=D(I.authority,v),I.authorities.push(...e.tcAuth.value.split(
" / ")),I.taxonConceptURIs.push(e.tc.value),I.treatments={def:I.treatments.def.union(m),aug:I.treatments.aug.union(N),dpr:I.
treatments.dpr.union(w),cite:I.treatments.cite.union(C)}}else p.push({displayName:i,authority:e.tcAuth.value,authorities:e.
tcAuth.value.split(" / "),taxonConceptURIs:[e.tc.value],treatments:{def:m,aug:N,dpr:w,cite:C}})}}}let g=this.makeTreatmentSet(
t.results.bindings[0].tntreats?.value.split("|"));g.forEach(e=>n.push(e));let l={kingdom:t.results.bindings[0].kingdom.value,
displayName:i,rank:t.results.bindings[0].rank.value,taxonNameURI:s,authorizedNames:p,colURI:u,justification:a,treatments:{
treats:g,cite:this.makeTreatmentSet(t.results.bindings[0].tncites?.value.split("|"))},vernacularNames:s?this.getVernacular(
s):Promise.resolve(new Map)};for(let e of l.authorizedNames){e.colURI&&this.expanded.add(e.colURI);for(let m of e.taxonConceptURIs)
this.expanded.add(m)}let h=[],r=p.filter(e=>e.colURI).map(e=>(e.acceptedColURI=this.getAcceptedCol(e.colURI,l).then(([m,
N])=>(h.push(...N),m)),e.acceptedColURI));u&&(l.acceptedColURI=this.getAcceptedCol(u,l).then(([e,m])=>(h.push(...m),e)),
r.push(l.acceptedColURI)),this.pushName(l);let c=new Map;(await Promise.all(n.map(e=>e.details.then(m=>[e,m])))).map(([e,
m])=>{m.treats.aug.difference(this.expanded).forEach(N=>c.set(N,e)),m.treats.def.difference(this.expanded).forEach(N=>c.
set(N,e)),m.treats.dpr.difference(this.expanded).forEach(N=>c.set(N,e)),m.treats.treattn.difference(this.expanded).forEach(
N=>c.set(N,e))}),await Promise.allSettled([...r,...[...c].map(([e,m])=>this.getName(e,{searchTerm:!1,parent:l,treatment:m}))]),
await Promise.allSettled(h)}async getAcceptedCol(t,a){let n=`
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[this.acceptedCol.get(t),[]];let d=await this.sparqlEndpoint.
getSparqlResultSet(n,{signal:this.controller.signal},`AcceptedCol ${t}`),i=[];for(let u of d.results.bindings)for(let p of u.
dprs.value.split("|"))p&&(this.acceptedCol.has(u.current.value)||(this.acceptedCol.set(u.current.value,u.current.value),
i.push(this.getName(u.current.value,{searchTerm:!1,parent:a}))),this.acceptedCol.set(p,u.current.value),this.ignoreDeprecatedCoL||
i.push(this.getName(p,{searchTerm:!1,parent:a})));return d.results.bindings.length===0?(this.acceptedCol.has(t)||this.acceptedCol.
set(t,"INVALID COL"),[this.acceptedCol.get(t),i]):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),[this.acceptedCol.
get(t),i])}async getVernacular(t){let a=new Map,n=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.org/dwc/terms/verna\
cularName> ?n . }`,d=(await this.sparqlEndpoint.getSparqlResultSet(n,{signal:this.controller.signal},`Vernacular ${t}`)).
results.bindings;for(let i of d)i.n?.value&&(i.n["xml:lang"]?a.has(i.n["xml:lang"])?a.get(i.n["xml:lang"]).push(i.n.value):
a.set(i.n["xml:lang"],[i.n.value]):a.has("??")?a.get("??").push(i.n.value):a.set("??",[i.n.value]));return a}makeTreatmentSet(t){
return t?new Set(t.filter(a=>!!a).map(a=>{let[n,d]=a.split(">");if(!this.treatments.has(n)){let i=this.getTreatmentDetails(
n);this.treatments.set(n,{url:n,date:d?parseInt(d,10):void 0,details:i})}return this.treatments.get(n)})):new Set}async getTreatmentDetails(t){
let a=`
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let n=await this.sparqlEndpoint.getSparqlResultSet(
a,{signal:this.controller.signal},`TreatmentDetails ${t}`),d=n.results.bindings.filter(s=>s.mc&&s.catalogNumbers?.value).
map(s=>{let o=s.httpUris?.value?.split("|");return{catalogNumber:s.catalogNumbers.value,collectionCode:s.collectionCodes?.
value||void 0,typeStatus:s.typeStatuss?.value||void 0,countryCode:s.countryCodes?.value||void 0,stateProvince:s.stateProvinces?.
value||void 0,municipality:s.municipalitys?.value||void 0,county:s.countys?.value||void 0,locality:s.localitys?.value||void 0,
verbatimLocality:s.verbatimLocalitys?.value||void 0,recordedBy:s.recordedBys?.value||void 0,eventDate:s.eventDates?.value||
void 0,samplingProtocol:s.samplingProtocols?.value||void 0,decimalLatitude:s.decimalLatitudes?.value||void 0,decimalLongitude:s.
decimalLongitudes?.value||void 0,verbatimElevation:s.verbatimElevations?.value||void 0,gbifOccurrenceId:s.gbifOccurrenceIds?.
value||void 0,gbifSpecimenId:s.gbifSpecimenIds?.value||void 0,httpUri:o?.length?o:void 0}}),i=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,p=(await this.sparqlEndpoint.getSparqlResultSet(i,{signal:this.controller.signal},`TreatmentDetails/Figures ${t}`)).
results.bindings.filter(s=>s.url?.value).map(s=>({url:s.url.value,description:s.description?.value}));return{creators:n.
results.bindings[0]?.creators?.value,title:n.results.bindings[0]?.title?.value,materialCitations:d,figureCitations:p,treats:{
def:new Set(n.results.bindings[0]?.defs?.value?n.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(n.results.
bindings[0]?.augs?.value?n.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(n.results.bindings[0]?.dprs?.value?
n.results.bindings[0].dprs.value.split("|"):void 0),citetc:new Set(n.results.bindings[0]?.cites?.value?n.results.bindings[0].
cites.value.split("|"):void 0),treattn:new Set(n.results.bindings[0]?.trttns?.value?n.results.bindings[0].trttns.value.split(
"|"):void 0),citetn:new Set(n.results.bindings[0]?.citetns?.value?n.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(n){
return console.warn("SPARQL Error: "+n),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,
citetc:new Set,treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((a,n)=>{let d=()=>{
if(this.controller.signal.aborted)n(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)a({value:this.
names[t++]});else if(this.isFinished)a({done:!0,value:!0});else{let i=()=>{this.monitor.removeEventListener("updated",i),
d()};this.monitor.addEventListener("updated",i)}};d()})}}};function z(f){let t=new Set(f);return Array.from(t)}var L=new URLSearchParams(document.location.search),Z=!L.has("show_col"),W=L.has("subtaxa"),X=L.has("sort_treatments_by_\
type"),J=L.get("server")||"https://treatment.ld.plazi.org/sparql",U=L.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",k=document.getElementById("root");var T={def:'<svg class="green" viewBox="0 -960 960 960"><path fill="currentcolor" d="M444-288h72v-156h156v-72H516v-156h-\
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
177-51 51Z"/></svg>',empty:'<svg viewBox="0 -960 960 960"></svg>'},A=document.createElement("div");k.insertAdjacentElement(
"beforebegin",A);A.append(`Finding Synonyms for ${U} `);var j=document.createElement("progress");A.append(j);var G=performance.
now(),Y=new b(J),S=new y(Y,U,Z,W),E=class extends HTMLElement{constructor(t,a){super(),this.innerHTML=T[a]??T.unknown;let n=document.
createElement("button");n.classList.add("icon","button"),n.innerHTML=T.expand,n.addEventListener("click",()=>{this.classList.
toggle("expanded")?n.innerHTML=T.collapse:n.innerHTML=T.expand});let d=document.createElement("span");t.date?d.innerText=
""+t.date:(d.classList.add("missing"),d.innerText="No Date"),this.append(d);let i=document.createElement("progress");this.
append(": ",i);let u=document.createElement("a");u.classList.add("treatment","uri"),u.href=t.url,u.target="_blank",u.innerText=
t.url.replace("http://treatment.plazi.org/id/",""),u.innerHTML+=T.link,this.append(" ",u),this.append(n);let p=document.
createElement("div");p.classList.add("indent","details"),this.append(p),t.details.then(s=>{let o=document.createElement(
"span"),g=document.createElement("i");if(i.replaceWith(o," ",g),s.creators?o.innerText=s.creators:(o.classList.add("miss\
ing"),o.innerText="No Authors"),s.title?g.innerText="\u201C"+s.title+"\u201D":(g.classList.add("missing"),g.innerText="N\
o Title"),s.treats.def.size>0){let l=document.createElement("div");l.innerHTML=T.east,l.innerHTML+=T.def,(a==="def"||a===
"cite")&&l.classList.add("hidden"),p.append(l),s.treats.def.forEach(h=>{let r=document.createElement("a");r.classList.add(
"taxon","uri");let c=h.replace("http://taxon-concept.plazi.org/id/","");r.innerText=c,r.href="#"+c,r.title="show name",l.
append(" ",r),S.findName(h).then(e=>{r.classList.remove("uri"),e.authority?r.innerText=e.displayName+" "+e.authority:r.innerText=
e.displayName},()=>{r.removeAttribute("href")})})}if(s.treats.aug.size>0||s.treats.treattn.size>0){let l=document.createElement(
"div");l.innerHTML=T.east,l.innerHTML+=T.aug,(a==="aug"||a==="cite")&&l.classList.add("hidden"),p.append(l),s.treats.aug.
forEach(h=>{let r=document.createElement("a");r.classList.add("taxon","uri");let c=h.replace("http://taxon-concept.plazi\
.org/id/","");r.innerText=c,r.href="#"+c,r.title="show name",l.append(" ",r),S.findName(h).then(e=>{r.classList.remove("\
uri"),e.authority?r.innerText=e.displayName+" "+e.authority:r.innerText=e.displayName},()=>{r.removeAttribute("href")})}),
s.treats.treattn.forEach(h=>{let r=document.createElement("a");r.classList.add("taxon","uri");let c=h.replace("http://ta\
xon-name.plazi.org/id/","");r.innerText=c,r.href="#"+c,r.title="show name",l.append(" ",r),S.findName(h).then(e=>{r.classList.
remove("uri"),e.authority?r.innerText=e.displayName+" "+e.authority:r.innerText=e.displayName},()=>{r.removeAttribute("h\
ref")})})}if(s.treats.dpr.size>0){let l=document.createElement("div");l.innerHTML=T.west,l.innerHTML+=T.dpr,(a==="dpr"||
a==="cite")&&l.classList.add("hidden"),p.append(l),s.treats.dpr.forEach(h=>{let r=document.createElement("a");r.classList.
add("taxon","uri");let c=h.replace("http://taxon-concept.plazi.org/id/","");r.innerText=c,r.href="#"+c,r.title="show nam\
e",l.append(" ",r),S.findName(h).then(e=>{r.classList.remove("uri"),e.authority?r.innerText=e.displayName+" "+e.authority:
r.innerText=e.displayName},()=>{r.removeAttribute("href")})})}if(s.treats.citetc.size>0||s.treats.citetn.size>0){let l=document.
createElement("div");l.innerHTML=T.empty+T.cite,l.classList.add("hidden"),p.append(l),s.treats.citetc.forEach(h=>{let r=document.
createElement("a");r.classList.add("taxon","uri");let c=h.replace("http://taxon-concept.plazi.org/id/","");r.innerText=c,
r.href="#"+c,r.title="show name",l.append(" ",r),S.findName(h).then(e=>{r.classList.remove("uri"),e.authority?r.innerText=
e.displayName+" "+e.authority:r.innerText=e.displayName},()=>{r.removeAttribute("href")})}),s.treats.citetn.forEach(h=>{
let r=document.createElement("a");r.classList.add("taxon","uri");let c=h.replace("http://taxon-name.plazi.org/id/","");r.
innerText=c,r.href="#"+c,r.title="show name",l.append(" ",r),S.findName(h).then(e=>{r.classList.remove("uri"),e.authority?
r.innerText=e.displayName+" "+e.authority:r.innerText=e.displayName},()=>{r.removeAttribute("href")})})}if(s.figureCitations.
length>0){let l=document.createElement("div");l.classList.add("figures","hidden"),p.append(l);for(let h of s.figureCitations){
let r=document.createElement("figure");l.append(r);let c=document.createElement("img");c.src=h.url,c.loading="lazy",c.alt=
h.description??"Cited Figure without caption",r.append(c);let e=document.createElement("figcaption");e.innerText=h.description??
"",r.append(e)}}if(s.materialCitations.length>0){let l=document.createElement("div");l.innerHTML=T.empty+T.cite+" Materi\
al Citations:<br> -",l.classList.add("hidden"),p.append(l),l.innerText+=s.materialCitations.map(h=>JSON.stringify(h).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",E);var x=class extends HTMLElement{constructor(t){super();let a=document.
createElement("h2"),n=document.createElement("i");n.innerText=t.displayName,a.append(n),this.append(a);let d=document.createElement(
"span");d.classList.add("rank"),d.innerText=t.rank;let i=document.createElement("span");if(i.classList.add("rank"),i.innerText=
t.kingdom||"Missing Kingdom",a.append(" ",i," ",d),t.taxonNameURI){let o=document.createElement("a");o.classList.add("ta\
xon","uri");let g=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");o.innerText=g,o.id=g,o.href=t.taxonNameURI,
o.target="_blank",o.innerHTML+=T.link,a.append(" ",o)}let u=document.createElement("div");u.classList.add("vernacular"),
t.vernacularNames.then(o=>{o.size>0&&(u.innerText="\u201C"+z([...o.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(u);let p=document.createElement("ul");if(this.append(p),t.colURI){let o=document.createElement("a");o.classList.
add("col","uri");let g=t.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");o.innerText=g,o.id=g,o.href=t.
colURI,o.target="_blank",o.innerHTML+=T.link,a.append(" ",o);let l=document.createElement("div");l.classList.add("treatm\
entline"),l.innerHTML=t.acceptedColURI!==t.colURI?T.col_dpr:T.col_aug,p.append(l);let h=document.createElement("span");h.
innerText="Catalogue of Life",l.append(h);let r=document.createElement("div");if(r.classList.add("indent"),l.append(r),t.
acceptedColURI!==t.colURI){let c=document.createElement("div");c.innerHTML=T.east+T.col_aug,r.append(c);let e=document.createElement(
"a");e.classList.add("col","uri");let m=t.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");e.innerText=
m,e.href=`#${m}`,e.title="show name",c.append(e),S.findName(t.acceptedColURI).then(N=>{N.authority?e.innerText=N.displayName+
" "+N.authority:e.innerText=N.displayName},()=>{e.removeAttribute("href")})}}if(t.treatments.treats.size>0||t.treatments.
cite.size>0){for(let o of t.treatments.treats){let g=new E(o,"aug");p.append(g)}for(let o of t.treatments.cite){let g=new E(
o,"cite");p.append(g)}}let s=document.createElement("abbr");s.classList.add("justification"),s.innerText="...?",q(t).then(
o=>s.title=`This ${o}`),a.append(" ",s);for(let o of t.authorizedNames){let g=document.createElement("h3"),l=document.createElement(
"i");l.innerText=o.displayName,l.classList.add("gray"),g.append(l),g.append(" ",o.authority),this.append(g);let h=document.
createElement("ul");if(this.append(h),o.taxonConceptURI){let c=document.createElement("a");c.classList.add("taxon","uri");
let e=o.taxonConceptURI.replace("http://taxon-concept.plazi.org/id/","");c.innerText=e,c.id=e,c.href=o.taxonConceptURI,c.
target="_blank",c.innerHTML+=T.link,g.append(" ",c)}if(o.colURI){let c=document.createElement("a");c.classList.add("col",
"uri");let e=o.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");c.innerText=e,c.id=e,c.href=o.colURI,c.target=
"_blank",c.innerHTML+=T.link,g.append(" ",c);let m=document.createElement("div");m.classList.add("treatmentline"),m.innerHTML=
o.acceptedColURI!==o.colURI?T.col_dpr:T.col_aug,h.append(m);let N=document.createElement("span");N.innerText="Catalogue \
of Life",m.append(N);let w=document.createElement("div");if(w.classList.add("indent"),m.append(w),o.acceptedColURI!==o.colURI){
let C=document.createElement("div");C.innerHTML=T.east+T.col_aug,w.append(C);let I=document.createElement("a");I.classList.
add("col","uri");let v=o.acceptedColURI.replace("https://www.catalogueoflife.org/data/taxon/","");I.innerText=v,I.href=`\
#${v}`,I.title="show name",C.append(" ",I),S.findName(o.acceptedColURI).then(O=>{I.classList.remove("uri"),O.authority?I.
innerText=O.displayName+" "+O.authority:I.innerText=O.displayName},()=>{I.removeAttribute("href")})}}let r=[];for(let c of o.
treatments.def)r.push({trt:c,status:"def"});for(let c of o.treatments.aug)r.push({trt:c,status:"aug"});for(let c of o.treatments.
dpr)r.push({trt:c,status:"dpr"});for(let c of o.treatments.cite)r.push({trt:c,status:"cite"});X||r.sort((c,e)=>c.trt.date&&
e.trt.date?c.trt.date-e.trt.date:c.trt.date?1:e.trt.date?-1:0);for(let{trt:c,status:e}of r){let m=new E(c,e);h.append(m)}}}};
customElements.define("syno-name",x);async function q(f){if(f.justification.searchTerm)return f.justification.subTaxon?"\
is a sub-taxon of the search term.":"is the search term.";if(f.justification.treatment){let t=await f.justification.treatment.
details,a=await q(f.justification.parent);return`is, according to ${t.creators} ${f.justification.treatment.date},
     a synonym of ${f.justification.parent.displayName} which ${a}`}else{let t=await q(f.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${f.justification.parent.displayName} which ${t}`}}for await(let f of S){let t=new x(f);k.append(t)}var V=performance.
now();A.innerHTML="";A.innerText=`Found ${S.names.length} names with ${S.treatments.size} treatments. This took ${(V-G)/
1e3} seconds.`;S.names.length===0&&k.append(":[");
//# sourceMappingURL=index.js.map
