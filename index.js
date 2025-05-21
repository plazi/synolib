async function it(n){return await new Promise(i=>{setTimeout(i,n)})}var z=class{constructor(e){this.sparqlEnpointUri=e}async getSparqlResultSet(e,i={},a=""){
i.headers=i.headers||{},i.headers.Accept="application/sparql-results+json";let d=0,s=async()=>{try{let t=await fetch(this.
sparqlEnpointUri+"?query="+encodeURIComponent(e),i);if(!t.ok)throw new Error("Response not ok. Status "+t.status);return await t.
json()}catch(t){if(i.signal?.aborted)throw t;if(d<10){let o=50*(1<<d++);return console.info(`!! Fetch Error. Retrying in\
 ${o}ms (${d})`),await it(o),i.cache="no-cache",await s()}throw console.warn("!! Fetch Error:",e,`
---
`,t),t}};return await s()}};function L(n){return`${n.noMissing}|${n.rank}|${n.kingdom??""}|${n.genericName??""}|${n.infragenericEpithet??""}|${n.specificEpithet??
""}|${n.infraspecificEpithet??""}`}function at(n){switch(n){case"variety":return"var. ";case"subspecies":return"";case"f\
orm":return"f. ";default:return n+" "}}function W(n){return n.genericName+(n.infragenericEpithet?` (${n.infragenericEpithet}\
)`:"")+(n.specificEpithet?` ${n.specificEpithet}`:"")+(n.infraspecificEpithet?n.rank?` ${at(n.rank)}${n.infraspecificEpithet}`:
` ${n.infraspecificEpithet}`:"")}async function D(n,e,i,a){if(!n.genericName&&!n.infragenericEpithet&&!n.specificEpithet&&
!n.infraspecificEpithet)return console.log("skipping getColFromName for empty name"),new Set;let d=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?col ?acceptedcol ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    ${n.rank?`?col dwc:taxonRank "${n.rank}" .`:""}
    ${n.genericName?`?col dwc:genericName "${n.genericName}" .`:n.noMissing?"FILTER NOT EXISTS { ?col dwc:genericName ?_\
generic . }":""}
    ${n.infragenericEpithet?`?col dwc:infragenericEpithet "${n.infragenericEpithet}" .`:n.noMissing&&!(e&&n.specificEpithet)?
"FILTER NOT EXISTS { ?col dwc:infragenericEpithet ?_infrag . }":""}
    ${n.specificEpithet?`?col dwc:specificEpithet "${n.specificEpithet}" .`:n.noMissing?"FILTER NOT EXISTS { ?col dwc:sp\
ecificEpithet ?_specific . }":""}
    ${n.infraspecificEpithet?`?col dwc:infraspecificEpithet "${n.infraspecificEpithet}" .`:n.noMissing?"FILTER NOT EXIST\
S { ?col dwc:infraspecificEpithet ?_infrasp . }":""}
    ${n.kingdom?`?col dwc:kingdom "${n.kingdom}" .`:n.noMissing&&!e?"FILTER NOT EXISTS { ?col dwc:kingdom ?_kingdom . }":
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
LIMIT 500`,s=await i.getSparqlResultSet(d,a,"getColFromName");return new Set(s.results.bindings.map(t=>{let o=t.col?.value,
l=t.acceptedcol?.value,c=t.authority?.value,u=c?t.name?.value.replace(c,"").trimEnd():t.name?.value,p=t.status?.value;if(!o||
!l||!u||!p)return;let f={rank:t.rank?.value.toLocaleLowerCase(),kingdom:t.kingdom?.value,genericName:t.generic?.value,infragenericEpithet:t.
infrag?.value,specificEpithet:t.specific?.value,infraspecificEpithet:t.infrasp?.value,noMissing:!0};return!f.genericName&&
!f.infragenericEpithet&&!f.specificEpithet&&!f.infraspecificEpithet&&(u=`\u201C${u}\u201D`),{colUri:o,acceptedColUri:l,humanReadable:u,
authority:c,status:p,latinName:f}}).filter(t=>t!==void 0))}async function Z(n,e,i){let a=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?acceptedcol ?col ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    BIND(<${n}> AS ?col)
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
LIMIT 1`,d=await e.getSparqlResultSet(a,i,"getColSynonyms");if(d.results.bindings.length===0)throw new Error(`Could not \
get info for CoL <${n}>`);if(d.results.bindings.length>1)throw new Error(`Could not get info for CoL <${n}> -- to many r\
ows`);let s=d.results.bindings[0],t=s.col?.value,o=s.acceptedcol?.value,l=s.authority?.value,c=l?s.name?.value.replace(l,
"").trimEnd():s.name?.value,u=s.status?.value;if(!t||!o||!c||!u)throw new Error(`Could not get info for CoL <${n}> -- da\
ta error`);let p={rank:s.rank?.value.toLocaleLowerCase(),kingdom:s.kingdom?.value,genericName:s.generic?.value,infragenericEpithet:s.
infrag?.value,specificEpithet:s.specific?.value,infraspecificEpithet:s.infrasp?.value,noMissing:!0};return!p.genericName&&
!p.infragenericEpithet&&!p.specificEpithet&&!p.infraspecificEpithet&&(c=`\u201C${c}\u201D`),{colUri:n,acceptedColUri:o,humanReadable:c,
authority:l,status:u,latinName:p}}async function j(n,e,i){let a=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?acceptedcol ?col ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    {
        ?col dwc:acceptedName <${n}> .
        BIND (<${n}> AS ?acceptedcol)
    } UNION {
        <${n}> dwc:acceptedName ?acceptedcol .
        ?col dwc:acceptedName? ?acceptedcol .
    } UNION {
        <${n}> dwc:taxonomicStatus "accepted" .
        BIND(<${n}> AS ?col)
        BIND(<${n}> AS ?acceptedcol)
    } UNION {
        <${n}> dwc:taxonomicStatus "provisionally accepted" .
        BIND(<${n}> AS ?col)
        BIND(<${n}> AS ?acceptedcol)
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
}`,d=await e.getSparqlResultSet(a,i,"getColSynonyms");if(d.results.bindings.length===0)throw new Error(`Could not get sy\
nonyms for CoL <${n}>`);let s,t=new Set;for(let o of d.results.bindings){let l=o.col?.value,c=o.acceptedcol?.value,u=o.authority?.
value,p=u?o.name?.value.replace(u,"").trimEnd():o.name?.value,f=o.status?.value;if(!l||!c||!p||!f)continue;let r={rank:o.
rank?.value.toLocaleLowerCase(),kingdom:o.kingdom?.value,genericName:o.generic?.value,infragenericEpithet:o.infrag?.value,
specificEpithet:o.specific?.value,infraspecificEpithet:o.infrasp?.value,noMissing:!0};!r.genericName&&!r.infragenericEpithet&&
!r.specificEpithet&&!r.infraspecificEpithet&&(p=`\u201C${p}\u201D`);let g={colUri:l,acceptedColUri:c,humanReadable:p,authority:u,
status:f,latinName:r};l===o.acceptedcol?.value?s=g:t.add(g)}if(!s)throw new Error(`Could not get synonyms for CoL <${n}>\
 [missing acceptedcol]`);return{accepted:s,synonyms:t}}async function J(n,e,i){let a=`
PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
SELECT DISTINCT ?col ?acceptedcol ?status ?name ?authority ?rank ?kingdom ?generic ?infrag ?specific ?infrasp
WHERE {
    ?col dwc:parent+ <${n}> .
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
LIMIT 500`,d=await e.getSparqlResultSet(a,i,"getColSubtaxa");return new Set(d.results.bindings.map(s=>{let t=s.col?.value,
o=s.acceptedcol?.value,l=s.authority?.value,c=l?s.name?.value.replace(l,"").trimEnd():s.name?.value,u=s.status?.value;if(!t||
!o||!c||!u)return;let p={rank:s.rank?.value.toLocaleLowerCase(),kingdom:s.kingdom?.value,genericName:s.generic?.value,infragenericEpithet:s.
infrag?.value,specificEpithet:s.specific?.value,infraspecificEpithet:s.infrasp?.value,noMissing:!0};return!p.genericName&&
!p.infragenericEpithet&&!p.specificEpithet&&!p.infraspecificEpithet&&(c=`\u201C${c}\u201D`),{colUri:t,acceptedColUri:o,humanReadable:c,
authority:l,status:u,latinName:p}}).filter(s=>s!==void 0))}async function x(n,e,i,a){if(!n.genericName&&!n.infragenericEpithet&&
!n.specificEpithet&&!n.infraspecificEpithet)return console.log("skipping getPlaziFromName for empty name"),new Set;let d=`\

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
    ${n.rank?`?tn dwc:rank "${n.rank}" .`:""}
    ${n.genericName?`?tn dwc:genus "${n.genericName}" .`:n.noMissing?"FILTER NOT EXISTS { ?tn dwc:genus ?_generic . }":""}\

    ${n.infragenericEpithet?`?tn dwc:subGenus|dwc:section|dwc:series "${n.infragenericEpithet}" .`:n.noMissing&&!(e&&n.specificEpithet)?
"FILTER NOT EXISTS { ?tn dwc:subGenus|dwc:section|dwc:series ?_infrag . }":""}
    ${n.specificEpithet?`?tn dwc:species "${n.specificEpithet}" .`:n.noMissing?"FILTER NOT EXISTS { ?tn dwc:species ?_sp\
ecific . }":""}
    ${n.infraspecificEpithet?`?tn dwc:subSpecies|dwc:variety|dwc:form "${n.infraspecificEpithet}" .`:n.noMissing?"FILTER\
 NOT EXISTS { ?tn dwc:subSpecies|dwc:variety|dwc:form ?_infrasp . }":""}
    ${n.kingdom?`?tn dwc:kingdom "${n.kingdom}" .`:n.noMissing&&!e?"FILTER NOT EXISTS { ?tn dwc:kingdom ?_kingdom . }":""}\

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
LIMIT 500`,s=await i.getSparqlResultSet(d,a,"getPlaziFromName"),t=new Map;for(let o of s.results.bindings){let l=o.tn?.value;
if(!l)continue;let c=o.tc?.value,u=o.authorities?.value,p=!c||!u?void 0:{tcUri:c,authorities:u,defs:o.defs?.value,augs:o.
augs?.value,dprs:o.dprs?.value,cites:o.cites?.value},f=t.get(l);f?p&&f.authorized.push(p):t.set(l,{tnUri:l,authorized:p?
[p]:[],treats:o.tntreats?.value,cites:o.tncites?.value,latinName:{rank:o.rank?.value.toLocaleLowerCase(),kingdom:o.kingdom?.
value,genericName:o.generic?.value,infragenericEpithet:o.infrag?.value,specificEpithet:o.specific?.value,infraspecificEpithet:o.
infrasp?.value,noMissing:!0}})}return new Set(t.values())}async function Y(n,e,i){let a=`
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
    BIND(<${n}> AS ?tn)
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
LIMIT 500`,d=await e.getSparqlResultSet(a,i,"getNameFromTN"),s=new Map;for(let t of d.results.bindings){let o=t.tn?.value;
if(!o)continue;let l=t.tc?.value,c=t.authorities?.value,u=!l||!c?void 0:{tcUri:l,authorities:c,defs:t.defs?.value,augs:t.
augs?.value,dprs:t.dprs?.value,cites:t.cites?.value},p=s.get(o);p?u&&p.authorized.push(u):s.set(o,{tnUri:o,authorized:u?
[u]:[],treats:t.tntreats?.value,cites:t.tncites?.value,latinName:{rank:t.rank?.value.toLocaleLowerCase(),kingdom:t.kingdom?.
value,genericName:t.generic?.value,infragenericEpithet:t.infrag?.value,specificEpithet:t.specific?.value,infraspecificEpithet:t.
infrasp?.value,noMissing:!0}})}if(s.size!==1)throw new Error(`Got multiple latin names for ${n}`);return s.values().next().
value}async function V(n,e,i){let a=`
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
    <${n}> trt:hasTaxonName ?tn .
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
LIMIT 500`,d=await e.getSparqlResultSet(a,i,"getNameFromTC"),s=new Map;for(let t of d.results.bindings){let o=t.tn?.value;
if(!o)continue;let l=t.tc?.value,c=t.authorities?.value,u=!l||!c?void 0:{tcUri:l,authorities:c,defs:t.defs?.value,augs:t.
augs?.value,dprs:t.dprs?.value,cites:t.cites?.value},p=s.get(o);p?u&&p.authorized.push(u):s.set(o,{tnUri:o,authorized:u?
[u]:[],treats:t.tntreats?.value,cites:t.tncites?.value,latinName:{rank:t.rank?.value.toLocaleLowerCase(),kingdom:t.kingdom?.
value,genericName:t.generic?.value,infragenericEpithet:t.infrag?.value,specificEpithet:t.specific?.value,infraspecificEpithet:t.
infrasp?.value,noMissing:!0}})}if(s.size!==1)throw new Error(`Got multiple latin names for ${n}`);return s.values().next().
value}async function K(n,e,i){let a=`
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
    ?tn trt:hasParentName+ <${n}> .
    ?tn dwc:rank ?rank ;
       a dwcFP:TaxonName .
    OPTIONAL { ?tn dwc:kingdom ?kingdom . }
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
LIMIT 500`,d=await e.getSparqlResultSet(a,i,"getNameFromTN"),s=new Map;for(let t of d.results.bindings){let o=t.tn?.value;
if(!o)continue;let l=t.tc?.value,c=t.authorities?.value,u=!l||!c?void 0:{tcUri:l,authorities:c,defs:t.defs?.value,augs:t.
augs?.value,dprs:t.dprs?.value,cites:t.cites?.value},p=s.get(o);p?u&&p.authorized.push(u):s.set(o,{tnUri:o,authorized:u?
[u]:[],treats:t.tntreats?.value,cites:t.tncites?.value,latinName:{rank:t.rank?.value.toLocaleLowerCase(),kingdom:t.kingdom?.
value,genericName:t.generic?.value,infragenericEpithet:t.infrag?.value,specificEpithet:t.specific?.value,infraspecificEpithet:t.
infrasp?.value,noMissing:!0}})}return new Set(s.values())}function F(n,e){let i=n.split(/\s*[,]\s*/),a=e.split(/\s*[,]\s*/),d=i.length>0&&/\d{4}/.test(i.at(-1))?i.pop():null,s=a.
length>0&&/\d{4}/.test(a.at(-1))?a.pop():null,t=i.length>0&&/\s*et\.?\s*al\.?/.test(i.at(-1)),o=a.length>0&&/\s*et\.?\s*al\.?/.
test(a.at(-1));if(t&&(i[i.length-1]=i[i.length-1].replace(/\s*et\.?\s*al\.?/,"")),o&&(a[a.length-1]=a[a.length-1].replace(
/\s*et\.?\s*al\.?/,"")),!t&&!o&&i.length!=a.length)return null;let l=[],c=0;for(;c<i.length&&c<a.length;c++){let u=rt(i[c],
a[c]);if(u!==null)l.push(u);else return null}for(let u=c;u<i.length;u++)i[u]&&l.push(i[u]);for(let u=c;u<a.length;u++)a[u]&&
l.push(a[u]);if(d&&s)if(d===s)l.push(d);else return null;else d?l.push(d):s&&l.push(s);return l.join(", ")}var tt=/^(?:(?:\S\.\s*)*)?(\S+\.?)$/;
function rt(n,e){let i=tt.exec(n)?.[1],a=tt.exec(e)?.[1];return i&&a&&B(i,a)||B(n,e)}function B(n,e){let i=n.replaceAll(
"-"," "),a=e.replaceAll("-"," ");if(i.endsWith(".")||a.endsWith(".")){let d=i.normalize("NFKC"),s=a.normalize("NFKC"),t=d.
lastIndexOf("."),o=s.lastIndexOf("."),l=t!==-1?o!==-1?Math.min(t,o):t:o;(t===-1&&d.length>=s.length||o===-1&&s.length>=d.
length)&&(i=d.substring(0,l),a=s.substring(0,l))}if(ot(i,a)){let d=n.normalize("NFD"),s=e.normalize("NFD");return d.length>=
s.length?n:e}return null}function ot(n,e){return n.localeCompare(e,"en",{sensitivity:"base",usage:"search"})===0}var _=class{isFinished=!1;monitor=new EventTarget;controller=new AbortController;sparqlEndpoint;fetchOptions={signal:this.
controller.signal,cache:"force-cache"};names=[];pushName(e){this.names.push(e),this.monitor.dispatchEvent(new CustomEvent(
"updated"))}finish(){this.isFinished=!0,this.monitor.dispatchEvent(new CustomEvent("updated"))}expanded=new Set;acceptedCol=new Map;treatments=new Map;ignoreDeprecatedCoL;startWithSubTaxa;noSynonyms;constructor(e,i,a=!0,d=!1,s=!1){
if(this.sparqlEndpoint=e,this.ignoreDeprecatedCoL=a,this.startWithSubTaxa=d,this.noSynonyms=s,i.startsWith("https://www.\
catalogueoflife.org/"))this.handleColQuery(i,{searchTerm:!0,subTaxon:!1}).catch(t=>{console.log("SynoGroup Failure: ",t),
this.controller.abort("SynoGroup Failed")}).finally(()=>this.finish());else if(i.startsWith("http://taxon-concept.plazi.\
org/id/"))this.tcSynonyms(i,{searchTerm:!0,subTaxon:!1}).catch(t=>{console.log("SynoGroup Failure: ",t),this.controller.
abort("SynoGroup Failed")}).finally(()=>this.finish());else if(i.startsWith("http://taxon-name.plazi.org/id/"))this.tnSynonyms(
i,{searchTerm:!0,subTaxon:!1}).catch(t=>{console.log("SynoGroup Failure: ",t),this.controller.abort("SynoGroup Failed")}).
finally(()=>this.finish());else{let t=/^(\w+)(?:\s+\((\w+)\))?(?:\s+×?\s*(\w+)(?:(?:\s+\w+\.\s*\w*)*?\s+(\w+))?)?$/.exec(
i);if(t===null){console.log("SynoGroup Failure: Could not parse",i),this.controller.abort("SynoGroup Failed"),this.finish();
return}let o={genericName:t[1],infragenericEpithet:t[2],specificEpithet:t[3],infraspecificEpithet:t[4],noMissing:!0};this.
handleLatinName(o,{searchTerm:!0,subTaxon:!1}).catch(l=>{console.log("SynoGroup Failure: ",l),this.controller.abort("Syn\
oGroup Failed")}).finally(()=>this.finish())}}async handleLatinName(e,i){let a=L(e);if(this.expanded.has(a)){console.log(
`Skipping known (${a})`);return}if(console.debug(`synogroup: lnSynonyms ${a}`),this.controller.signal?.aborted)return Promise.
reject();this.expanded.add(a);let[d,s]=await Promise.all([D(e,i.searchTerm,this.sparqlEndpoint,this.fetchOptions),x(e,i.
searchTerm,this.sparqlEndpoint,this.fetchOptions)]);await this.handleColAndPlaziResult(d,s,a,i)}async handleColQuery(e,i){
let a=e;if(this.expanded.has(a)){console.log(`Skipping known (${a})`);return}if(console.debug(`synogroup: col ${a}`),this.
controller.signal?.aborted)return Promise.reject();this.expanded.add(a);let d=await Z(e,this.sparqlEndpoint,this.fetchOptions),
s=await x(d.latinName,!1,this.sparqlEndpoint,this.fetchOptions);await this.handleColAndPlaziResult(new Set([d]),s,a,i)}async handleColAndPlaziResult(e,i,a,d){
console.debug(`synogroup: handling ${a}`);let s=[],t=[],o=new Set,l=new Map,c=new Map;for(let f of e){let r=L(f.latinName),
g=l.get(r);g?g.add(f):(o.add(r),l.set(r,new Set([f])))}for(let f of i){let r=L(f.latinName);c.has(r)&&console.warn("Foun\
d duplicate Plazi-LN: ${key}"),o.add(r),c.set(r,f)}for(let f of o){if(f!=a&&this.expanded.has(f)){console.log(`Skipping \
known (${f})`);continue}this.expanded.add(f);let r=c.get(f),g=l.get(f),m=[],N,I=[],P,w,S;if(g)for(let h of g.values()){let y=h.
colUri;P||(P=h.latinName.kingdom),w||(w=h.humanReadable),S||(S=h.latinName.rank),h.authority?I.find(k=>k.col?.colURI===y)||
I.push({displayName:h.humanReadable,authority:h.authority,authorities:[h.authority],col:{colURI:y,status:h.status,acceptedURI:h.
acceptedColUri},taxonConceptURIs:[],treatments:{def:new Set,aug:new Set,dpr:new Set,cite:new Set}}):(N&&N.colURI!==y&&console.
log("Duplicate unathorized COL:",y),N={colURI:y,status:h.status,acceptedURI:h.acceptedColUri})}if(r){w||(w=W(r.latinName));
for(let h of r.authorized){let y=this.makeTreatmentSet(h.defs?.split("|")),k=this.makeTreatmentSet(h.augs?.split("|")),M=this.
makeTreatmentSet(h.dprs?.split("|")),X=this.makeTreatmentSet(h.cites?.split("|"));y.forEach(C=>m.push(C)),k.forEach(C=>m.
push(C)),M.forEach(C=>m.push(C));let U=h.authorities.split(" / ").reduce((C,G)=>F(C,G)??C+" / "+G),E=I.find(C=>F(C.authority,
U)!==null);E?(E.authority=F(E.authority,U),E.authorities.push(...h.authorities.split(" / ")),E.taxonConceptURIs.push(h.tcUri),
E.treatments={def:E.treatments.def.union(y),aug:E.treatments.aug.union(k),dpr:E.treatments.dpr.union(M),cite:E.treatments.
cite.union(X)}):I.push({displayName:w,authority:U,authorities:h.authorities.split(" / "),taxonConceptURIs:[h.tcUri],treatments:{
def:y,aug:k,dpr:M,cite:X}})}}w||(w=f);let R=r?.treats?this.makeTreatmentSet(r.treats.split("|")):new Set;R.forEach(h=>m.
push(h));let O={kingdom:P??r?.latinName.kingdom??"",displayName:w,rank:S??r?.latinName.rank??"",vernacularNames:r?this.getVernacular(
r.tnUri):Promise.resolve(new Map),taxonNameURI:r?.tnUri,col:N,authorizedNames:I,justification:d,treatments:{treats:R,cite:r?.
cites?this.makeTreatmentSet(r.cites.split("|")):new Set}};this.pushName(O),N&&(t.push(this.findColSynonyms(N.acceptedURI,
{searchTerm:!1,parent:O})),this.startWithSubTaxa&&d.searchTerm&&!d.subTaxon&&t.push(this.findColSubtaxa(N.colURI))),r&&this.
startWithSubTaxa&&d.searchTerm&&!d.subTaxon&&t.push(this.findTnSubtaxa(r.tnUri));for(let h of I)h.col&&(t.push(this.findColSynonyms(
h.col.acceptedURI,{searchTerm:!1,parent:O})),this.startWithSubTaxa&&d.searchTerm&&!d.subTaxon&&t.push(this.findColSubtaxa(
h.col.colURI)));s.push(...m.map(h=>h.details.then(y=>[O,h,y])))}let u=new Map,p=new Map;(await Promise.all(s)).map(([f,r,
g])=>{g.treats.aug.difference(this.expanded).forEach(m=>u.set(m,[f,r])),g.treats.def.difference(this.expanded).forEach(m=>u.
set(m,[f,r])),g.treats.dpr.difference(this.expanded).forEach(m=>u.set(m,[f,r])),g.treats.treattn.difference(this.expanded).
forEach(m=>p.set(m,[f,r]))}),await Promise.allSettled([...[...u].map(([f,[r,g]])=>this.tcSynonyms(f,{searchTerm:!1,parent:r,
treatment:g})),...[...p].map(([f,[r,g]])=>this.tnSynonyms(f,{searchTerm:!1,parent:r,treatment:g})),...t])}async tcSynonyms(e,i){
if(this.noSynonyms&&!i.searchTerm)return;console.debug(`synogroup: tcSynonyms ${e}`),this.expanded.add(e);let a=await V(
e,this.sparqlEndpoint,this.fetchOptions),d=await D(a.latinName,!1,this.sparqlEndpoint,this.fetchOptions);return this.handleColAndPlaziResult(
d,new Set([a]),e,i)}async tnSynonyms(e,i){if(this.noSynonyms&&!i.searchTerm)return;console.debug(`synogroup: tnSynonyms ${e}`),
this.expanded.add(e);let a=await Y(e,this.sparqlEndpoint,this.fetchOptions),d=await D(a.latinName,!1,this.sparqlEndpoint,
this.fetchOptions);return this.handleColAndPlaziResult(d,new Set([a]),e,i)}async findTnSubtaxa(e){console.debug(`synogro\
up: tnSubtaxa ${e}`);let i=await K(e,this.sparqlEndpoint,this.fetchOptions),a=[],d=new Set;for(let t of i){let o=L(t.latinName);
d.has(o)||(d.add(o),a.push(D(t.latinName,!1,this.sparqlEndpoint,this.fetchOptions)))}let s=await Promise.all(a);return await this.
handleColAndPlaziResult(s.reduce((t,o)=>t.union(o),new Set),i,"",{searchTerm:!0,subTaxon:!0})}findName(e){let i;for(let a of this.
names){if(a.taxonNameURI===e||a.col?.colURI===e){i=a;break}let d=a.authorizedNames.find(s=>s.col?.colURI===e||s.taxonConceptURIs.
includes(e));if(d){i=d;break}}return i?Promise.resolve(i):new Promise((a,d)=>{this.monitor.addEventListener("updated",()=>{
(this.names.length===0||this.isFinished)&&d();let s=this.names.at(-1);if(s.taxonNameURI===e||s.col?.colURI===e){a(s);return}
let t=s.authorizedNames.find(o=>o.col?.colURI===e||o.taxonConceptURIs.includes(e));if(t){a(t);return}})})}async findColSynonyms(e,i){
if(this.noSynonyms&&!i.searchTerm)return[];if(this.acceptedCol.has(e))return[];console.debug(`synogroup: colSynonyms ${e}`);
let a=[];try{let{accepted:d,synonyms:s}=await j(e,this.sparqlEndpoint,this.fetchOptions),t=[],o=new Set;if(!this.acceptedCol.
has(d.colUri)){this.acceptedCol.set(d.colUri,d.colUri);let c=i.searchTerm&&e===d.colUri;if(!this.noSynonyms||c){let u=L(
d.latinName);o.has(u)||(o.add(u),t.push(x(d.latinName,c,this.sparqlEndpoint,this.fetchOptions)))}}for(let c of s){this.acceptedCol.
set(c.colUri,d.colUri);let u=i.searchTerm&&e===c.colUri;if(u||!this.ignoreDeprecatedCoL&&!this.noSynonyms){let p=L(c.latinName);
o.has(p)||(o.add(p),t.push(x(c.latinName,u,this.sparqlEndpoint,this.fetchOptions)))}}let l=await Promise.all(t);a.push(this.
handleColAndPlaziResult(s.add(d),l.reduce((c,u)=>c.union(u)),e,i)),this.acceptedCol.has(e)||this.acceptedCol.set(e,e)}catch{
this.acceptedCol.has(e)||this.acceptedCol.set(e,"INVALID COL")}return Promise.all(a)}async findColSubtaxa(e){console.debug(
`synogroup: colSubtaxa ${e}`);let i=await J(e,this.sparqlEndpoint,this.fetchOptions),a=[],d=new Set;for(let t of i){let o=L(
t.latinName);d.has(o)||(d.add(o),a.push(x(t.latinName,!1,this.sparqlEndpoint,this.fetchOptions)))}let s=await Promise.all(
a);return await this.handleColAndPlaziResult(i,s.reduce((t,o)=>t.union(o),new Set),"",{searchTerm:!0,subTaxon:!0})}async getVernacular(e){
let i=new Map,a=`SELECT DISTINCT ?n WHERE { <${e}> <http://rs.tdwg.org/dwc/terms/vernacularName> ?n . }`,d=(await this.sparqlEndpoint.
getSparqlResultSet(a,this.fetchOptions,`Vernacular ${e}`)).results.bindings;for(let s of d)s.n?.value&&(s.n["xml:lang"]?
i.has(s.n["xml:lang"])?i.get(s.n["xml:lang"]).push(s.n.value):i.set(s.n["xml:lang"],[s.n.value]):i.has("??")?i.get("??").
push(s.n.value):i.set("??",[s.n.value]));return i}makeTreatmentSet(e){return e?new Set(e.filter(i=>!!i).map(i=>{let[a,d]=i.
split(">");if(!this.treatments.has(a)){let s=this.getTreatmentDetails(a);this.treatments.set(a,{url:a,date:d?parseInt(d,
10):void 0,details:s})}return this.treatments.get(a)})):new Set}async getTreatmentDetails(e){let i=`
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
aug:new Set,dpr:new Set,citetc:new Set,treattn:new Set,citetn:new Set}};try{let a=await this.sparqlEndpoint.getSparqlResultSet(
i,this.fetchOptions,`TreatmentDetails ${e}`),d=a.results.bindings.filter(l=>l.mc&&l.catalogNumbers?.value).map(l=>{let c=l.
httpUris?.value?.split("|");return{catalogNumber:l.catalogNumbers.value,collectionCode:l.collectionCodes?.value||void 0,
typeStatus:l.typeStatuss?.value||void 0,countryCode:l.countryCodes?.value||void 0,stateProvince:l.stateProvinces?.value||
void 0,municipality:l.municipalitys?.value||void 0,county:l.countys?.value||void 0,locality:l.localitys?.value||void 0,verbatimLocality:l.
verbatimLocalitys?.value||void 0,recordedBy:l.recordedBys?.value||void 0,eventDate:l.eventDates?.value||void 0,samplingProtocol:l.
samplingProtocols?.value||void 0,decimalLatitude:l.decimalLatitudes?.value||void 0,decimalLongitude:l.decimalLongitudes?.
value||void 0,verbatimElevation:l.verbatimElevations?.value||void 0,gbifOccurrenceId:l.gbifOccurrenceIds?.value||void 0,
gbifSpecimenId:l.gbifSpecimenIds?.value||void 0,httpUri:c?.length?c:void 0}}),s=`
PREFIX cito: <http://purl.org/spar/cito/>
PREFIX fabio: <http://purl.org/spar/fabio/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?url ?description WHERE {
  <${e}> cito:cites ?cites .
  ?cites a fabio:Figure ;
  fabio:hasRepresentation ?url .
  OPTIONAL { ?cites dc:description ?description . }
} `,o=(await this.sparqlEndpoint.getSparqlResultSet(s,this.fetchOptions,`TreatmentDetails/Figures ${e}`)).results.bindings.
filter(l=>l.url?.value).map(l=>({url:l.url.value,description:l.description?.value}));return{creators:a.results.bindings[0]?.
creators?.value,title:a.results.bindings[0]?.title?.value,materialCitations:d,figureCitations:o,treats:{def:new Set(a.results.
bindings[0]?.defs?.value?a.results.bindings[0].defs.value.split("|"):void 0),aug:new Set(a.results.bindings[0]?.augs?.value?
a.results.bindings[0].augs.value.split("|"):void 0),dpr:new Set(a.results.bindings[0]?.dprs?.value?a.results.bindings[0].
dprs.value.split("|"):void 0),citetc:new Set(a.results.bindings[0]?.cites?.value?a.results.bindings[0].cites.value.split(
"|"):void 0),treattn:new Set(a.results.bindings[0]?.trttns?.value?a.results.bindings[0].trttns.value.split("|"):void 0),
citetn:new Set(a.results.bindings[0]?.citetns?.value?a.results.bindings[0].citetns.value.split("|"):void 0)}}}catch(a){return console.
warn("SPARQL Error: "+a),{materialCitations:[],figureCitations:[],treats:{def:new Set,aug:new Set,dpr:new Set,citetc:new Set,
treattn:new Set,citetn:new Set}}}}[Symbol.asyncIterator](){let e=0;return{next:()=>new Promise((i,a)=>{let d=()=>{if(this.
controller.signal.aborted)a(new Error("SynyonymGroup has been aborted"));else if(e<this.names.length)i({value:this.names[e++]});else if(this.
isFinished)i({done:!0,value:!0});else{let s=()=>{this.monitor.removeEventListener("updated",s),d()};this.monitor.addEventListener(
"updated",s)}};d()})}}};function et(n){let e=new Set(n);return Array.from(e)}var b=new URLSearchParams(document.location.search),ct=!b.has("show_col"),lt=b.has("nosynonyms"),dt=b.has("subtaxa"),pt=b.
has("sort_treatments_by_type"),ut=b.get("server")||"https://treatment.ld.plazi.org/sparql",nt=b.get("q")||"https://www.c\
atalogueoflife.org/data/taxon/3WD9M",H=document.getElementById("root");var T={def:'<svg class="green" viewBox="0 -960 960 960"><path fill="currentcolor" d="M444-288h72v-156h156v-72H516v-156h-\
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
177-51 51Z"/></svg>',empty:'<svg viewBox="0 -960 960 960"></svg>'},q=document.createElement("div");H.insertAdjacentElement(
"beforebegin",q);q.append(`Finding Synonyms for ${nt} `);var gt=document.createElement("progress");q.append(gt);var mt=performance.
now(),ft=new z(ut),v=new _(ft,nt,ct,dt,lt),A=class extends HTMLElement{constructor(e,i){super(),this.innerHTML=T[i]??T.unknown;
let a=document.createElement("button");a.classList.add("icon","button"),a.innerHTML=T.expand,a.addEventListener("click",
()=>{this.classList.toggle("expanded")?a.innerHTML=T.collapse:a.innerHTML=T.expand});let d=document.createElement("span");
e.date?d.innerText=""+e.date:(d.classList.add("missing"),d.innerText="No Date"),this.append(d);let s=document.createElement(
"progress");this.append(": ",s);let t=document.createElement("a");t.classList.add("treatment","uri"),t.href=e.url,t.target=
"_blank",t.innerText=e.url.replace("http://treatment.plazi.org/id/",""),t.innerHTML+=T.link,this.append(" ",t),this.append(
a);let o=document.createElement("div");o.classList.add("indent","details"),this.append(o),e.details.then(l=>{let c=document.
createElement("span"),u=document.createElement("i");if(s.replaceWith(c," ",u),l.creators?c.innerText=l.creators:(c.classList.
add("missing"),c.innerText="No Authors"),l.title?u.innerText="\u201C"+l.title+"\u201D":(u.classList.add("missing"),u.innerText=
"No Title"),l.treats.def.size>0){let p=document.createElement("div");p.innerHTML=T.east,p.innerHTML+=T.def,(i==="def"||i===
"cite")&&p.classList.add("hidden"),o.append(p),l.treats.def.forEach(f=>{let r=document.createElement("a");r.classList.add(
"taxon","uri");let g=f.replace("http://taxon-concept.plazi.org/id/","");r.innerText=g,r.href="#"+g,r.title="show name",p.
append(" ",r),v.findName(f).then(m=>{r.classList.remove("uri"),m.authority?r.innerText=m.displayName+" "+m.authority:r.innerText=
m.displayName},()=>{r.removeAttribute("href")})})}if(l.treats.aug.size>0||l.treats.treattn.size>0){let p=document.createElement(
"div");p.innerHTML=T.east,p.innerHTML+=T.aug,(i==="aug"||i==="cite")&&p.classList.add("hidden"),o.append(p),l.treats.aug.
forEach(f=>{let r=document.createElement("a");r.classList.add("taxon","uri");let g=f.replace("http://taxon-concept.plazi\
.org/id/","");r.innerText=g,r.href="#"+g,r.title="show name",p.append(" ",r),v.findName(f).then(m=>{r.classList.remove("\
uri"),m.authority?r.innerText=m.displayName+" "+m.authority:r.innerText=m.displayName},()=>{r.removeAttribute("href")})}),
l.treats.treattn.forEach(f=>{let r=document.createElement("a");r.classList.add("taxon","uri");let g=f.replace("http://ta\
xon-name.plazi.org/id/","");r.innerText=g,r.href="#"+g,r.title="show name",p.append(" ",r),v.findName(f).then(m=>{r.classList.
remove("uri"),m.authority?r.innerText=m.displayName+" "+m.authority:r.innerText=m.displayName},()=>{r.removeAttribute("h\
ref")})})}if(l.treats.dpr.size>0){let p=document.createElement("div");p.innerHTML=T.west,p.innerHTML+=T.dpr,(i==="dpr"||
i==="cite")&&p.classList.add("hidden"),o.append(p),l.treats.dpr.forEach(f=>{let r=document.createElement("a");r.classList.
add("taxon","uri");let g=f.replace("http://taxon-concept.plazi.org/id/","");r.innerText=g,r.href="#"+g,r.title="show nam\
e",p.append(" ",r),v.findName(f).then(m=>{r.classList.remove("uri"),m.authority?r.innerText=m.displayName+" "+m.authority:
r.innerText=m.displayName},()=>{r.removeAttribute("href")})})}if(l.treats.citetc.size>0||l.treats.citetn.size>0){let p=document.
createElement("div");p.innerHTML=T.empty+T.cite,p.classList.add("hidden"),o.append(p),l.treats.citetc.forEach(f=>{let r=document.
createElement("a");r.classList.add("taxon","uri");let g=f.replace("http://taxon-concept.plazi.org/id/","");r.innerText=g,
r.href="#"+g,r.title="show name",p.append(" ",r),v.findName(f).then(m=>{r.classList.remove("uri"),m.authority?r.innerText=
m.displayName+" "+m.authority:r.innerText=m.displayName},()=>{r.removeAttribute("href")})}),l.treats.citetn.forEach(f=>{
let r=document.createElement("a");r.classList.add("taxon","uri");let g=f.replace("http://taxon-name.plazi.org/id/","");r.
innerText=g,r.href="#"+g,r.title="show name",p.append(" ",r),v.findName(f).then(m=>{r.classList.remove("uri"),m.authority?
r.innerText=m.displayName+" "+m.authority:r.innerText=m.displayName},()=>{r.removeAttribute("href")})})}if(l.figureCitations.
length>0){let p=document.createElement("div");p.classList.add("figures","hidden"),o.append(p);for(let f of l.figureCitations){
let r=document.createElement("figure");p.append(r);let g=document.createElement("img");g.src=f.url,g.loading="lazy",g.alt=
f.description??"Cited Figure without caption",r.append(g);let m=document.createElement("figcaption");m.innerText=f.description??
"",r.append(m)}}if(l.materialCitations.length>0){let p=document.createElement("div");p.innerHTML=T.empty+T.cite+" Materi\
al Citations:<br> -",p.classList.add("hidden"),o.append(p),p.innerText+=l.materialCitations.map(f=>JSON.stringify(f).replaceAll(
"{","").replaceAll("}","").replaceAll('":',": ").replaceAll(",",", ").replaceAll('"',"")).join(`
 -`)}})}};customElements.define("syno-treatment",A);var $=class extends HTMLElement{constructor(e){super();let i=document.
createElement("h2"),a=document.createElement("i");a.innerText=e.displayName,i.append(a),this.append(i);let d=document.createElement(
"span");d.classList.add("rank"),d.innerText=e.rank;let s=document.createElement("span");if(s.classList.add("rank"),s.innerText=
e.kingdom||"Missing Kingdom",i.append(" ",s," ",d),e.taxonNameURI){let c=document.createElement("a");c.classList.add("ta\
xon","uri");let u=e.taxonNameURI.replace("http://taxon-name.plazi.org/id/","");c.innerText=u,c.id=u,c.href=e.taxonNameURI,
c.target="_blank",c.innerHTML+=T.link,i.append(" ",c)}let t=document.createElement("div");t.classList.add("vernacular"),
e.vernacularNames.then(c=>{c.size>0&&(t.innerText="\u201C"+et([...c.values()].flat()).join("\u201D, \u201C")+"\u201D")}),
this.append(t);let o=document.createElement("ul");if(this.append(o),e.col){let c=document.createElement("a");c.classList.
add("col","uri");let u=e.col.colURI.replace("https://www.catalogueoflife.org/data/taxon/","");c.innerText=u,c.id=u,c.href=
e.col.colURI,c.target="_blank",c.innerHTML+=T.link,i.append(" ",c);let p=document.createElement("div");p.classList.add("\
treatmentline"),p.innerHTML=e.col.acceptedURI!==e.col.colURI?T.col_dpr:T.col_aug,o.append(p);let f=document.createElement(
"span");f.innerText=`Catalogue of Life: ${e.col.status}`,p.append(f);let r=document.createElement("div");if(r.classList.
add("indent"),p.append(r),e.col.acceptedURI!==e.col.colURI){let g=document.createElement("div");g.innerHTML=T.east+T.col_aug,
r.append(g);let m=document.createElement("a");m.classList.add("col","uri");let N=e.col.acceptedURI.replace("https://www.\
catalogueoflife.org/data/taxon/","");m.innerText=N,m.href=`#${N}`,m.title="show name",g.append(m),v.findName(e.col.acceptedURI).
then(I=>{I.authority?m.innerText=I.displayName+" "+I.authority:m.innerText=I.displayName},()=>{m.removeAttribute("href")})}}
if(e.treatments.treats.size>0||e.treatments.cite.size>0){for(let c of e.treatments.treats){let u=new A(c,"aug");o.append(
u)}for(let c of e.treatments.cite){let u=new A(c,"cite");o.append(u)}}let l=document.createElement("abbr");l.classList.add(
"justification"),l.innerText="...?",Q(e).then(c=>l.title=`This ${c}`),i.append(" ",l);for(let c of e.authorizedNames){let u=document.
createElement("h3"),p=document.createElement("i");p.innerText=c.displayName,p.classList.add("gray"),u.append(p),u.append(
" ",c.authority),this.append(u);let f=document.createElement("ul");if(this.append(f),c.taxonConceptURIs[0]){let g=document.
createElement("a");g.classList.add("taxon","uri");let m=c.taxonConceptURIs[0].replace("http://taxon-concept.plazi.org/id\
/","");g.innerText=m,g.id=m,g.href=c.taxonConceptURIs[0],g.target="_blank",g.innerHTML+=T.link,u.append(" ",g)}if(c.col){
let g=document.createElement("a");g.classList.add("col","uri");let m=c.col.colURI.replace("https://www.catalogueoflife.o\
rg/data/taxon/","");g.innerText=m,g.id=m,g.href=c.col.colURI,g.target="_blank",g.innerHTML+=T.link,u.append(" ",g);let N=document.
createElement("div");N.classList.add("treatmentline"),N.innerHTML=c.col.acceptedURI!==c.col.colURI?T.col_dpr:T.col_aug,f.
append(N);let I=document.createElement("span");I.innerText=`Catalogue of Life: ${c.col.status}`,N.append(I);let P=document.
createElement("div");if(P.classList.add("indent"),N.append(P),c.col.acceptedURI!==c.col.colURI){let w=document.createElement(
"div");w.innerHTML=T.east+T.col_aug,P.append(w);let S=document.createElement("a");S.classList.add("col","uri");let R=c.col.
acceptedURI.replace("https://www.catalogueoflife.org/data/taxon/","");S.innerText=R,S.href=`#${R}`,S.title="show name",w.
append(" ",S),v.findName(c.col.acceptedURI).then(O=>{S.classList.remove("uri"),O.authority?S.innerText=O.displayName+" "+
O.authority:S.innerText=O.displayName},()=>{S.removeAttribute("href")})}}let r=[];for(let g of c.treatments.def)r.push({
trt:g,status:"def"});for(let g of c.treatments.aug)r.push({trt:g,status:"aug"});for(let g of c.treatments.dpr)r.push({trt:g,
status:"dpr"});for(let g of c.treatments.cite)r.push({trt:g,status:"cite"});pt||r.sort((g,m)=>g.trt.date&&m.trt.date?g.trt.
date-m.trt.date:g.trt.date?1:m.trt.date?-1:0);for(let{trt:g,status:m}of r){let N=new A(g,m);f.append(N)}}}};customElements.
define("syno-name",$);async function Q(n){if(n.justification.searchTerm)return n.justification.subTaxon?"is a sub-taxon \
of the search term.":"is the search term.";if(n.justification.treatment){let e=await n.justification.treatment.details,i=await Q(
n.justification.parent);return`is, according to ${e.creators} ${n.justification.treatment.date},
     a synonym of ${n.justification.parent.displayName} which ${i}`}else{let e=await Q(n.justification.parent);return`is\
, according to the Catalogue of Life,
     a synonym of ${n.justification.parent.displayName} which ${e}`}}for await(let n of v){let e=new $(n);H.append(e)}var ht=performance.
now();q.innerHTML="";q.innerText=`Found ${v.names.length} names with ${v.treatments.size} treatments. This took ${(ht-mt)/
1e3} seconds.`;v.names.length===0&&H.append(":[");
//# sourceMappingURL=index.js.map
