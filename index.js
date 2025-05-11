async function V(e){return await new Promise(i=>{setTimeout(i,e)})}var D=class{constructor(t){this.sparqlEnpointUri=t}async getSparqlResultSet(t,i={},s=""){
i.headers=i.headers||{},i.headers.Accept="application/sparql-results+json";let p=0,d=async()=>{try{let a=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(t),i);if(!a.ok)throw new Error("Response not ok. Status "+a.status);return await a.
json()}catch(a){if(i.signal?.aborted)throw a;if(p<10){let c=50*(1<<p++);return console.info(`!! Fetch Error. Retrying in\
 ${c}ms (${p})`),await V(c),i.cache="no-cache",await d()}throw console.warn("!! Fetch Error:",t,`
---
`,a),a}};return await d()}};function x(e){return`${e.noMissing}|${e.rank}|${e.kingdom??""}|${e.genericName??""}|${e.infragenericEpithet??""}|${e.specificEpithet??
""}|${e.infraspecificEpithet??""}`}function K(e){switch(e){case"variety":return"var. ";case"subspecies":return"";case"fo\
rm":return"f. ";default:return e+" "}}function X(e){return e.genericName+(e.infragenericEpithet?` (${e.infragenericEpithet}\
)`:"")+(e.specificEpithet?` ${e.specificEpithet}`:"")+(e.infraspecificEpithet?e.rank?` ${K(e.rank)}${e.infraspecificEpithet}`:
` ${e.infraspecificEpithet}`:"")}async function q(e,t,i,s){if(!e.genericName&&!e.infragenericEpithet&&!e.specificEpithet&&
!e.infraspecificEpithet)return console.log("skipping getColFromName for empty name"),new Set;let p=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?col ?acceptedcol ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    ${e.rank?`?col dwc:taxonRank "${e.rank}" .`:""}
    ${e.genericName?`?col dwc:genericName "${e.genericName}" .`:e.noMissing?"FILTER NOT EXISTS { ?col dwc:genericName ?_\
generic . }":""}
    ${e.infragenericEpithet?`?col dwc:infragenericEpithet "${e.infragenericEpithet}" .`:e.noMissing&&!(t&&e.specificEpithet)?
"FILTER NOT EXISTS { ?col dwc:infragenericEpithet ?_infrag . }":""}
    ${e.specificEpithet?`?col dwc:specificEpithet "${e.specificEpithet}" .`:e.noMissing?"FILTER NOT EXISTS { ?col dwc:sp\
ecificEpithet ?_specific . }":""}
    ${e.infraspecificEpithet?`?col dwc:infraspecificEpithet "${e.infraspecificEpithet}" .`:e.noMissing?"FILTER NOT EXIST\
S { ?col dwc:infraspecificEpithet ?_infrasp . }":""}
    ${e.kingdom?`?col dwc:kingdom "${e.kingdom}" .`:e.noMissing&&!t?"FILTER NOT EXISTS { ?col dwc:kingdom ?_kingdom . }":
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
LIMIT 500`,d=await i.getSparqlResultSet(p,s,"getColFromName");return new Set(d.results.bindings.map(a=>{let c=a.col?.value,
o=a.acceptedcol?.value,r=a.authority?.value,u=r?a.name?.value.replace(r,"").trimEnd():a.name?.value,m=a.status?.value;if(!c||
!o||!u||!m)return;let h={rank:a.rank?.value.toLocaleLowerCase(),kingdom:a.kingdom?.value,genericName:a.generic?.value,infragenericEpithet:a.
infrag?.value,specificEpithet:a.specific?.value,infraspecificEpithet:a.infrasp?.value,noMissing:!0};return!h.genericName&&
!h.infragenericEpithet&&!h.specificEpithet&&!h.infraspecificEpithet&&(u=`\u201C${u}\u201D`),{colUri:c,acceptedColUri:o,humanReadable:u,
authority:r,status:m,latinName:h}}).filter(a=>a!==void 0))}async function Z(e,t,i){let s=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?acceptedcol ?col ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    {
        ?col dwc:acceptedName <${e}> .
        BIND (<${e}> AS ?acceptedcol)
    } UNION {
        <${e}> dwc:acceptedName ?acceptedcol .
        ?col dwc:acceptedName? ?acceptedcol .
    } UNION {
        <${e}> dwc:taxonomicStatus "accepted" .
        BIND(<${e}> AS ?col)
        BIND(<${e}> AS ?acceptedcol)
    } UNION {
        <${e}> dwc:taxonomicStatus "provisionally accepted" .
        BIND(<${e}> AS ?col)
        BIND(<${e}> AS ?acceptedcol)
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
}`,p=await t.getSparqlResultSet(s,i,"getNameFromCol");if(p.results.bindings.length===0)throw new Error(`Could not get sy\
nonyms for CoL <${e}>`);let d,a=new Set;for(let c of p.results.bindings){let o=c.col?.value,r=c.acceptedcol?.value,u=c.authority?.
value,m=u?c.name?.value.replace(u,"").trimEnd():c.name?.value,h=c.status?.value;if(!o||!r||!m||!h)continue;let n={rank:c.
rank?.value.toLocaleLowerCase(),kingdom:c.kingdom?.value,genericName:c.generic?.value,infragenericEpithet:c.infrag?.value,
specificEpithet:c.specific?.value,infraspecificEpithet:c.infrasp?.value,noMissing:!0};!n.genericName&&!n.infragenericEpithet&&
!n.specificEpithet&&!n.infraspecificEpithet&&(m=`\u201C${m}\u201D`);let l={colUri:o,acceptedColUri:r,humanReadable:m,authority:u,
status:h,latinName:n};o===c.acceptedcol?.value?d=l:a.add(l)}if(!d)throw new Error(`Could not get synonyms for CoL <${e}>\
 [missing acceptedcol]`);return{accepted:d,synonyms:a}}async function z(e,t,i,s){if(!e.genericName&&!e.infragenericEpithet&&
!e.specificEpithet&&!e.infraspecificEpithet)return console.log("skipping getPlaziFromName for empty name"),new Set;let p=`\

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
    ${e.rank?`?tn dwc:rank "${e.rank}" .`:""}
    ${e.genericName?`?tn dwc:genus "${e.genericName}" .`:e.noMissing?"FILTER NOT EXISTS { ?tn dwc:genus ?_generic . }":""}\

    ${e.infragenericEpithet?`?tn dwc:subGenus|dwc:section|dwc:series "${e.infragenericEpithet}" .`:e.noMissing&&!(t&&e.specificEpithet)?
"FILTER NOT EXISTS { ?tn dwc:subGenus|dwc:section|dwc:series ?_infrag . }":""}
    ${e.specificEpithet?`?tn dwc:species "${e.specificEpithet}" .`:e.noMissing?"FILTER NOT EXISTS { ?tn dwc:species ?_sp\
ecific . }":""}
    ${e.infraspecificEpithet?`?tn dwc:subSpecies|dwc:variety|dwc:form "${e.infraspecificEpithet}" .`:e.noMissing?"FILTER\
 NOT EXISTS { ?tn dwc:subSpecies|dwc:variety|dwc:form ?_infrasp . }":""}
    ${e.kingdom?`?tn dwc:kingdom "${e.kingdom}" .`:e.noMissing&&!t?"FILTER NOT EXISTS { ?tn dwc:kingdom ?_kingdom . }":""}\

    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section|dwc:series ?infrag . }
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
LIMIT 500`,d=await i.getSparqlResultSet(p,s,"getPlaziFromName"),a=new Map;for(let c of d.results.bindings){let o=c.tn?.value;
if(!o)continue;let r=c.tc?.value,u=c.authorities?.value,m=!r||!u?void 0:{tcUri:r,authorities:u,defs:c.defs?.value,augs:c.
augs?.value,dprs:c.dprs?.value,cites:c.cites?.value},h=a.get(o);h?m&&h.authorized.push(m):a.set(o,{tnUri:o,authorized:m?
[m]:[],treats:c.tntreats?.value,cites:c.tncites?.value,latinName:{rank:c.rank?.value.toLocaleLowerCase(),kingdom:c.kingdom?.
value,genericName:c.generic?.value,infragenericEpithet:c.infrag?.value,specificEpithet:c.specific?.value,infraspecificEpithet:c.
infrasp?.value,noMissing:!0}})}return new Set(a.values())}async function G(e,t,i){let s=`
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
    BIND(<${e}> AS ?tn)
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section|dwc:series ?infrag . }
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
LIMIT 500`,p=await t.getSparqlResultSet(s,i,"getNameFromTN"),d=new Map;for(let a of p.results.bindings){let c=a.tn?.value;
if(!c)continue;let o=a.tc?.value,r=a.authorities?.value,u=!o||!r?void 0:{tcUri:o,authorities:r,defs:a.defs?.value,augs:a.
augs?.value,dprs:a.dprs?.value,cites:a.cites?.value},m=d.get(c);m?u&&m.authorized.push(u):d.set(c,{tnUri:c,authorized:u?
[u]:[],treats:a.tntreats?.value,cites:a.tncites?.value,latinName:{rank:a.rank?.value.toLocaleLowerCase(),kingdom:a.kingdom?.
value,genericName:a.generic?.value,infragenericEpithet:a.infrag?.value,specificEpithet:a.specific?.value,infraspecificEpithet:a.
infrasp?.value,noMissing:!0}})}if(d.size!==1)throw new Error(`Got multiple latin names for ${e}`);return d.values().next().
value}async function W(e,t,i){let s=`
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
    <${e}> trt:hasTaxonName ?tn .
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
    # { ... } UNION { ?tn trt:hasParentName* ?k . ?k dwc:rank "kingdom" ; dwc:kingdom ?kingdom . }
    OPTIONAL { ?tn dwc:genus ?generic . }
    OPTIONAL { ?tn dwc:subGenus|dwc:section|dwc:series ?infrag . }
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
LIMIT 500`,p=await t.getSparqlResultSet(s,i,"getNameFromTC"),d=new Map;for(let a of p.results.bindings){let c=a.tn?.value;
if(!c)continue;let o=a.tc?.value,r=a.authorities?.value,u=!o||!r?void 0:{tcUri:o,authorities:r,defs:a.defs?.value,augs:a.
augs?.value,dprs:a.dprs?.value,cites:a.cites?.value},m=d.get(c);m?u&&m.authorized.push(u):d.set(c,{tnUri:c,authorized:u?
[u]:[],treats:a.tntreats?.value,cites:a.tncites?.value,latinName:{rank:a.rank?.value.toLocaleLowerCase(),kingdom:a.kingdom?.
value,genericName:a.generic?.value,infragenericEpithet:a.infrag?.value,specificEpithet:a.specific?.value,infraspecificEpithet:a.
infrasp?.value,noMissing:!0}})}if(d.size!==1)throw new Error(`Got multiple latin names for ${e}`);return d.values().next().
value}function U(e,t){let i=e.split(/\s*[,]\s*/),s=t.split(/\s*[,]\s*/),p=i.length>0&&/\d{4}/.test(i.at(-1))?i.pop():null,d=s.
length>0&&/\d{4}/.test(s.at(-1))?s.pop():null,a=i.length>0&&/\s*et\.?\s*al\.?/.test(i.at(-1)),c=s.length>0&&/\s*et\.?\s*al\.?/.
test(s.at(-1));if(a&&(i[i.length-1]=i[i.length-1].replace(/\s*et\.?\s*al\.?/,"")),c&&(s[s.length-1]=s[s.length-1].replace(
/\s*et\.?\s*al\.?/,"")),!a&&!c&&i.length!=s.length)return null;let o=[],r=0;for(;r<i.length&&r<s.length;r++){let u=et(i[r],
s[r]);if(u!==null)o.push(u);else return null}for(let u=r;u<i.length;u++)i[u]&&o.push(i[u]);for(let u=r;u<s.length;u++)s[u]&&
o.push(s[u]);if(p&&d)if(p===d)o.push(p);else return null;else p?o.push(p):d&&o.push(d);return o.join(", ")}var j=/^(?:(?:\S\.\s*)*\s)?(\S+)\.?$/;
function et(e,t){let i=j.exec(e)?.[1],s=j.exec(t)?.[1];return i&&s&&$(i,s)||$(e,t)}function $(e,t){let i=e.replaceAll("-",
" "),s=t.replaceAll("-"," ");if(i.endsWith(".")||s.endsWith(".")){let p=i.normalize("NFKC"),d=s.normalize("NFKC"),a=p.lastIndexOf(
"."),c=d.lastIndexOf("."),o=a!==-1?c!==-1?Math.min(a,c):a:c;i=p.substring(0,o),s=d.substring(0,o)}if(nt(i,s)){let p=e.normalize(
"NFD"),d=t.normalize("NFD");return p.length>=d.length?e:t}return null}function nt(e,t){return e.localeCompare(t,"en",{sensitivity:"\
base",usage:"search"})===0}var F=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;fetchOptions={signal:this.
controller.signal,cache:"force-cache"};names=[];pushName(t){this.names.push(t),this.monitor.dispatchEvent(new CustomEvent(
"updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;noSynonyms;constructor(t,i,s=!0,p=!1,d=!1){
if(this.sparqlEndpoint=t,this.ignoreDeprecatedCoL=s,this.startWithSubTaxa=p,this.noSynonyms=d,i.startsWith("https://www.\
catalogueoflife.org/"))this.findColSynonyms(i,{searchTerm:!0,subTaxon:!1}).catch(a=>{console.log("SynoGroup Failure: ",a),
this.controller.abort("SynoGroup Failed")}).finally(()=>this.finish());else if(i.startsWith("http://taxon-concept.plazi.\
org/id/"))this.tcSynonyms(i,{searchTerm:!0,subTaxon:!1}).catch(a=>{console.log("SynoGroup Failure: ",a),this.controller.
abort("SynoGroup Failed")}).finally(()=>this.finish());else if(i.startsWith("http://taxon-name.plazi.org/id/"))this.tnSynonyms(
i,{searchTerm:!0,subTaxon:!1}).catch(a=>{console.log("SynoGroup Failure: ",a),this.controller.abort("SynoGroup Failed")}).
finally(()=>this.finish());else{let a=/^(\w+)(?:\s+\((\w+)\))?(?:\s+×?\s*(\w+)(?:(?:\s+\w+\.\s*\w*)*?\s+(\w+))?)?$/.exec(
i);if(a===null){console.log("SynoGroup Failure: Could not parse",i),this.controller.abort("SynoGroup Failed"),this.finish();
return}let c={genericName:a[1],infragenericEpithet:a[2],specificEpithet:a[3],infraspecificEpithet:a[4],noMissing:!this.startWithSubTaxa};
this.handleLatinName(c,{searchTerm:!0,subTaxon:!1}).catch(o=>{console.log("SynoGroup Failure: ",o),this.controller.abort(
"SynoGroup Failed")}).finally(()=>this.finish())}}async handleLatinName(t,i){let s=x(t);if(this.expanded.has(s)){console.
log(`Skipping known (${s})`);return}if(console.debug(`synogroup: lnSynonyms ${s}`),this.controller.signal?.aborted)return Promise.
reject();this.expanded.add(s);let[p,d]=await Promise.all([q(t,i.searchTerm,this.sparqlEndpoint,this.fetchOptions),z(t,i.
searchTerm,this.sparqlEndpoint,this.fetchOptions)]);await this.handleColAndPlaziResult(p,d,s,i)}async handleColAndPlaziResult(t,i,s,p){
console.debug(`synogroup: handling ${s}`);let d=[],a=[],c=new Set,o=new Map,r=new Map;for(let h of t){let n=x(h.latinName),
l=o.get(n);l?l.add(h):(c.add(n),o.set(n,new Set([h])))}for(let h of i){let n=x(h.latinName);r.has(n)&&console.warn("Foun\
d duplicate Plazi-LN: ${key}"),c.add(n),r.set(n,h)}for(let h of c){if(h!=s&&this.expanded.has(h)){console.log(`Skipping \
known (${h})`);continue}this.expanded.add(h);let n=r.get(h),l=o.get(h),g=[],N,I=[],O,y,S;if(l)for(let f of l.values()){let v=f.
colUri;O||(O=f.latinName.kingdom),y||(y=f.humanReadable),S||(S=f.latinName.rank),f.authority?I.find(R=>R.col?.colURI===v)||
I.push({displayName:f.humanReadable,authority:f.authority,authorities:[f.authority],col:{colURI:v,status:f.status,acceptedURI:f.
acceptedColUri},taxonConceptURIs:[],treatments:{def:new Set,aug:new Set,dpr:new Set,cite:new Set}}):(N&&N.colURI!==v&&console.
log("Duplicate unathorized COL:",v),N={colURI:v,status:f.status,acceptedURI:f.acceptedColUri})}if(n){y||(y=X(n.latinName));
for(let f of n.authorized){let v=this.makeTreatmentSet(f.defs?.split("|")),R=this.makeTreatmentSet(f.augs?.split("|")),M=this.
makeTreatmentSet(f.dprs?.split("|")),H=this.makeTreatmentSet(f.cites?.split("|"));v.forEach(L=>g.push(L)),R.forEach(L=>g.
push(L)),M.forEach(L=>g.push(L));let E=I.find(L=>U(L.authority,f.authorities)!==null);if(E){let L=f.authorities;E.authority=
U(E.authority,L),E.authorities.push(...f.authorities.split(" / ")),E.taxonConceptURIs.push(f.tcUri),E.treatments={def:E.
treatments.def.union(v),aug:E.treatments.aug.union(R),dpr:E.treatments.dpr.union(M),cite:E.treatments.cite.union(H)}}else
I.push({displayName:y,authority:f.authorities,authorities:f.authorities.split(" / "),taxonConceptURIs:[f.tcUri],treatments:{
def:v,aug:R,dpr:M,cite:H}})}}y||(y=h);let b=n?.treats?this.makeTreatmentSet(n.treats.split("|")):new Set;b.forEach(f=>g.
push(f));let C={kingdom:O??n?.latinName.kingdom??"",displayName:y,rank:S??n?.latinName.rank??"",vernacularNames:n?this.getVernacular(
n.tnUri):Promise.resolve(new Map),taxonNameURI:n?.tnUri,col:N,authorizedNames:I,justification:p,treatments:{treats:b,cite:n?.
cites?this.makeTreatmentSet(n.cites.split("|")):new Set}};this.pushName(C),N&&a.push(this.findColSynonyms(N.acceptedURI,
{searchTerm:!1,parent:C}));for(let f of I)f.col&&a.push(this.findColSynonyms(f.col.acceptedURI,{searchTerm:!1,parent:C}));
d.push(...g.map(f=>f.details.then(v=>[C,f,v])))}let u=new Map,m=new Map;(await Promise.all(d)).map(([h,n,l])=>{l.treats.
aug.difference(this.expanded).forEach(g=>u.set(g,[h,n])),l.treats.def.difference(this.expanded).forEach(g=>u.set(g,[h,n])),
l.treats.dpr.difference(this.expanded).forEach(g=>u.set(g,[h,n])),l.treats.treattn.difference(this.expanded).forEach(g=>m.
set(g,[h,n]))}),await Promise.allSettled([...[...u].map(([h,[n,l]])=>this.tcSynonyms(h,{searchTerm:!1,parent:n,treatment:l})),
...[...m].map(([h,[n,l]])=>this.tnSynonyms(h,{searchTerm:!1,parent:n,treatment:l})),...a])}async tcSynonyms(t,i){if(this.
noSynonyms&&!i.searchTerm)return;console.debug(`synogroup: tcSynonyms ${t}`),this.expanded.add(t);let s=await W(t,this.sparqlEndpoint,
this.fetchOptions),p=await q(s.latinName,i.searchTerm,this.sparqlEndpoint,this.fetchOptions);return this.handleColAndPlaziResult(
p,new Set([s]),"",i)}async tnSynonyms(t,i){if(this.noSynonyms&&!i.searchTerm)return;console.debug(`synogroup: tnSynonyms\
 ${t}`),this.expanded.add(t);let s=await G(t,this.sparqlEndpoint,this.fetchOptions),p=await q(s.latinName,i.searchTerm,this.
sparqlEndpoint,this.fetchOptions);return this.handleColAndPlaziResult(p,new Set([s]),"",i)}findName(t){let i;for(let s of this.
names){if(s.taxonNameURI===t||s.col?.colURI===t){i=s;break}let p=s.authorizedNames.find(d=>d.col?.colURI===t||d.taxonConceptURIs.
includes(t));if(p){i=p;break}}return i?Promise.resolve(i):new Promise((s,p)=>{this.monitor.addEventListener("updated",()=>{
(this.names.length===0||this.isFinished)&&p();let d=this.names.at(-1);if(d.taxonNameURI===t||d.col?.colURI===t){s(d);return}
let a=d.authorizedNames.find(c=>c.col?.colURI===t||c.taxonConceptURIs.includes(t));if(a){s(a);return}})})}async findColSynonyms(t,i){
if(this.noSynonyms&&!i.searchTerm)return[];if(this.acceptedCol.has(t))return[];console.debug(`synogroup: colSynonyms ${t}`);
let s=[];try{let{accepted:p,synonyms:d}=await Z(t,this.sparqlEndpoint,this.fetchOptions),a=[],c=new Set;if(!this.acceptedCol.
has(p.colUri)){this.acceptedCol.set(p.colUri,p.colUri);let r=i.searchTerm&&t===p.colUri;if(!this.noSynonyms||r){let u=x(
p.latinName);c.has(u)||(c.add(u),a.push(z(p.latinName,r,this.sparqlEndpoint,this.fetchOptions)))}}for(let r of d){this.acceptedCol.
set(r.colUri,p.colUri);let u=i.searchTerm&&t===r.colUri;if(u||!this.ignoreDeprecatedCoL&&!this.noSynonyms){let m=x(r.latinName);
c.has(m)||(c.add(m),a.push(z(r.latinName,u,this.sparqlEndpoint,this.fetchOptions)))}}let o=await Promise.all(a);s.push(this.
handleColAndPlaziResult(d.add(p),o.reduce((r,u)=>r.union(u)),"",i)),this.acceptedCol.has(t)||this.acceptedCol.set(t,t)}catch{
this.acceptedCol.has(t)||this.acceptedCol.set(t,"INVALID COL")}return Promise.all(s)}async getVernacular(t){let i=new Map,
s=`SELECT DISTINCT ?n WHERE { <${t}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`,p=(await this.sparqlEndpoint.
getSparqlResultSet(s,this.fetchOptions,`Vernacular ${t}`)).results.bindings;for(let d of p)d.n?.value&&(d.n["xml:lang"]?
i.has(d.n["xml:lang"])?i.get(d.n["xml:lang"]).push(d.n.value):i.set(d.n["xml:lang"],[d.n.value]):i.has("??")?i.get("??").
push(d.n.value):i.set("??",[d.n.value]));return i}makeTreatmentSet(t){return t?new Set(t.filter(i=>!!i).map(i=>{let[s,p]=i.
split(">");if(!this.treatments.has(s)){let d=this.getTreatmentDetails(s);this.treatments.set(s,{url:s,date:p?parseInt(p,
10):void 0,details:d})}return this.treatments.get(s)})):new Set}async getTreatmentDetails(t){let i=`
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
i,this.fetchOptions,`TreatmentDetails ${t}`),p=s.results.bindings.filter(o=>o.mc&&o.catalogNumbers?.value).map(o=>{let r=o.
httpUris?.value?.split("|");return{catalogNumber:o.catalogNumbers.value,collectionCode:o.collectionCodes?.value||void 0,
typeStatus:o.typeStatuss?.value||void 0,countryCode:o.countryCodes?.value||void 0,stateProvince:o.stateProvinces?.value||
void 0,municipality:o.municipalitys?.value||void 0,county:o.countys?.value||void 0,locality:o.localitys?.value||void 0,verbatimLocality:o.
verbatimLocalitys?.value||void 0,recordedBy:o.recordedBys?.value||void 0,eventDate:o.eventDates?.value||void 0,samplingProtocol:o.
samplingProtocols?.value||void 0,decimalLatitude:o.decimalLatitudes?.value||void 0,decimalLongitude:o.decimalLongitudes?.
value||void 0,verbatimElevation:o.verbatimElevations?.value||void 0,gbifOccurrenceId:o.gbifOccurrenceIds?.value||void 0,
gbifSpecimenId:o.gbifSpecimenIds?.value||void 0,httpUri:r?.length?r:void 0}}),d=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${t}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,c=(await this.sparqlEndpoint.getSparqlResultSet(d,this.fetchOptions,`TreatmentDetails/Figures ${t}`)).results.bindings.
filter(o=>o.url?.value).map(o=>({url:o.url.value,description:o.description?.value}));return{creators:s.results.bindings[0]?.
creators?.value,title:s.results.bindings[0]?.title?.value,materialCitations:p,figureCitations:c,treats:{def:new Set(s.results.
bindings[0]?.defs?.value?s.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(s.results.bindings[0]?.augs?.value?
s.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(s.results.bindings[0]?.dprs?.value?s.results.bindings[0].
dprs.value.split("|"):void 0),citetc:new Set(s.results.bindings[0]?.cites?.value?s.results.bindings[0].cites.value.split(
"|"):void 0),treattn:new Set(s.results.bindings[0]?.trttns?.value?s.results.bindings[0].trttns.value.split("|"):void 0),
citetn:new Set(s.results.bindings[0]?.citetns?.value?s.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(s){return console.
warn("SPARQL Error: "+s),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,citetc:new Set,
treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let t=0;return{next:()=>new Promise((i,s)=>{let p=()=>{if(this.
controller.signal.aborted)s(new Error("SynyonymGroup has been aborted"));else if(t<this.names.length)i({value:this.names[t++]});else if(this.
isFinished)i({done:!0,value:!0});else{let d=()=>{this.monitor.removeEventListener("updated",d),p()};this.monitor.addEventListener(
"updated",d)}};p()})}}};function J(e){let t=new Set(e);return Array.from(t)}var A=new URLSearchParams(document.location.search),it=!A.has("show_col"),at=A.has("nosynonyms"),st=A.has("subtaxa"),rt=A.
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
now(),dt=new D(ot),w=new F(dt,Y,it,st,at),P=class extends HTMLElement{constructor(t,i){super(),this.innerHTML=T[i]??T.unknown;
let s=document.createElement("button");s.classList.add("icon","button"),s.innerHTML=T.expand,s.addEventListener("click",
()=>{this.classList.toggle("expanded")?s.innerHTML=T.collapse:s.innerHTML=T.expand});let p=document.createElement("span");
t.date?p.innerText=""+t.date:(p.classList.add("missing"),p.innerText="No Date"),this.append(p);let d=document.createElement(
"progress");this.append(": ",d);let a=document.createElement("a");a.classList.add("treatment","uri"),a.href=t.url,a.target=
"_blank",a.innerText=t.url.replace("http://treatment.plazi.org/id/",""),a.innerHTML+=T.link,this.append(" ",a),this.append(
s);let c=document.createElement("div");c.classList.add("indent","details"),this.append(c),t.details.then(o=>{let r=document.
createElement("span"),u=document.createElement("i");if(d.replaceWith(r," ",u),o.creators?r.innerText=o.creators:(r.classList.
add("missing"),r.innerText="No Authors"),o.title?u.innerText="\u201C"+o.title+"\u201D":(u.classList.add("missing"),u.innerText=
"No Title"),o.treats.def.size>0){let m=document.createElement("div");m.innerHTML=T.east,m.innerHTML+=T.def,(i==="def"||i===
"cite")&&m.classList.add("hidden"),c.append(m),o.treats.def.forEach(h=>{let n=document.createElement("a");n.classList.add(
"taxon","uri");let l=h.replace("http://taxon-concept.plazi.org/id/","");n.innerText=l,n.href="#"+l,n.title="show name",m.
append(" ",n),w.findName(h).then(g=>{n.classList.remove("uri"),g.authority?n.innerText=g.displayName+" "+g.authority:n.innerText=
g.displayName},()=>{n.removeAttribute("href")})})}if(o.treats.aug.size>0||o.treats.treattn.size>0){let m=document.createElement(
"div");m.innerHTML=T.east,m.innerHTML+=T.aug,(i==="aug"||i==="cite")&&m.classList.add("hidden"),c.append(m),o.treats.aug.
forEach(h=>{let n=document.createElement("a");n.classList.add("taxon","uri");let l=h.replace("http://taxon-concept.plazi\
.org/id/","");n.innerText=l,n.href="#"+l,n.title="show name",m.append(" ",n),w.findName(h).then(g=>{n.classList.remove("\
uri"),g.authority?n.innerText=g.displayName+" "+g.authority:n.innerText=g.displayName},()=>{n.removeAttribute("href")})}),
o.treats.treattn.forEach(h=>{let n=document.createElement("a");n.classList.add("taxon","uri");let l=h.replace("http://ta\
xon-name.plazi.org/id/","");n.innerText=l,n.href="#"+l,n.title="show name",m.append(" ",n),w.findName(h).then(g=>{n.classList.
remove("uri"),g.authority?n.innerText=g.displayName+" "+g.authority:n.innerText=g.displayName},()=>{n.removeAttribute("h\
ref")})})}if(o.treats.dpr.size>0){let m=document.createElement("div");m.innerHTML=T.west,m.innerHTML+=T.dpr,(i==="dpr"||
i==="cite")&&m.classList.add("hidden"),c.append(m),o.treats.dpr.forEach(h=>{let n=document.createElement("a");n.classList.
add("taxon","uri");let l=h.replace("http://taxon-concept.plazi.org/id/","");n.innerText=l,n.href="#"+l,n.title="show nam\
e",m.append(" ",n),w.findName(h).then(g=>{n.classList.remove("uri"),g.authority?n.innerText=g.displayName+" "+g.authority:
n.innerText=g.displayName},()=>{n.removeAttribute("href")})})}if(o.treats.citetc.size>0||o.treats.citetn.size>0){let m=document.
createElement("div");m.innerHTML=T.empty+T.cite,m.classList.add("hidden"),c.append(m),o.treats.citetc.forEach(h=>{let n=document.
createElement("a");n.classList.add("taxon","uri");let l=h.replace("http://taxon-concept.plazi.org/id/","");n.innerText=l,
n.href="#"+l,n.title="show name",m.append(" ",n),w.findName(h).then(g=>{n.classList.remove("uri"),g.authority?n.innerText=
g.displayName+" "+g.authority:n.innerText=g.displayName},()=>{n.removeAttribute("href")})}),o.treats.citetn.forEach(h=>{
let n=document.createElement("a");n.classList.add("taxon","uri");let l=h.replace("http://taxon-name.plazi.org/id/","");n.
innerText=l,n.href="#"+l,n.title="show name",m.append(" ",n),w.findName(h).then(g=>{n.classList.remove("uri"),g.authority?
n.innerText=g.displayName+" "+g.authority:n.innerText=g.displayName},()=>{n.removeAttribute("href")})})}if(o.figureCitations.
length>0){let m=document.createElement("div");m.classList.add("figures","hidden"),c.append(m);for(let h of o.figureCitations){
let n=document.createElement("figure");m.append(n);let l=document.createElement("img");l.src=h.url,l.loading="lazy",l.alt=
h.description??"Cited Figure without caption",n.append(l);let g=document.createElement("figcaption");g.innerText=h.description??
"",n.append(g)}}if(o.materialCitations.length>0){let m=document.createElement("div");m.innerHTML=T.empty+T.cite+" Materi\
al Citations:<br> -",m.classList.add("hidden"),c.append(m),m.innerText+=o.materialCitations.map(h=>JSON.stringify(h).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",P);var _=class extends HTMLElement{constructor(t){super();let i=document.
createElement("h2"),s=document.createElement("i");s.innerText=t.displayName,i.append(s),this.append(i);let p=document.createElement(
"span");p.classList.add("rank"),p.innerText=t.rank;let d=document.createElement("span");if(d.classList.add("rank"),d.innerText=
t.kingdom||"Missing Kingdom",i.append(" ",d," ",p),t.taxonNameURI){let r=document.createElement("a");r.classList.add("ta\
xon","uri");let u=t.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");r.innerText=u,r.id=u,r.href=t.taxonNameURI,
r.target="_blank",r.innerHTML+=T.link,i.append(" ",r)}let a=document.createElement("div");a.classList.add("vernacular"),
t.vernacularNames.then(r=>{r.size>0&&(a.innerText="\u201C"+J([...r.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(a);let c=document.createElement("ul");if(this.append(c),t.col){let r=document.createElement("a");r.classList.
add("col","uri");let u=t.col.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");r.innerText=u,r.id=u,r.href=
t.col.colURI,r.target="_blank",r.innerHTML+=T.link,i.append(" ",r);let m=document.createElement("div");m.classList.add("\
treatmentline"),m.innerHTML=t.col.acceptedURI!==t.col.colURI?T.col_dpr:T.col_aug,c.append(m);let h=document.createElement(
"span");h.innerText=`Catalogue of Life: ${t.col.status}`,m.append(h);let n=document.createElement("div");if(n.classList.
add("indent"),m.append(n),t.col.acceptedURI!==t.col.colURI){let l=document.createElement("div");l.innerHTML=T.east+T.col_aug,
n.append(l);let g=document.createElement("a");g.classList.add("col","uri");let N=t.col.acceptedURI.replace("https://www.\
catalogueoflife.org/data/taxon/","");g.innerText=N,g.href=`#${N}`,g.title="show name",l.append(g),w.findName(t.col.acceptedURI).
then(I=>{I.authority?g.innerText=I.displayName+" "+I.authority:g.innerText=I.displayName},()=>{g.removeAttribute("href")})}}
if(t.treatments.treats.size>0||t.treatments.cite.size>0){for(let r of t.treatments.treats){let u=new P(r,"aug");c.append(
u)}for(let r of t.treatments.cite){let u=new P(r,"cite");c.append(u)}}let o=document.createElement("abbr");o.classList.add(
"justification"),o.innerText="...?",B(t).then(r=>o.title=`This ${r}`),i.append(" ",o);for(let r of t.authorizedNames){let u=document.
createElement("h3"),m=document.createElement("i");m.innerText=r.displayName,m.classList.add("gray"),u.append(m),u.append(
" ",r.authority),this.append(u);let h=document.createElement("ul");if(this.append(h),r.taxonConceptURIs[0]){let l=document.
createElement("a");l.classList.add("taxon","uri");let g=r.taxonConceptURIs[0].replace("http://taxon-concept.plazi.org/id\
/","");l.innerText=g,l.id=g,l.href=r.taxonConceptURIs[0],l.target="_blank",l.innerHTML+=T.link,u.append(" ",l)}if(r.col){
let l=document.createElement("a");l.classList.add("col","uri");let g=r.col.colURI.replace("https://www.catalogueoflife.o\
rg/data/taxon/","");l.innerText=g,l.id=g,l.href=r.col.colURI,l.target="_blank",l.innerHTML+=T.link,u.append(" ",l);let N=document.
createElement("div");N.classList.add("treatmentline"),N.innerHTML=r.col.acceptedURI!==r.col.colURI?T.col_dpr:T.col_aug,h.
append(N);let I=document.createElement("span");I.innerText=`Catalogue of Life: ${r.col.status}`,N.append(I);let O=document.
createElement("div");if(O.classList.add("indent"),N.append(O),r.col.acceptedURI!==r.col.colURI){let y=document.createElement(
"div");y.innerHTML=T.east+T.col_aug,O.append(y);let S=document.createElement("a");S.classList.add("col","uri");let b=r.col.
acceptedURI.replace("https://www.catalogueoflife.org/data/taxon/","");S.innerText=b,S.href=`#${b}`,S.title="show name",y.
append(" ",S),w.findName(r.col.acceptedURI).then(C=>{S.classList.remove("uri"),C.authority?S.innerText=C.displayName+" "+
C.authority:S.innerText=C.displayName},()=>{S.removeAttribute("href")})}}let n=[];for(let l of r.treatments.def)n.push({
trt:l,status:"def"});for(let l of r.treatments.aug)n.push({trt:l,status:"aug"});for(let l of r.treatments.dpr)n.push({trt:l,
status:"dpr"});for(let l of r.treatments.cite)n.push({trt:l,status:"cite"});rt||n.sort((l,g)=>l.trt.date&&g.trt.date?l.trt.
date-g.trt.date:l.trt.date?1:g.trt.date?-1:0);for(let{trt:l,status:g}of n){let N=new P(l,g);h.append(N)}}}};customElements.
define("syno-name",_);async function B(e){if(e.justification.searchTerm)return e.justification.subTaxon?"is a sub-taxon \
of the search term.":"is the search term.";if(e.justification.treatment){let t=await e.justification.treatment.details,i=await B(
e.justification.parent);return`is, according to ${t.creators} ${e.justification.treatment.date},
     a synonym of ${e.justification.parent.displayName} which ${i}`}else{let t=await B(e.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${e.justification.parent.displayName} which ${t}`}}for await(let e of w){let t=new _(e);Q.append(t)}var pt=performance.
now();k.innerHTML="";k.innerText=`Found ${w.names.length} names with ${w.treatments.size} treatments. This took ${(pt-lt)/
1e3} seconds.`;w.names.length===0&&Q.append(":[");
//# sourceMappingURL=index.js.map
