# Design

> [!NOTE] This currently (2024-07-27) describes a potential future design, not
> the current one.

## Overview

The central taxonomic entity is one object `N` per latin name.\
Synolib returns as results a list of `N`s.

Each `N` exists because of a taxon-name, taxon-concept or col-taxon in the
data.\
Each `N` is uniquely determined by its human-readable latin name (for taxa ranking below genus, this is a multi-part name — binomial or trinomial) and kingdom.\
Each `N` contains `N+A` objects which represent latin names with an authority.\
Each `N` contains, if present, `treatment`s directly associated with the
respective taxon-name.\
Other metadata (if present) of a `N` are the list of its parent names (family,
order, ...); vernacular names; and taxon-name URI.

Each `N+A` exists because of a taxon-concept or col-taxon in the data. It always
has a parent `N`.\
Each `N+A` is uniquely determined by its human-readable latin name (as above), kingdom and (normalized [^1])
authority.\
Each `N+A` contains, if present, `treatment`s directly associated with the
respective taxon-concept.\
Other metadata (if present) of a `N` are CoL IDs; and taxon-concept URI.

A `treatment` exists because it is in the data, and is identifed by its RDF
URI.\
A `treatment` may _define_, _augment_, _deprecate_ or _cite_ a `N+A`, and _treat_
or _cite_ a `N`.\
If a `treatment` does _define_, _augment_, _deprecate_ or _treat_ different `N`
and/or `N+A`s, they are considered synonyms.\
Note that _cite_ does not create synonmic links.\
Other metadata of a `treatment` are its authors, material citations, and images.

Starting point of the algorithm is a latin name or the URI of either a taxon-name, tacon-conecpt or col-taxon.\
It will first try to find the respective `N` and all associated metadata, `N+A`s
and `treatment`s.\
This `N` is the first result.\
Then it will recursively use all synonyms indicated by the found `treatment`s to
find new `N`s.\
For each new `N`, it will find all associated metadata, `N+A`s and `treatment`s;
and return it as the next result.\
Then it will continue to expand recursively until no more new `N`s are found.

The algorithm keeps track of which treatment links it followed and other reasons
it added a `N` to the results.\
This "justification" is also proved as metadata of a `N`.


[^1]: I.e. ignoring differences in punctuation, diacritics, capitalization and such.