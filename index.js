async function M(h){return await new Promise(n=>{setTimeout(n,h)})}var A=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,n={},a=""){
n.headers=n.headers||{},n.headers.Accept="application/sparql-results+json";let d=0,c=async()=>{try{let u=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),n);if(!u.ok)throw new Error("Response not ok. Status "+u.status);return await u.
json()}catch(u){if(n.signal?.aborted)throw u;if(d<10){let p=50*(1<<d++);return console.info(`!! Fetch Error. Retrying in\
 ${p}ms (${d})`),await M(p),n.cache="no-cache",await c()}throw console.warn("!! Fetch Error:",t,`
---
`,u),u}};return await c()}};var x=`PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?kingdom ?tn ?tc ?col ?acceptedcol ?rank ?genus ?section ?subgenus ?species ?infrasp ?name ?authority
  (group_concat(DISTINCT ?tcauth;separator=" / ") AS ?tcAuth)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)`,P="GROUP BY ?kingdom ?tn ?tc ?col ?acceptedcol ?rank ?genu\
s ?section ?subgenus ?species ?infrasp ?name ?authority",_=h=>`${x} WHERE {
BIND(<${h}> as ?col)
  ?col dwc:taxonRank ?rank .
  ?col dwc:scientificName ?name .
  ?col dwc:genericName ?genus .
  {
    ?col dwc:acceptedName ?acceptedcol .
  } UNION {
    ?col dwc:taxonomicStatus ?col_status . # TODO: unused
    FILTER NOT EXISTS { ?col dwc:acceptedName ?_ . }
    BIND(?col AS ?acceptedcol)
  }
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
    ?tn dwc:genus ?genus .
    { ?tn dwc:kingdom ?kingdom . } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }

    OPTIONAL { ?tn dwc:subGenus ?tnsubgenus . }
    FILTER(?subgenus = COALESCE(?tnsubgenus, COALESCE(?section, "")))
    OPTIONAL { ?tn dwc:section ?section . }
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
LIMIT 500`,F=h=>`${x} WHERE {
  <${h}> trt:hasTaxonName ?tn .
  ?tc trt:hasTaxonName ?tn ;
      dwc:scientificNameAuthorship ?tcauth ;
      a dwcFP:TaxonConcept .

  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?tnrank .
  { ?tn dwc:kingdom ?kingdom . } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
  ?tn dwc:genus ?genus .
  OPTIONAL { ?tn dwc:subGenus ?tnsubgenus . }
  OPTIONAL { ?tn dwc:section ?section . }
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
    {
      ?col dwc:acceptedName ?acceptedcol .
    } UNION {
      ?col dwc:taxonomicStatus ?col_status . # TODO: unused
      FILTER NOT EXISTS { ?col dwc:acceptedName ?_ . }
      BIND(?col AS ?acceptedcol)
    }
    OPTIONAL { ?col (dwc:parent|dwc:acceptedName)* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?colkingdom . }
    FILTER(?kingdom = COALESCE(?colkingdom, ""))

    OPTIONAL { ?col dwc:infragenericEpithet ?colsubgenus . }
    FILTER(COALESCE(?tnsubgenus, COALESCE(?section, "")) = COALESCE(?colsubgenus, ""))
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
LIMIT 500`,B=h=>`${x} WHERE {
  BIND(<${h}> as ?tn)
  ?tn a dwcFP:TaxonName .
  ?tn dwc:rank ?tnrank .
  ?tn dwc:genus ?genus .
  { ?tn dwc:kingdom ?kingdom . } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
  OPTIONAL { ?tn dwc:subGenus ?tnsubgenus . }
  OPTIONAL { ?tn dwc:section ?section . }
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
    {
      ?col dwc:acceptedName ?acceptedcol .
    } UNION {
      ?col dwc:taxonomicStatus ?col_status . # TODO: unused
      FILTER NOT EXISTS { ?col dwc:acceptedName ?_ . }
      BIND(?col AS ?acceptedcol)
    }
    OPTIONAL { ?col (dwc:parent|dwc:acceptedName)* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?colkingdom . }
    FILTER(?kingdom = COALESCE(?colkingdom, ""))

    OPTIONAL { ?col dwc:infragenericEpithet ?colsubgenus . }
    FILTER(COALESCE(?tnsubgenus, COALESCE(?section, "")) = COALESCE(?colsubgenus, ""))
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
LIMIT 500`;function R(h,t){let n=h.split(/\s*[,]\s*/),a=t.split(/\s*[,]\s*/),d=n.length>0&&/\d{4}/.test(n.at(-1))?n.pop():null,c=a.
length>0&&/\d{4}/.test(a.at(-1))?a.pop():null,u=n.length>0&&/\s*et\.?\s*al\.?/.test(n.at(-1)),p=a.length>0&&/\s*et\.?\s*al\.?/.
test(a.at(-1));if(u&&(n[n.length-1]=n[n.length-1].replace(/\s*et\.?\s*al\.?/,"")),p&&(a[a.length-1]=a[a.length-1].replace(
/\s*et\.?\s*al\.?/,"")),!u&&!p&&n.length!=a.length)return null;let i=[],o=0;for(;o<n.length&&o<a.length;o++){let m=H(n[o],
a[o]);if(m!==null)i.push(m);else return null}for(let m=o;m<n.length;m++)n[m]&&i.push(n[m]);for(let m=o;m<a.length;m++)a[m]&&
i.push(a[m]);if(d&&c)if(d===c)i.push(d);else return null;else d?i.push(d):c&&i.push(c);return i.join(", ")}function H(h,t){
let n=h.replaceAll("-"," "),a=t.replaceAll("-"," ");if(n.endsWith(".")||a.endsWith(".")){let d=n.normalize("NFKC"),c=a.normalize(
"NFKC"),u=d.lastIndexOf("."),p=c.lastIndexOf("."),i=u!==-1?p!==-1?Math.min(u,p):u:p;n=d.substring(0,i),a=c.substring(0,i)}
if(Q(n,a)){let d=h.normalize("NFD"),c=t.normalize("NFD");return d.length>=c.length?h:t}return null}function Q(h,t){return h.
localeCompare(t,"en",{sensitivity:"base",usage:"search"})===0}var b=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;fetchOptions={signal:this.
controller.signal,cache:"force-cache"};names=[];pushName(t){this.names.push(t),this.monitor.dispatchEvent(new CustomEvent(
"updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;constructor(t,n,a=!0,d=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=a,this.startWithSubTaxa=d,n.startsWith("http"))this.getName(n,{searchTerm:!0,
subTaxon:!1}).catch(c=>{console.log("SynoGroup Failure: ",c),this.controller.abort("SynoGroup Failed")}).finally(()=>this.
finish());else{let c=[...n.split(" ").filter(u=>!!u),void 0,void 0];this.getNameFromLatin(c,{searchTerm:!0,subTaxon:!1}).
finally(()=>this.finish())}}findName(t){let n;for(let a of this.names){if(a.taxonNameURI===t||a.col?.colURI===t){n=a;break}
let d=a.authorizedNames.find(c=>c.col?.colURI===t||c.taxonConceptURIs.includes(t));if(d){n=d;break}}return n?Promise.resolve(
n):new Promise((a,d)=>{this.monitor.addEventListener("updated",()=>{(this.names.length===0||this.isFinished)&&d();let c=this.
names.at(-1);if(c.taxonNameURI===t||c.col?.colURI===t){a(c);return}let u=c.authorizedNames.find(p=>p.col?.colURI===t||p.
taxonConceptURIs.includes(t));if(u){a(u);return}})})}async getName(t,n){if(this.expanded.has(t)){console.log("Skipping k\
nown",t);return}if(this.controller.signal?.aborted)return Promise.reject();let a;if(t.startsWith("https://www.catalogueo\
flife.org"))a=await this.sparqlEndpoint.getSparqlResultSet(_(t),this.fetchOptions,`NameFromCol ${t}`);else if(t.startsWith(
"http://taxon-concept.plazi.org"))a=await this.sparqlEndpoint.getSparqlResultSet(F(t),this.fetchOptions,`NameFromTC ${t}`);else if(t.
startsWith("http://taxon-name.plazi.org"))a=await this.sparqlEndpoint.getSparqlResultSet(B(t),this.fetchOptions,`NameFro\
mTN ${t}`);else throw`Cannot handle name-uri <${t}> !`;await this.handleName(a,n),this.startWithSubTaxa&&n.searchTerm&&!n.
subTaxon&&await this.getSubtaxa(t)}async getSubtaxa(t){let n=t.startsWith("http://taxon-concept.plazi.org")?`
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
n,this.fetchOptions,`Subtaxa ${t}`)).results.bindings.map(c=>c.sub?.value).filter(c=>c&&!this.expanded.has(c));await Promise.
allSettled(d.map(c=>this.getName(c,{searchTerm:!0,subTaxon:!0})))}async getNameFromLatin([t,n,a],d){let c=`
    PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?uri WHERE {
  ?uri dwc:genus|dwc:genericName "${t}" .
  ${n?`?uri dwc:species|dwc:specificEpithet "${n}" .`:"FILTER NOT EXISTS { ?uri dwc:species|dwc:specificEpithet ?species\
 . }"}
  ${a?`?uri dwc:subSpecies|dwc:variety|dwc:form|dwc:infraspecificEpithet "${a}" .`:"FILTER NOT EXISTS { ?uri dwc:subSpec\
ies|dwc:variety|dwc:form|dwc:infraspecificEpithet ?infrasp . }"}
}
LIMIT 500`;if(this.controller.signal?.aborted)return Promise.reject();let p=(await this.sparqlEndpoint.getSparqlResultSet(
c,this.fetchOptions,`NameFromLatin ${t} ${n} ${a}`)).results.bindings.map(i=>i.uri?.value).filter(i=>i&&!this.expanded.has(
i));await Promise.allSettled(p.map(i=>this.getName(i,d)))}async handleName(t,n){let a=[],d=e=>{switch(e){case"variety":return"\
var.";case"subspecies":return"subsp.";case"form":return"f.";default:return e}},c=(t.results.bindings[0].name?t.results.bindings[0].
authority?t.results.bindings[0].name.value.replace(t.results.bindings[0].authority.value,""):t.results.bindings[0].name.
value:t.results.bindings[0].genus.value+(t.results.bindings[0].section?.value?` sect. ${t.results.bindings[0].section.value}`:
"")+(t.results.bindings[0].subgenus?.value?` (${t.results.bindings[0].subgenus.value})`:"")+(t.results.bindings[0].species?.
value?` ${t.results.bindings[0].species.value}`:"")+(t.results.bindings[0].infrasp?.value?` ${d(t.results.bindings[0].rank.
value)} ${t.results.bindings[0].infrasp.value}`:"")).trim(),u,p=[],i=t.results.bindings[0].tn?.value;if(i){if(this.expanded.
has(i))return;this.expanded.add(i)}let o=new Set;for(let e of t.results.bindings){if(e.col){let s=e.col.value;if(e.authority?.
value){if(!p.find(r=>r.col?.colURI===s)){if(this.expanded.has(s)){console.log("Skipping known",s);return}o.has(s)||(o.add(
s),p.push({displayName:c,authority:e.authority.value,authorities:[e.authority.value],col:{colURI:e.col.value,acceptedURI:e.
acceptedcol?.value??"INAVLID COL"},taxonConceptURIs:[],treatments:{def:new Set,aug:new Set,dpr:new Set,cite:new Set}}))}}else{
if(this.expanded.has(s)){console.log("Skipping known",s);return}u&&u.colURI!==s&&console.log("Duplicate unathorized COL:",
u,s),u={colURI:s,acceptedURI:e.acceptedcol?.value??"INVALID COL"}}}if(e.tc&&e.tcAuth&&e.tcAuth.value){if(this.expanded.has(
e.tc.value)){console.log("Skipping known",e.tc.value);return}else if(!o.has(e.tc.value)){o.add(e.tc.value);let s=this.makeTreatmentSet(
e.defs?.value.split("|")),r=this.makeTreatmentSet(e.augs?.value.split("|")),T=this.makeTreatmentSet(e.dprs?.value.split(
"|")),v=this.makeTreatmentSet(e.cites?.value.split("|"));s.forEach(I=>a.push(I)),r.forEach(I=>a.push(I)),T.forEach(I=>a.
push(I));let N=p.find(I=>R(I.authority,e.tcAuth.value)!==null);if(N){let I=e.tcAuth.value;N.authority=R(N.authority,I),N.
authorities.push(...e.tcAuth.value.split(" / ")),N.taxonConceptURIs.push(e.tc.value),N.treatments={def:N.treatments.def.
union(s),aug:N.treatments.aug.union(r),dpr:N.treatments.dpr.union(T),cite:N.treatments.cite.union(v)}}else p.push({displayName:c,
authority:e.tcAuth.value,authorities:e.tcAuth.value.split(" / "),taxonConceptURIs:[e.tc.value],treatments:{def:s,aug:r,dpr:T,
cite:v}})}}}let m=this.makeTreatmentSet(t.results.bindings[0].tntreats?.value.split("|"));m.forEach(e=>a.push(e));let l={
kingdom:t.results.bindings[0].kingdom.value,displayName:c,rank:t.results.bindings[0].rank.value,taxonNameURI:i,authorizedNames:p,
col:u,justification:n,treatments:{treats:m,cite:this.makeTreatmentSet(t.results.bindings[0].tncites?.value.split("|"))},
vernacularNames:i?this.getVernacular(i):Promise.resolve(new Map)};for(let e of l.authorizedNames){e.col&&this.expanded.add(
e.col.colURI);for(let s of e.taxonConceptURIs)this.expanded.add(s)}this.pushName(l);let g=new Map;(await Promise.all(a.map(
e=>e.details.then(s=>[e,s])))).map(([e,s])=>{s.treats.aug.difference(this.expanded).forEach(r=>g.set(r,e)),s.treats.def.
difference(this.expanded).forEach(r=>g.set(r,e)),s.treats.dpr.difference(this.expanded).forEach(r=>g.set(r,e)),s.treats.
treattn.difference(this.expanded).forEach(r=>g.set(r,e))}),u&&await this.findColSynonyms(u.colURI,l),await Promise.allSettled(
[...p.filter(e=>e.col).map(e=>this.findColSynonyms(e.col.colURI,l)),...[...g].map(([e,s])=>this.getName(e,{searchTerm:!1,
parent:l,treatment:s}))])}async findColSynonyms(t,n){let a=`
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
GROUP BY ?current ?current_status`;if(this.acceptedCol.has(t))return[];let d=await this.sparqlEndpoint.getSparqlResultSet(
a,this.fetchOptions,`AcceptedCol ${t}`),c=[];for(let u of d.results.bindings)for(let p of u.dprs.value.split("|"))p&&(this.
acceptedCol.has(u.current.value)||(this.acceptedCol.set(u.current.value,u.current.value),c.push(this.getName(u.current.value,
{searchTerm:!1,parent:n}))),this.acceptedCol.set(p,u.current.value),this.ignoreDeprecatedCoL||c.push(this.getName(p,{searchTerm:!1,
parent:n})));return d.results.bindings.length===0?(this.acceptedCol.has(t)||this.acceptedCol.set(t,"INVALID COL"),Promise.
all(c)):(this.acceptedCol.has(t)||this.acceptedCol.set(t,t),Promise.all(c))}async getVernacular(t){let n=new Map,a=`SELE\
CT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`,d=(await this.sparqlEndpoint.getSparqlResultSet(
a,this.fetchOptions,`Vernacular ${t}`)).results.bindings;for(let c of d)c.n?.value&&(c.n["xml:lang"]?n.has(c.n["xml:lang"])?
n.get(c.n["xml:lang"]).push(c.n.value):n.set(c.n["xml:lang"],[c.n.value]):n.has("??")?n.get("??").push(c.n.value):n.set(
"??",[c.n.value]));return n}makeTreatmentSet(t){return t?new Set(t.filter(n=>!!n).map(n=>{let[a,d]=n.split(">");if(!this.
treatments.has(a)){let c=this.getTreatmentDetails(a);this.treatments.set(a,{url:a,date:d?parseInt(d,10):void 0,details:c})}
return this.treatments.get(a)})):new Set}async getTreatmentDetails(t){let n=`
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let a=await this.sparqlEndpoint.getSparqlResultSet(
n,this.fetchOptions,`TreatmentDetails ${t}`),d=a.results.bindings.filter(i=>i.mc&&i.catalogNumbers?.value).map(i=>{let o=i.
httpUris?.value?.split("|");return{catalogNumber:i.catalogNumbers.value,collectionCode:i.collectionCodes?.value||void 0,
typeStatus:i.typeStatuss?.value||void 0,countryCode:i.countryCodes?.value||void 0,stateProvince:i.stateProvinces?.value||
void 0,municipality:i.municipalitys?.value||void 0,county:i.countys?.value||void 0,locality:i.localitys?.value||void 0,verbatimLocality:i.
verbatimLocalitys?.value||void 0,recordedBy:i.recordedBys?.value||void 0,eventDate:i.eventDates?.value||void 0,samplingProtocol:i.
samplingProtocols?.value||void 0,decimalLatitude:i.decimalLatitudes?.value||void 0,decimalLongitude:i.decimalLongitudes?.
value||void 0,verbatimElevation:i.verbatimElevations?.value||void 0,gbifOccurrenceId:i.gbifOccurrenceIds?.value||void 0,
gbifSpecimenId:i.gbifSpecimenIds?.value||void 0,httpUri:o?.length?o:void 0}}),c=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,p=(await this.sparqlEndpoint.getSparqlResultSet(c,this.fetchOptions,`TreatmentDetails/Figures ${t}`)).results.bindings.
filter(i=>i.url?.value).map(i=>({url:i.url.value,description:i.description?.value}));return{creators:a.results.bindings[0]?.
creators?.value,title:a.results.bindings[0]?.title?.value,materialCitations:d,figureCitations:p,treats:{def:new Set(a.results.
bindings[0]?.defs?.value?a.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(a.results.bindings[0]?.augs?.value?
a.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(a.results.bindings[0]?.dprs?.value?a.results.bindings[0].
dprs.value.split("|"):void 0),citetc:new Set(a.results.bindings[0]?.cites?.value?a.results.bindings[0].cites.value.split(
"|"):void 0),treattn:new Set(a.results.bindings[0]?.trttns?.value?a.results.bindings[0].trttns.value.split("|"):void 0),
citetn:new Set(a.results.bindings[0]?.citetns?.value?a.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(a){return console.
warn("SPARQL Error: "+a),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,citetc:new Set,
treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((n,a)=>{let d=()=>{if(this.
controller.signal.aborted)a(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)n({value:this.names[t++]});else if(this.
isFinished)n({done:!0,value:!0});else{let c=()=>{this.monitor.removeEventListener("updated",c),d()};this.monitor.addEventListener(
"updated",c)}};d()})}}};function U(h){let t=new Set(h);return Array.from(t)}var L=new URLSearchParams(document.location.search),X=!L.has("show_col"),Z=L.has("subtaxa"),W=L.has("sort_treatments_by_\
type"),J=L.get("server")||"https://treatment.ld.plazi.org/sparql",z=L.get("q")||"https://www.catalogueoflife.org/data/ta\
xon/3WD9M",k=document.getElementById("root");var f={def:'<svg class="green" viewBox="0 -960 960 960"><path fill="currentcolor" d="M444-288h72v-156h156v-72H516v-156h-\
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
177-51 51Z"/></svg>',empty:'<svg viewBox="0 -960 960 960"></svg>'},C=document.createElement("div");k.insertAdjacentElement(
"beforebegin",C);C.append(`Finding Synonyms for ${z} `);var G=document.createElement("progress");C.append(G);var j=performance.
now(),Y=new A(J),S=new b(Y,z,X,Z),E=class extends HTMLElement{constructor(t,n){super(),this.innerHTML=f[n]??f.unknown;let a=document.
createElement("button");a.classList.add("icon","button"),a.innerHTML=f.expand,a.addEventListener("click",()=>{this.classList.
toggle("expanded")?a.innerHTML=f.collapse:a.innerHTML=f.expand});let d=document.createElement("span");t.date?d.innerText=
""+t.date:(d.classList.add("missing"),d.innerText="No Date"),this.append(d);let c=document.createElement("progress");this.
append(": ",c);let u=document.createElement("a");u.classList.add("treatment","uri"),u.href=t.url,u.target="_blank",u.innerText=
t.url.replace("http://treatment.plazi.org/id/",""),u.innerHTML+=f.link,this.append(" ",u),this.append(a);let p=document.
createElement("div");p.classList.add("indent","details"),this.append(p),t.details.then(i=>{let o=document.createElement(
"span"),m=document.createElement("i");if(c.replaceWith(o," ",m),i.creators?o.innerText=i.creators:(o.classList.add("miss\
ing"),o.innerText="No Authors"),i.title?m.innerText="\u201C"+i.title+"\u201D":(m.classList.add("missing"),m.innerText="N\
o Title"),i.treats.def.size>0){let l=document.createElement("div");l.innerHTML=f.east,l.innerHTML+=f.def,(n==="def"||n===
"cite")&&l.classList.add("hidden"),p.append(l),i.treats.def.forEach(g=>{let e=document.createElement("a");e.classList.add(
"taxon","uri");let s=g.replace("http://taxon-concept.plazi.org/id/","");e.innerText=s,e.href="#"+s,e.title="show name",l.
append(" ",e),S.findName(g).then(r=>{e.classList.remove("uri"),r.authority?e.innerText=r.displayName+" "+r.authority:e.innerText=
r.displayName},()=>{e.removeAttribute("href")})})}if(i.treats.aug.size>0||i.treats.treattn.size>0){let l=document.createElement(
"div");l.innerHTML=f.east,l.innerHTML+=f.aug,(n==="aug"||n==="cite")&&l.classList.add("hidden"),p.append(l),i.treats.aug.
forEach(g=>{let e=document.createElement("a");e.classList.add("taxon","uri");let s=g.replace("http://taxon-concept.plazi\
.org/id/","");e.innerText=s,e.href="#"+s,e.title="show name",l.append(" ",e),S.findName(g).then(r=>{e.classList.remove("\
uri"),r.authority?e.innerText=r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("href")})}),
i.treats.treattn.forEach(g=>{let e=document.createElement("a");e.classList.add("taxon","uri");let s=g.replace("http://ta\
xon-name.plazi.org/id/","");e.innerText=s,e.href="#"+s,e.title="show name",l.append(" ",e),S.findName(g).then(r=>{e.classList.
remove("uri"),r.authority?e.innerText=r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("h\
ref")})})}if(i.treats.dpr.size>0){let l=document.createElement("div");l.innerHTML=f.west,l.innerHTML+=f.dpr,(n==="dpr"||
n==="cite")&&l.classList.add("hidden"),p.append(l),i.treats.dpr.forEach(g=>{let e=document.createElement("a");e.classList.
add("taxon","uri");let s=g.replace("http://taxon-concept.plazi.org/id/","");e.innerText=s,e.href="#"+s,e.title="show nam\
e",l.append(" ",e),S.findName(g).then(r=>{e.classList.remove("uri"),r.authority?e.innerText=r.displayName+" "+r.authority:
e.innerText=r.displayName},()=>{e.removeAttribute("href")})})}if(i.treats.citetc.size>0||i.treats.citetn.size>0){let l=document.
createElement("div");l.innerHTML=f.empty+f.cite,l.classList.add("hidden"),p.append(l),i.treats.citetc.forEach(g=>{let e=document.
createElement("a");e.classList.add("taxon","uri");let s=g.replace("http://taxon-concept.plazi.org/id/","");e.innerText=s,
e.href="#"+s,e.title="show name",l.append(" ",e),S.findName(g).then(r=>{e.classList.remove("uri"),r.authority?e.innerText=
r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("href")})}),i.treats.citetn.forEach(g=>{
let e=document.createElement("a");e.classList.add("taxon","uri");let s=g.replace("http://taxon-name.plazi.org/id/","");e.
innerText=s,e.href="#"+s,e.title="show name",l.append(" ",e),S.findName(g).then(r=>{e.classList.remove("uri"),r.authority?
e.innerText=r.displayName+" "+r.authority:e.innerText=r.displayName},()=>{e.removeAttribute("href")})})}if(i.figureCitations.
length>0){let l=document.createElement("div");l.classList.add("figures","hidden"),p.append(l);for(let g of i.figureCitations){
let e=document.createElement("figure");l.append(e);let s=document.createElement("img");s.src=g.url,s.loading="lazy",s.alt=
g.description??"Cited Figure without caption",e.append(s);let r=document.createElement("figcaption");r.innerText=g.description??
"",e.append(r)}}if(i.materialCitations.length>0){let l=document.createElement("div");l.innerHTML=f.empty+f.cite+" Materi\
al Citations:<br> -",l.classList.add("hidden"),p.append(l),l.innerText+=i.materialCitations.map(g=>JSON.stringify(g).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",E);var y=class extends HTMLElement{constructor(t){super();let n=document.
createElement("h2"),a=document.createElement("i");a.innerText=t.displayName,n.append(a),this.append(n);let d=document.createElement(
"span");d.classList.add("rank"),d.innerText=t.rank;let c=document.createElement("span");if(c.classList.add("rank"),c.innerText=
t.kingdom||"Missing Kingdom",n.append(" ",c," ",d),t.taxonNameURI){let o=document.createElement("a");o.classList.add("ta\
xon","uri");let m=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");o.innerText=m,o.id=m,o.href=t.taxonNameURI,
o.target="_blank",o.innerHTML+=f.link,n.append(" ",o)}let u=document.createElement("div");u.classList.add("vernacular"),
t.vernacularNames.then(o=>{o.size>0&&(u.innerText="\u201C"+U([...o.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(u);let p=document.createElement("ul");if(this.append(p),t.col){let o=document.createElement("a");o.classList.
add("col","uri");let m=t.col.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");o.innerText=m,o.id=m,o.href=
t.col.colURI,o.target="_blank",o.innerHTML+=f.link,n.append(" ",o);let l=document.createElement("div");l.classList.add("\
treatmentline"),l.innerHTML=t.col.acceptedURI!==t.col.colURI?f.col_dpr:f.col_aug,p.append(l);let g=document.createElement(
"span");g.innerText="Catalogue of Life",l.append(g);let e=document.createElement("div");if(e.classList.add("indent"),l.append(
e),t.col.acceptedURI!==t.col.colURI){let s=document.createElement("div");s.innerHTML=f.east+f.col_aug,e.append(s);let r=document.
createElement("a");r.classList.add("col","uri");let T=t.col.acceptedURI.replace("https://www.catalogueoflife.org/data/ta\
xon/","");r.innerText=T,r.href=`#${T}`,r.title="show name",s.append(r),S.findName(t.col.acceptedURI).then(v=>{v.authority?
r.innerText=v.displayName+" "+v.authority:r.innerText=v.displayName},()=>{r.removeAttribute("href")})}}if(t.treatments.treats.
size>0||t.treatments.cite.size>0){for(let o of t.treatments.treats){let m=new E(o,"aug");p.append(m)}for(let o of t.treatments.
cite){let m=new E(o,"cite");p.append(m)}}let i=document.createElement("abbr");i.classList.add("justification"),i.innerText=
"...?",D(t).then(o=>i.title=`This ${o}`),n.append(" ",i);for(let o of t.authorizedNames){let m=document.createElement("h\
3"),l=document.createElement("i");l.innerText=o.displayName,l.classList.add("gray"),m.append(l),m.append(" ",o.authority),
this.append(m);let g=document.createElement("ul");if(this.append(g),o.taxonConceptURIs[0]){let s=document.createElement(
"a");s.classList.add("taxon","uri");let r=o.taxonConceptURIs[0].replace("http://taxon-concept.plazi.org/id/","");s.innerText=
r,s.id=r,s.href=o.taxonConceptURIs[0],s.target="_blank",s.innerHTML+=f.link,m.append(" ",s)}if(o.col){let s=document.createElement(
"a");s.classList.add("col","uri");let r=o.col.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");s.innerText=
r,s.id=r,s.href=o.col.colURI,s.target="_blank",s.innerHTML+=f.link,m.append(" ",s);let T=document.createElement("div");T.
classList.add("treatmentline"),T.innerHTML=o.col.acceptedURI!==o.col.colURI?f.col_dpr:f.col_aug,g.append(T);let v=document.
createElement("span");v.innerText="Catalogue of Life",T.append(v);let N=document.createElement("div");if(N.classList.add(
"indent"),T.append(N),o.col.acceptedURI!==o.col.colURI){let I=document.createElement("div");I.innerHTML=f.east+f.col_aug,
N.append(I);let w=document.createElement("a");w.classList.add("col","uri");let q=o.col.acceptedURI.replace("https://www.\
catalogueoflife.org/data/taxon/","");w.innerText=q,w.href=`#${q}`,w.title="show name",I.append(" ",w),S.findName(o.col.acceptedURI).
then(O=>{w.classList.remove("uri"),O.authority?w.innerText=O.displayName+" "+O.authority:w.innerText=O.displayName},()=>{
w.removeAttribute("href")})}}let e=[];for(let s of o.treatments.def)e.push({trt:s,status:"def"});for(let s of o.treatments.
aug)e.push({trt:s,status:"aug"});for(let s of o.treatments.dpr)e.push({trt:s,status:"dpr"});for(let s of o.treatments.cite)
e.push({trt:s,status:"cite"});W||e.sort((s,r)=>s.trt.date&&r.trt.date?s.trt.date-r.trt.date:s.trt.date?1:r.trt.date?-1:0);
for(let{trt:s,status:r}of e){let T=new E(s,r);g.append(T)}}}};customElements.define("syno-name",y);async function D(h){if(h.
justification.searchTerm)return h.justification.subTaxon?"is a sub-taxon of the search term.":"is the search term.";if(h.
justification.treatment){let t=await h.justification.treatment.details,n=await D(h.justification.parent);return`is, acco\
rding to ${t.creators} ${h.justification.treatment.date},
     a synonym of ${h.justification.parent.displayName} which ${n}`}else{let t=await D(h.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${h.justification.parent.displayName} which ${t}`}}for await(let h of S){let t=new y(h);k.append(t)}var V=performance.
now();C.innerHTML="";C.innerText=`Found ${S.names.length} names with ${S.treatments.size} treatments. This took ${(V-j)/
1e3} seconds.`;S.names.length===0&&k.append(":[");
//# sourceMappingURL=index.js.map
