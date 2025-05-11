async function V(a){return await new Promise(n=>{setTimeout(n,a)})}var D=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,n={},s=""){
n.headers=n.headers||{},n.headers.Accept="application/sparql-results+json";let g=0,d=async()=>{try{let i=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),n);if(!i.ok)throw new Error("Response not ok. Status "+i.status);return await i.
json()}catch(i){if(n.signal?.aborted)throw i;if(g<10){let c=50*(1<<g++);return console.info(`!! Fetch Error. Retrying in\
 ${c}ms (${g})`),await V(c),n.cache="no-cache",await d()}throw console.warn("!! Fetch Error:",t,`
---
`,i),i}};return await d()}};function b(a){return`${a.noMissing}|${a.rank}|${a.kingdom}|${a.genericName}|${a.infragenericEpithet}|${a.specificEpithet}\
|${a.infraspecificEpithet}`}function K(a){switch(a){case"variety":return"var.";case"subspecies":return"subsp.";case"form":
return"f.";default:return a}}function X(a){return a.genericName+(a.infragenericEpithet?` (${a.infragenericEpithet})`:"")+
(a.specificEpithet?` ${a.specificEpithet}`:"")+(a.infraspecificEpithet?a.rank?` ${K(a.rank)} ${a.infraspecificEpithet}`:
` ${a.infraspecificEpithet}`:"")}async function q(a,t,n,s){let g=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?col ?acceptedcol ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    ${a.rank?`?col dwc:taxonRank "${a.rank}" .`:""}
    ${a.genericName?`?col dwc:genericName "${a.genericName}" .`:a.noMissing?"FILTER NOT EXISTS { ?col dwc:genericName ?_\
generic . }":""}
    ${a.infragenericEpithet?`?col dwc:infragenericEpithet "${a.infragenericEpithet}" .`:a.noMissing&&!(t&&a.specificEpithet)?
"FILTER NOT EXISTS { ?col dwc:infragenericEpithet ?_infrag . }":""}
    ${a.specificEpithet?`?col dwc:specificEpithet "${a.specificEpithet}" .`:a.noMissing?"FILTER NOT EXISTS { ?col dwc:sp\
ecificEpithet ?_specific . }":""}
    ${a.infraspecificEpithet?`?col dwc:infraspecificEpithet "${a.infraspecificEpithet}" .`:a.noMissing?"FILTER NOT EXIST\
S { ?col dwc:infraspecificEpithet ?_infrasp . }":""}
    ${a.kingdom?`?col dwc:kingdom "${a.kingdom}" .`:a.noMissing&&!t?"FILTER NOT EXISTS { ?col dwc:kingdom ?_kingdom . }":
""}
    ?col dwc:taxonomicStatus ?status ;
         dwc:scientificName ?name ;
         dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:genericName ?generic . }
    OPTIONAL { ?col dwc:infragenericEpithet ?infrag . }
    OPTIONAL { ?col dwc:specificEpithet ?specific . }
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
    OPTIONAL { ?col dwc:kingdom ?kingdom . }
    {
        ?col dwc:acceptedName ?acceptedcol .
    } UNION {
        ?col dwc:taxonomicStatus "accepted" .
        BIND(?col AS ?acceptedcol)
    } UNION {
        ?col dwc:taxonomicStatus "provisionally accepted" .
        BIND(?col AS ?acceptedcol)
    }
}
LIMIT 500`,d=await n.getSparqlResultSet(g,s,"getColFromName");return new Set(d.results.bindings.map(i=>{let c=i.col?.value,
r=i.acceptedcol?.value,o=i.authority?.value,h=o?i.name?.value.replace(o,"").trimEnd():i.name?.value,u=i.status?.value,p=i.
generic?.value;if(!(!c||!r||!h||!u||!p))return{colUri:c,acceptedColUri:r,humanReadable:h,authority:o,status:u,latinName:{
rank:i.rank?.value,kingdom:i.kingdom?.value,genericName:p,infragenericEpithet:i.infrag?.value,specificEpithet:i.specific?.
value,infraspecificEpithet:i.infrasp?.value,noMissing:!0}}}).filter(i=>i!==void 0))}async function Z(a,t,n){let s=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?acceptedcol ?col ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    {
        ?col dwc:acceptedName <${a}> .
        BIND (<${a}> AS ?acceptedcol)
    } UNION {
        <${a}> dwc:acceptedName ?acceptedcol .
        ?col dwc:acceptedName? ?acceptedcol .
    } UNION {
        <${a}> dwc:taxonomicStatus "accepted" .
        BIND(<${a}> AS ?col)
        BIND(<${a}> AS ?acceptedcol)
    } UNION {
        <${a}> dwc:taxonomicStatus "provisionally accepted" .
        BIND(<${a}> AS ?col)
        BIND(<${a}> AS ?acceptedcol)
    }
    ?col dwc:taxonomicStatus ?status ;
        dwc:scientificName ?name ;
        dwc:taxonRank ?rank .
    OPTIONAL { ?col dwc:genericName ?generic . }
    OPTIONAL { ?col dwc:infragenericEpithet ?infrag . }
    OPTIONAL { ?col dwc:specificEpithet ?specific . }
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
    OPTIONAL { ?col dwc:scientificNameAuthorship ?authority . }
    OPTIONAL { ?col dwc:kingdom ?kingdom . }
}`,g=await t.getSparqlResultSet(s,n,"getNameFromCol");if(g.results.bindings.length===0)throw new Error(`Could not get sy\
nonyms for CoL <${a}>`);let d,i=new Set;for(let c of g.results.bindings){let r=c.col?.value,o=c.acceptedcol?.value,h=c.authority?.
value,u=h?c.name?.value.replace(h,"").trimEnd():c.name?.value,p=c.status?.value,e=c.generic?.value;if(!r||!o||!u||!p||!e)
continue;let l={colUri:r,acceptedColUri:o,humanReadable:u,authority:h,status:p,latinName:{rank:c.rank?.value,kingdom:c.kingdom?.
value,genericName:e,infragenericEpithet:c.infrag?.value,specificEpithet:c.specific?.value,infraspecificEpithet:c.infrasp?.
value,noMissing:!0}};r===c.acceptedcol?.value?d=l:i.add(l)}if(!d)throw new Error(`Could not get synonyms for CoL <${a}> \
[missing acceptedcol]`);return{accepted:d,synonyms:i}}async function M(a,t,n,s){let g=`
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
  (group_concat(DISTINCT ?authority;separator=" / ") AS ?authorities)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)
WHERE {
    ${a.rank?`?tn dwc:rank "${a.rank}" .`:""}
    ${a.genericName?`?tn dwc:genus "${a.genericName}" .`:a.noMissing?"FILTER NOT EXISTS { ?tn dwc:genus ?_generic . }":""}\

    ${a.infragenericEpithet?`?tn dwc:subGenus|dwc:section "${a.infragenericEpithet}" .`:a.noMissing&&!(t&&a.specificEpithet)?
"FILTER NOT EXISTS { ?tn dwc:subGenus|dwc:section ?_infrag . }":""}
    ${a.specificEpithet?`?tn dwc:species "${a.specificEpithet}" .`:a.noMissing?"FILTER NOT EXISTS { ?tn dwc:species ?_sp\
ecific . }":""}
    ${a.infraspecificEpithet?`?tn dwc:subSpecies|dwc:variety|dwc:form "${a.infraspecificEpithet}" .`:a.noMissing?"FILTER\
 NOT EXISTS { ?tn dwc:subSpecies|dwc:variety|dwc:form ?_infrasp . }":""}
    ${a.kingdom?`?tn dwc:kingdom "${a.kingdom}" .`:a.noMissing&&!t?"FILTER NOT EXISTS { ?tn dwc:kingdom ?_kingdom . }":""}\

    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section ?infrag . }
    OPTIONAL { ?tn dwc:species ?specific . }
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?authority ; a dwcFP:TaxonConcept .

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
GROUP BY ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
LIMIT 500`,d=await n.getSparqlResultSet(g,s,"getPlaziFromName"),i=new Map;for(let c of d.results.bindings){let r=c.tn?.value,
o=c.generic?.value;if(!r||!o)continue;let h=c.tc?.value,u=c.authorities?.value,p=!h||!u?void 0:{tcUri:h,authorities:u,defs:c.
defs?.value,augs:c.augs?.value,dprs:c.dprs?.value,cites:c.cites?.value},e=i.get(r);e?p&&e.authorized.push(p):i.set(r,{tnUri:r,
authorized:p?[p]:[],treats:c.tntreats?.value,cites:c.tncites?.value,latinName:{rank:c.rank?.value,kingdom:c.kingdom?.value,
genericName:o,infragenericEpithet:c.infrag?.value,specificEpithet:c.specific?.value,infraspecificEpithet:c.infrasp?.value,
noMissing:!0}})}return new Set(i.values())}async function G(a,t,n){let s=`
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
  (group_concat(DISTINCT ?authority;separator=" / ") AS ?authorities)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)
WHERE {
    BIND(<${a}> AS ?tn)
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section ?infrag . }
    OPTIONAL { ?tn dwc:species ?specific . }
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?authority ; a dwcFP:TaxonConcept .

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
GROUP BY ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
LIMIT 500`,g=await t.getSparqlResultSet(s,n,"getNameFromTN"),d=new Map;for(let i of g.results.bindings){let c=i.tn?.value,
r=i.generic?.value;if(!c||!r)continue;let o=i.tc?.value,h=i.authorities?.value,u=!o||!h?void 0:{tcUri:o,authorities:h,defs:i.
defs?.value,augs:i.augs?.value,dprs:i.dprs?.value,cites:i.cites?.value},p=d.get(c);p?u&&p.authorized.push(u):d.set(c,{tnUri:c,
authorized:u?[u]:[],treats:i.tntreats?.value,cites:i.tncites?.value,latinName:{rank:i.rank?.value,kingdom:i.kingdom?.value,
genericName:r,infragenericEpithet:i.infrag?.value,specificEpithet:i.specific?.value,infraspecificEpithet:i.infrasp?.value,
noMissing:!0}})}if(d.size!==1)throw new Error(`Got multiple latin names for ${a}`);return d.values().next().value}async function W(a,t,n){
let s=`
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
PREFIX dwcFP: <http://filteredpush.org/ontologies/oa/dwcFP#>
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX trt: <http://plazi.org/vocab/treatment#>
SELECT DISTINCT ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
  (group_concat(DISTINCT ?authority;separator=" / ") AS ?authorities)
  (group_concat(DISTINCT ?aug;separator="|") as ?augs)
  (group_concat(DISTINCT ?def;separator="|") as ?defs)
  (group_concat(DISTINCT ?dpr;separator="|") as ?dprs)
  (group_concat(DISTINCT ?cite;separator="|") as ?cites)
  (group_concat(DISTINCT ?trtn;separator="|") as ?tntreats)
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)
WHERE {
    <${a}> trt:hasTaxonName ?tn .
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section ?infrag . }
    OPTIONAL { ?tn dwc:species ?specific . }
    OPTIONAL { ?tn dwc:subSpecies|dwc:variety|dwc:form ?infrasp . }

    OPTIONAL {
      ?trtnt trt:treatsTaxonName ?tn ; trt:publishedIn/dc:date ?trtndate .
      BIND(CONCAT(STR(?trtnt), ">", ?trtndate) AS ?trtn)
    }
    OPTIONAL {
      ?citetnt trt:citesTaxonName ?tn ; trt:publishedIn/dc:date ?citetndate .
      BIND(CONCAT(STR(?citetnt), ">", ?citetndate) AS ?citetn)
    }

    OPTIONAL {
      ?tc trt:hasTaxonName ?tn ; dwc:scientificNameAuthorship ?authority ; a dwcFP:TaxonConcept .

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
GROUP BY ?tn ?tc ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
LIMIT 500`,g=await t.getSparqlResultSet(s,n,"getNameFromTC"),d=new Map;for(let i of g.results.bindings){let c=i.tn?.value,
r=i.generic?.value;if(!c||!r)continue;let o=i.tc?.value,h=i.authorities?.value,u=!o||!h?void 0:{tcUri:o,authorities:h,defs:i.
defs?.value,augs:i.augs?.value,dprs:i.dprs?.value,cites:i.cites?.value},p=d.get(c);p?u&&p.authorized.push(u):d.set(c,{tnUri:c,
authorized:u?[u]:[],treats:i.tntreats?.value,cites:i.tncites?.value,latinName:{rank:i.rank?.value,kingdom:i.kingdom?.value,
genericName:r,infragenericEpithet:i.infrag?.value,specificEpithet:i.specific?.value,infraspecificEpithet:i.infrasp?.value,
noMissing:!0}})}if(d.size!==1)throw new Error(`Got multiple latin names for ${a}`);return d.values().next().value}function U(a,t){let n=a.split(/\s*[,]\s*/),s=t.split(/\s*[,]\s*/),g=n.length>0&&/\d{4}/.test(n.at(-1))?n.pop():null,d=s.
length>0&&/\d{4}/.test(s.at(-1))?s.pop():null,i=n.length>0&&/\s*et\.?\s*al\.?/.test(n.at(-1)),c=s.length>0&&/\s*et\.?\s*al\.?/.
test(s.at(-1));if(i&&(n[n.length-1]=n[n.length-1].replace(/\s*et\.?\s*al\.?/,"")),c&&(s[s.length-1]=s[s.length-1].replace(
/\s*et\.?\s*al\.?/,"")),!i&&!c&&n.length!=s.length)return null;let r=[],o=0;for(;o<n.length&&o<s.length;o++){let h=et(n[o],
s[o]);if(h!==null)r.push(h);else return null}for(let h=o;h<n.length;h++)n[h]&&r.push(n[h]);for(let h=o;h<s.length;h++)s[h]&&
r.push(s[h]);if(g&&d)if(g===d)r.push(g);else return null;else g?r.push(g):d&&r.push(d);return r.join(", ")}var j=/^(?:(?:\S\.\s*)*\s)?(\S+)\.?$/;
function et(a,t){let n=j.exec(a)?.[1],s=j.exec(t)?.[1];return n&&s&&$(n,s)||$(a,t)}function $(a,t){let n=a.replaceAll("-",
" "),s=t.replaceAll("-"," ");if(n.endsWith(".")||s.endsWith(".")){let g=n.normalize("NFKC"),d=s.normalize("NFKC"),i=g.lastIndexOf(
"."),c=d.lastIndexOf("."),r=i!==-1?c!==-1?Math.min(i,c):i:c;n=g.substring(0,r),s=d.substring(0,r)}if(nt(n,s)){let g=a.normalize(
"NFD"),d=t.normalize("NFD");return g.length>=d.length?a:t}return null}function nt(a,t){return a.localeCompare(t,"en",{sensitivity:"\
base",usage:"search"})===0}var z=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;fetchOptions={signal:this.
controller.signal,cache:"force-cache"};names=[];pushName(t){this.names.push(t),this.monitor.dispatchEvent(new CustomEvent(
"updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;noSynonyms;constructor(t,n,s=!0,g=!1,d=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=s,this.startWithSubTaxa=g,this.noSynonyms=d,n.startsWith("https://www.\
catalogueoflife.org/"))this.findColSynonyms(n,{searchTerm:!0,subTaxon:!1}).catch(i=>{console.log("SynoGroup Failure: ",i),
this.controller.abort("SynoGroup Failed")}).finally(()=>this.finish());else if(n.startsWith("http://taxon-concept.plazi.\
org/id/"))this.tcSynonyms(n,{searchTerm:!0,subTaxon:!1}).catch(i=>{console.log("SynoGroup Failure: ",i),this.controller.
abort("SynoGroup Failed")}).finally(()=>this.finish());else if(n.startsWith("http://taxon-name.plazi.org/id/"))this.tnSynonyms(
n,{searchTerm:!0,subTaxon:!1}).catch(i=>{console.log("SynoGroup Failure: ",i),this.controller.abort("SynoGroup Failed")}).
finally(()=>this.finish());else{let i=/^(\w+)(?:\s+\((\w+)\))?(?:\s+×?\s*(\w+)(?:(?:\s+\w+\.\s*\w*)*?\s+(\w+))?)?$/.exec(
n);if(i===null){console.log("SynoGroup Failure: Could not parse",n),this.controller.abort("SynoGroup Failed"),this.finish();
return}let c={genericName:i[1],infragenericEpithet:i[2],specificEpithet:i[3],infraspecificEpithet:i[4],noMissing:!this.startWithSubTaxa};
this.handleLatinName(c,{searchTerm:!0,subTaxon:!1}).catch(r=>{console.log("SynoGroup Failure: ",r),this.controller.abort(
"SynoGroup Failed")}).finally(()=>this.finish())}}async handleLatinName(t,n){let s=b(t);if(this.expanded.has(s)){console.
log(`Skipping known (${s})`);return}if(this.controller.signal?.aborted)return Promise.reject();this.expanded.add(s);let[
g,d]=await Promise.all([q(t,n.searchTerm,this.sparqlEndpoint,this.fetchOptions),M(t,n.searchTerm,this.sparqlEndpoint,this.
fetchOptions)]);await this.handleColAndPlaziResult(g,d,s,n)}async handleColAndPlaziResult(t,n,s,g){let d=[],i=[],c=new Set,
r=new Map,o=new Map;for(let p of t){let e=b(p.latinName),l=r.get(e);l?l.add(p):(c.add(e),r.set(e,new Set([p])))}for(let p of n){
let e=b(p.latinName);o.has(e)&&console.warn("Found duplicate Plazi-LN: ${key}"),c.add(e),o.set(e,p)}console.log(c,r,o);for(let p of c){
if(p!=s&&this.expanded.has(p)){console.log(`Skipping known (${p})`);continue}this.expanded.add(p);let e=o.get(p),l=r.get(
p),m=[];console.log(p,l,e);let N,I=[],O,v,S;if(l)for(let f of l.values()){let y=f.colUri;O||(O=f.latinName.kingdom),v||(v=
f.humanReadable),S||(S=f.latinName.rank),f.authority?I.find(R=>R.col?.colURI===y)||I.push({displayName:f.humanReadable,authority:f.
authority,authorities:[f.authority],col:{colURI:y,status:f.status,acceptedURI:f.acceptedColUri},taxonConceptURIs:[],treatments:{
def:new Set,aug:new Set,dpr:new Set,cite:new Set}}):(N&&N.colURI!==y&&console.log("Duplicate unathorized COL:",y),N={colURI:y,
status:f.status,acceptedURI:f.acceptedColUri})}if(e){v||(v=X(e.latinName));for(let f of e.authorized){let y=this.makeTreatmentSet(
f.defs?.split("|")),R=this.makeTreatmentSet(f.augs?.split("|")),_=this.makeTreatmentSet(f.dprs?.split("|")),H=this.makeTreatmentSet(
f.cites?.split("|"));y.forEach(L=>m.push(L)),R.forEach(L=>m.push(L)),_.forEach(L=>m.push(L));let E=I.find(L=>U(L.authority,
f.authorities)!==null);if(E){let L=f.authorities;E.authority=U(E.authority,L),E.authorities.push(...f.authorities.split(
" / ")),E.taxonConceptURIs.push(f.tcUri),E.treatments={def:E.treatments.def.union(y),aug:E.treatments.aug.union(R),dpr:E.
treatments.dpr.union(_),cite:E.treatments.cite.union(H)}}else I.push({displayName:v,authority:f.authorities,authorities:f.
authorities.split(" / "),taxonConceptURIs:[f.tcUri],treatments:{def:y,aug:R,dpr:_,cite:H}})}}v||(v=p);let P=e?.treats?this.
makeTreatmentSet(e.treats.split("|")):new Set;P.forEach(f=>m.push(f));let C={kingdom:O??e?.latinName.kingdom??"",displayName:v,
rank:S??e?.latinName.rank??"",vernacularNames:e?this.getVernacular(e.tnUri):Promise.resolve(new Map),taxonNameURI:e?.tnUri,
col:N,authorizedNames:I,justification:g,treatments:{treats:P,cite:e?.cites?this.makeTreatmentSet(e.cites.split("|")):new Set}};
this.pushName(C),N&&i.push(this.findColSynonyms(N.acceptedURI,{searchTerm:!1,parent:C}));for(let f of I)f.col&&i.push(this.
findColSynonyms(f.col.acceptedURI,{searchTerm:!1,parent:C}));d.push(...m.map(f=>f.details.then(y=>[C,f,y])))}let h=new Map,
u=new Map;(await Promise.all(d)).map(([p,e,l])=>{l.treats.aug.difference(this.expanded).forEach(m=>h.set(m,[p,e])),l.treats.
def.difference(this.expanded).forEach(m=>h.set(m,[p,e])),l.treats.dpr.difference(this.expanded).forEach(m=>h.set(m,[p,e])),
l.treats.treattn.difference(this.expanded).forEach(m=>u.set(m,[p,e]))}),await Promise.allSettled([...[...h].map(([p,[e,l]])=>this.
tcSynonyms(p,{searchTerm:!1,parent:e,treatment:l})),...[...u].map(([p,[e,l]])=>this.tnSynonyms(p,{searchTerm:!1,parent:e,
treatment:l})),...i])}async tcSynonyms(t,n){if(this.noSynonyms&&!n.searchTerm)return;this.expanded.add(t);let s=await W(
t,this.sparqlEndpoint,this.fetchOptions),g=await q(s.latinName,n.searchTerm,this.sparqlEndpoint,this.fetchOptions);return this.
handleColAndPlaziResult(g,new Set([s]),"",n)}async tnSynonyms(t,n){if(this.noSynonyms&&!n.searchTerm)return;this.expanded.
add(t);let s=await G(t,this.sparqlEndpoint,this.fetchOptions),g=await q(s.latinName,n.searchTerm,this.sparqlEndpoint,this.
fetchOptions);return this.handleColAndPlaziResult(g,new Set([s]),"",n)}findName(t){let n;for(let s of this.names){if(s.taxonNameURI===
t||s.col?.colURI===t){n=s;break}let g=s.authorizedNames.find(d=>d.col?.colURI===t||d.taxonConceptURIs.includes(t));if(g){
n=g;break}}return n?Promise.resolve(n):new Promise((s,g)=>{this.monitor.addEventListener("updated",()=>{(this.names.length===
0||this.isFinished)&&g();let d=this.names.at(-1);if(d.taxonNameURI===t||d.col?.colURI===t){s(d);return}let i=d.authorizedNames.
find(c=>c.col?.colURI===t||c.taxonConceptURIs.includes(t));if(i){s(i);return}})})}async findColSynonyms(t,n){if(this.noSynonyms&&
!n.searchTerm)return[];if(this.acceptedCol.has(t))return[];let s=[];try{let{accepted:g,synonyms:d}=await Z(t,this.sparqlEndpoint,
this.fetchOptions);if(!this.acceptedCol.has(g.colUri)){this.acceptedCol.set(g.colUri,g.colUri);let o=n.searchTerm&&t===g.
colUri;(!this.noSynonyms||o)&&s.push(this.handleLatinName(g.latinName,n))}let i=[],c=new Set;for(let o of d){this.acceptedCol.
set(o.colUri,g.colUri);let h=n.searchTerm&&t===o.colUri;if(h||!this.ignoreDeprecatedCoL&&!this.noSynonyms){let u=b(o.latinName);
c.has(u)||(c.add(u),i.push(M(o.latinName,h,this.sparqlEndpoint,this.fetchOptions)))}}let r=await Promise.all(i);s.push(this.
handleColAndPlaziResult(d,r.reduce((o,h)=>o.union(h)),"",n)),this.acceptedCol.has(t)||this.acceptedCol.set(t,t)}catch{this.
acceptedCol.has(t)||this.acceptedCol.set(t,"INVALID COL")}return Promise.all(s)}async getVernacular(t){let n=new Map,s=`\
SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`,g=(await this.sparqlEndpoint.getSparqlResultSet(
s,this.fetchOptions,`Vernacular ${t}`)).results.bindings;for(let d of g)d.n?.value&&(d.n["xml:lang"]?n.has(d.n["xml:lang"])?
n.get(d.n["xml:lang"]).push(d.n.value):n.set(d.n["xml:lang"],[d.n.value]):n.has("??")?n.get("??").push(d.n.value):n.set(
"??",[d.n.value]));return n}makeTreatmentSet(t){return t?new Set(t.filter(n=>!!n).map(n=>{let[s,g]=n.split(">");if(!this.
treatments.has(s)){let d=this.getTreatmentDetails(s);this.treatments.set(s,{url:s,date:g?parseInt(g,10):void 0,details:d})}
return this.treatments.get(s)})):new Set}async getTreatmentDetails(t){let n=`
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
n,this.fetchOptions,`TreatmentDetails ${t}`),g=s.results.bindings.filter(r=>r.mc&&r.catalogNumbers?.value).map(r=>{let o=r.
httpUris?.value?.split("|");return{catalogNumber:r.catalogNumbers.value,collectionCode:r.collectionCodes?.value||void 0,
typeStatus:r.typeStatuss?.value||void 0,countryCode:r.countryCodes?.value||void 0,stateProvince:r.stateProvinces?.value||
void 0,municipality:r.municipalitys?.value||void 0,county:r.countys?.value||void 0,locality:r.localitys?.value||void 0,verbatimLocality:r.
verbatimLocalitys?.value||void 0,recordedBy:r.recordedBys?.value||void 0,eventDate:r.eventDates?.value||void 0,samplingProtocol:r.
samplingProtocols?.value||void 0,decimalLatitude:r.decimalLatitudes?.value||void 0,decimalLongitude:r.decimalLongitudes?.
value||void 0,verbatimElevation:r.verbatimElevations?.value||void 0,gbifOccurrenceId:r.gbifOccurrenceIds?.value||void 0,
gbifSpecimenId:r.gbifSpecimenIds?.value||void 0,httpUri:o?.length?o:void 0}}),d=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,c=(await this.sparqlEndpoint.getSparqlResultSet(d,this.fetchOptions,`TreatmentDetails/Figures ${t}`)).results.bindings.
filter(r=>r.url?.value).map(r=>({url:r.url.value,description:r.description?.value}));return{creators:s.results.bindings[0]?.
creators?.value,title:s.results.bindings[0]?.title?.value,materialCitations:g,figureCitations:c,treats:{def:new Set(s.results.
bindings[0]?.defs?.value?s.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(s.results.bindings[0]?.augs?.value?
s.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(s.results.bindings[0]?.dprs?.value?s.results.bindings[0].
dprs.value.split("|"):void 0),citetc:new Set(s.results.bindings[0]?.cites?.value?s.results.bindings[0].cites.value.split(
"|"):void 0),treattn:new Set(s.results.bindings[0]?.trttns?.value?s.results.bindings[0].trttns.value.split("|"):void 0),
citetn:new Set(s.results.bindings[0]?.citetns?.value?s.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(s){return console.
warn("SPARQL Error: "+s),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,citetc:new Set,
treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((n,s)=>{let g=()=>{if(this.
controller.signal.aborted)s(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)n({value:this.names[t++]});else if(this.
isFinished)n({done:!0,value:!0});else{let d=()=>{this.monitor.removeEventListener("updated",d),g()};this.monitor.addEventListener(
"updated",d)}};g()})}}};function J(a){let t=new Set(a);return Array.from(t)}var A=new URLSearchParams(document.location.search),at=!A.has("show_col"),it=A.has("nosynonyms"),st=A.has("subtaxa"),rt=A.
has("sort_treatments_by_type"),ot=A.get("server")||"https://treatment.ld.plazi.org/sparql",Y=A.get("q")||"https://www.ca\
talogueoflife.org/data/taxon/3WD9M",Q=document.getElementById("root");var T={def:'<svg class="green" viewBox="0 -960 960 960"><path fill="currentcolor" d="M444-288h72v-156h156v-72H516v-156h-\
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
177-51 51Z"/></svg>',empty:'<svg viewBox="0 -960 960 960"></svg>'},k=document.createElement("div");Q.insertAdjacentElement(
"beforebegin",k);k.append(`Finding Synonyms for ${Y} `);var ct=document.createElement("progress");k.append(ct);var lt=performance.
now(),dt=new D(ot),w=new z(dt,Y,at,st,it),x=class extends HTMLElement{constructor(t,n){super(),this.innerHTML=T[n]??T.unknown;
let s=document.createElement("button");s.classList.add("icon","button"),s.innerHTML=T.expand,s.addEventListener("click",
()=>{this.classList.toggle("expanded")?s.innerHTML=T.collapse:s.innerHTML=T.expand});let g=document.createElement("span");
t.date?g.innerText=""+t.date:(g.classList.add("missing"),g.innerText="No Date"),this.append(g);let d=document.createElement(
"progress");this.append(": ",d);let i=document.createElement("a");i.classList.add("treatment","uri"),i.href=t.url,i.target=
"_blank",i.innerText=t.url.replace("http://treatment.plazi.org/id/",""),i.innerHTML+=T.link,this.append(" ",i),this.append(
s);let c=document.createElement("div");c.classList.add("indent","details"),this.append(c),t.details.then(r=>{let o=document.
createElement("span"),h=document.createElement("i");if(d.replaceWith(o," ",h),r.creators?o.innerText=r.creators:(o.classList.
add("missing"),o.innerText="No Authors"),r.title?h.innerText="\u201C"+r.title+"\u201D":(h.classList.add("missing"),h.innerText=
"No Title"),r.treats.def.size>0){let u=document.createElement("div");u.innerHTML=T.east,u.innerHTML+=T.def,(n==="def"||n===
"cite")&&u.classList.add("hidden"),c.append(u),r.treats.def.forEach(p=>{let e=document.createElement("a");e.classList.add(
"taxon","uri");let l=p.replace("http://taxon-concept.plazi.org/id/","");e.innerText=l,e.href="#"+l,e.title="show name",u.
append(" ",e),w.findName(p).then(m=>{e.classList.remove("uri"),m.authority?e.innerText=m.displayName+" "+m.authority:e.innerText=
m.displayName},()=>{e.removeAttribute("href")})})}if(r.treats.aug.size>0||r.treats.treattn.size>0){let u=document.createElement(
"div");u.innerHTML=T.east,u.innerHTML+=T.aug,(n==="aug"||n==="cite")&&u.classList.add("hidden"),c.append(u),r.treats.aug.
forEach(p=>{let e=document.createElement("a");e.classList.add("taxon","uri");let l=p.replace("http://taxon-concept.plazi\
.org/id/","");e.innerText=l,e.href="#"+l,e.title="show name",u.append(" ",e),w.findName(p).then(m=>{e.classList.remove("\
uri"),m.authority?e.innerText=m.displayName+" "+m.authority:e.innerText=m.displayName},()=>{e.removeAttribute("href")})}),
r.treats.treattn.forEach(p=>{let e=document.createElement("a");e.classList.add("taxon","uri");let l=p.replace("http://ta\
xon-name.plazi.org/id/","");e.innerText=l,e.href="#"+l,e.title="show name",u.append(" ",e),w.findName(p).then(m=>{e.classList.
remove("uri"),m.authority?e.innerText=m.displayName+" "+m.authority:e.innerText=m.displayName},()=>{e.removeAttribute("h\
ref")})})}if(r.treats.dpr.size>0){let u=document.createElement("div");u.innerHTML=T.west,u.innerHTML+=T.dpr,(n==="dpr"||
n==="cite")&&u.classList.add("hidden"),c.append(u),r.treats.dpr.forEach(p=>{let e=document.createElement("a");e.classList.
add("taxon","uri");let l=p.replace("http://taxon-concept.plazi.org/id/","");e.innerText=l,e.href="#"+l,e.title="show nam\
e",u.append(" ",e),w.findName(p).then(m=>{e.classList.remove("uri"),m.authority?e.innerText=m.displayName+" "+m.authority:
e.innerText=m.displayName},()=>{e.removeAttribute("href")})})}if(r.treats.citetc.size>0||r.treats.citetn.size>0){let u=document.
createElement("div");u.innerHTML=T.empty+T.cite,u.classList.add("hidden"),c.append(u),r.treats.citetc.forEach(p=>{let e=document.
createElement("a");e.classList.add("taxon","uri");let l=p.replace("http://taxon-concept.plazi.org/id/","");e.innerText=l,
e.href="#"+l,e.title="show name",u.append(" ",e),w.findName(p).then(m=>{e.classList.remove("uri"),m.authority?e.innerText=
m.displayName+" "+m.authority:e.innerText=m.displayName},()=>{e.removeAttribute("href")})}),r.treats.citetn.forEach(p=>{
let e=document.createElement("a");e.classList.add("taxon","uri");let l=p.replace("http://taxon-name.plazi.org/id/","");e.
innerText=l,e.href="#"+l,e.title="show name",u.append(" ",e),w.findName(p).then(m=>{e.classList.remove("uri"),m.authority?
e.innerText=m.displayName+" "+m.authority:e.innerText=m.displayName},()=>{e.removeAttribute("href")})})}if(r.figureCitations.
length>0){let u=document.createElement("div");u.classList.add("figures","hidden"),c.append(u);for(let p of r.figureCitations){
let e=document.createElement("figure");u.append(e);let l=document.createElement("img");l.src=p.url,l.loading="lazy",l.alt=
p.description??"Cited Figure without caption",e.append(l);let m=document.createElement("figcaption");m.innerText=p.description??
"",e.append(m)}}if(r.materialCitations.length>0){let u=document.createElement("div");u.innerHTML=T.empty+T.cite+" Materi\
al Citations:<br> -",u.classList.add("hidden"),c.append(u),u.innerText+=r.materialCitations.map(p=>JSON.stringify(p).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",x);var F=class extends HTMLElement{constructor(t){super();let n=document.
createElement("h2"),s=document.createElement("i");s.innerText=t.displayName,n.append(s),this.append(n);let g=document.createElement(
"span");g.classList.add("rank"),g.innerText=t.rank;let d=document.createElement("span");if(d.classList.add("rank"),d.innerText=
t.kingdom||"Missing Kingdom",n.append(" ",d," ",g),t.taxonNameURI){let o=document.createElement("a");o.classList.add("ta\
xon","uri");let h=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");o.innerText=h,o.id=h,o.href=t.taxonNameURI,
o.target="_blank",o.innerHTML+=T.link,n.append(" ",o)}let i=document.createElement("div");i.classList.add("vernacular"),
t.vernacularNames.then(o=>{o.size>0&&(i.innerText="\u201C"+J([...o.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(i);let c=document.createElement("ul");if(this.append(c),t.col){let o=document.createElement("a");o.classList.
add("col","uri");let h=t.col.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");o.innerText=h,o.id=h,o.href=
t.col.colURI,o.target="_blank",o.innerHTML+=T.link,n.append(" ",o);let u=document.createElement("div");u.classList.add("\
treatmentline"),u.innerHTML=t.col.acceptedURI!==t.col.colURI?T.col_dpr:T.col_aug,c.append(u);let p=document.createElement(
"span");p.innerText=`Catalogue of Life: ${t.col.status}`,u.append(p);let e=document.createElement("div");if(e.classList.
add("indent"),u.append(e),t.col.acceptedURI!==t.col.colURI){let l=document.createElement("div");l.innerHTML=T.east+T.col_aug,
e.append(l);let m=document.createElement("a");m.classList.add("col","uri");let N=t.col.acceptedURI.replace("https://www.\
catalogueoflife.org/data/taxon/","");m.innerText=N,m.href=`#${N}`,m.title="show name",l.append(m),w.findName(t.col.acceptedURI).
then(I=>{I.authority?m.innerText=I.displayName+" "+I.authority:m.innerText=I.displayName},()=>{m.removeAttribute("href")})}}
if(t.treatments.treats.size>0||t.treatments.cite.size>0){for(let o of t.treatments.treats){let h=new x(o,"aug");c.append(
h)}for(let o of t.treatments.cite){let h=new x(o,"cite");c.append(h)}}let r=document.createElement("abbr");r.classList.add(
"justification"),r.innerText="...?",B(t).then(o=>r.title=`This ${o}`),n.append(" ",r);for(let o of t.authorizedNames){let h=document.
createElement("h3"),u=document.createElement("i");u.innerText=o.displayName,u.classList.add("gray"),h.append(u),h.append(
" ",o.authority),this.append(h);let p=document.createElement("ul");if(this.append(p),o.taxonConceptURIs[0]){let l=document.
createElement("a");l.classList.add("taxon","uri");let m=o.taxonConceptURIs[0].replace("http://taxon-concept.plazi.org/id\
/","");l.innerText=m,l.id=m,l.href=o.taxonConceptURIs[0],l.target="_blank",l.innerHTML+=T.link,h.append(" ",l)}if(o.col){
let l=document.createElement("a");l.classList.add("col","uri");let m=o.col.colURI.replace("https://www.catalogueoflife.o\
rg/data/taxon/","");l.innerText=m,l.id=m,l.href=o.col.colURI,l.target="_blank",l.innerHTML+=T.link,h.append(" ",l);let N=document.
createElement("div");N.classList.add("treatmentline"),N.innerHTML=o.col.acceptedURI!==o.col.colURI?T.col_dpr:T.col_aug,p.
append(N);let I=document.createElement("span");I.innerText=`Catalogue of Life: ${o.col.status}`,N.append(I);let O=document.
createElement("div");if(O.classList.add("indent"),N.append(O),o.col.acceptedURI!==o.col.colURI){let v=document.createElement(
"div");v.innerHTML=T.east+T.col_aug,O.append(v);let S=document.createElement("a");S.classList.add("col","uri");let P=o.col.
acceptedURI.replace("https://www.catalogueoflife.org/data/taxon/","");S.innerText=P,S.href=`#${P}`,S.title="show name",v.
append(" ",S),w.findName(o.col.acceptedURI).then(C=>{S.classList.remove("uri"),C.authority?S.innerText=C.displayName+" "+
C.authority:S.innerText=C.displayName},()=>{S.removeAttribute("href")})}}let e=[];for(let l of o.treatments.def)e.push({
trt:l,status:"def"});for(let l of o.treatments.aug)e.push({trt:l,status:"aug"});for(let l of o.treatments.dpr)e.push({trt:l,
status:"dpr"});for(let l of o.treatments.cite)e.push({trt:l,status:"cite"});rt||e.sort((l,m)=>l.trt.date&&m.trt.date?l.trt.
date-m.trt.date:l.trt.date?1:m.trt.date?-1:0);for(let{trt:l,status:m}of e){let N=new x(l,m);p.append(N)}}}};customElements.
define("syno-name",F);async function B(a){if(a.justification.searchTerm)return a.justification.subTaxon?"is a sub-taxon \
of the search term.":"is the search term.";if(a.justification.treatment){let t=await a.justification.treatment.details,n=await B(
a.justification.parent);return`is, according to ${t.creators} ${a.justification.treatment.date},
     a synonym of ${a.justification.parent.displayName} which ${n}`}else{let t=await B(a.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${a.justification.parent.displayName} which ${t}`}}for await(let a of w){let t=new F(a);Q.append(t)}var pt=performance.
now();k.innerHTML="";k.innerText=`Found ${w.names.length} names with ${w.treatments.size} treatments. This took ${(pt-lt)/
1e3} seconds.`;w.names.length===0&&Q.append(":[");
//# sourceMappingURL=index.js.map
