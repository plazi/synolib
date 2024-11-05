/**
 * Common to all of the `getNameFrom_`-queries.
 *
 * As its own variable to ensure consistency in the resturned bindings.
 */
const preamble = `PREFIX dc: <http://purl.org/dc/elements/1.1/>
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
  (group_concat(DISTINCT ?citetn;separator="|") as ?tncites)`;

/**
 * Common to all of the `getNameFrom_`-queries.
 *
 * As its own variable to ensure consistency in the resturned bindings.
 */
const postamble =
  `GROUP BY ?tn ?tc ?col ?rank ?genus ?species ?infrasp ?name ?authority`;

// For unclear reasons, the queries breaks if the limit is removed.

/**
 * Note: this query assumes that there is no sub-species taxa with missing dwc:species
 *
 * Note: the handling assumes that at most one taxon-name matches this colTaxon
 */
export const getNameFromCol = (colUri: string) =>
  `${preamble} WHERE {
BIND(<${colUri}> as ?col)
  ?col dwc:taxonRank ?rank .
  OPTIONAL { ?col dwc:scientificNameAuthorship ?colAuth . } BIND(COALESCE(?colAuth, "") as ?authority)
  ?col dwc:scientificName ?name .
  ?col dwc:genericName ?genus .
  # TODO # ?col dwc:parent* ?p . ?p dwc:rank "kingdom" ; dwc:taxonName ?kingdom .
  OPTIONAL {
    ?col dwc:specificEpithet ?species .
    OPTIONAL { ?col dwc:infraspecificEpithet ?infrasp . }
  }

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
${postamble}
LIMIT 500`;

/**
 * Note: this query assumes that there is no sub-species taxa with missing dwc:species
 *
 * Note: the handling assumes that at most one taxon-name matches this colTaxon
 */
export const getNameFromTC = (tcUri: string) =>
  `${preamble} WHERE {
  <${tcUri}> trt:hasTaxonName ?tn .
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
  
  BIND(COALESCE(?fullName, CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), COALESCE(CONCAT(" ", ?infrasp), ""))) as ?name)
  BIND(COALESCE(?colAuth, "") as ?authority)

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
${postamble}
LIMIT 500`;

/**
 * Note: this query assumes that there is no sub-species taxa with missing dwc:species
 *
 * Note: the handling assumes that at most one taxon-name matches this colTaxon
 */
export const getNameFromTN = (tnUri: string) =>
  `${preamble} WHERE {
  BIND(<${tnUri}> as ?tn)
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
  
  BIND(COALESCE(?fullName, CONCAT(?genus, COALESCE(CONCAT(" (",?subgenus,")"), ""), COALESCE(CONCAT(" ",?species), ""), COALESCE(CONCAT(" ", ?infrasp), ""))) as ?name)
  BIND(COALESCE(?colAuth, "") as ?authority)

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
${postamble}
LIMIT 500`;
