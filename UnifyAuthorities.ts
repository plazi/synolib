export function unifyAuthorithy(a: string, b: string): string | null {
  const as = a.split(/\s*[,]\s*/);
  const bs = b.split(/\s*[,]\s*/);
  const yearA = (as.length > 0 && /\d{4}/.test(as.at(-1)!)) ? as.pop()! : null;
  const yearB = (bs.length > 0 && /\d{4}/.test(bs.at(-1)!)) ? bs.pop()! : null;
  const etalA = as.length > 0 && /\s*et\.?\s*al\.?/.test(as.at(-1)!);
  const etalB = bs.length > 0 && /\s*et\.?\s*al\.?/.test(bs.at(-1)!);
  if (etalA) {
    as[as.length - 1] = as[as.length - 1].replace(/\s*et\.?\s*al\.?/, "");
  }
  if (etalB) {
    bs[bs.length - 1] = bs[bs.length - 1].replace(/\s*et\.?\s*al\.?/, "");
  }

  if (!etalA && !etalB && as.length != bs.length) return null;

  const result: string[] = [];
  let i = 0;
  for (; i < as.length && i < bs.length; i++) {
    const r = unifySingleName(as[i], bs[i]);
    if (r !== null) result.push(r);
    else return null;
  }
  for (let j = i; j < as.length; j++) {
    if (as[j]) result.push(as[j]);
  }
  for (let j = i; j < bs.length; j++) {
    if (bs[j]) result.push(bs[j]);
  }

  if (yearA && yearB) {
    if (yearA === yearB) result.push(yearA);
    else return null;
  } else if (yearA) {
    result.push(yearA);
  } else if (yearB) {
    result.push(yearB);
  }

  return result.join(", ");
}

function unifySingleName(a: string, b: string) {
  let prefixA = a.replaceAll("-", " ");
  let prefixB = b.replaceAll("-", " ");
  if (prefixA.endsWith(".") || prefixB.endsWith(".")) {
    // might be abbreviation
    // normalize to get compatible string lengths
    const longA = prefixA.normalize("NFKC");
    const longB = prefixB.normalize("NFKC");
    const indexA = longA.lastIndexOf(".");
    const indexB = longB.lastIndexOf(".");
    const index = indexA !== -1
      ? (indexB !== -1 ? Math.min(indexA, indexB) : indexA)
      : indexB;
    prefixA = longA.substring(0, index);
    prefixB = longB.substring(0, index);
  }

  if (isEquivalent(prefixA, prefixB)) {
    // normalize such that accents are represented with combining characters
    // so that the version with accents is longer
    const normA = a.normalize("NFD");
    const normB = b.normalize("NFD");
    return normA.length >= normB.length ? a : b;
  }
  return null;
}

function isEquivalent(a: string, b: string): boolean {
  return a.localeCompare(b, "en", {
    sensitivity: "base", // a = ä, A = a, a ≠ b
    usage: "search",
  }) === 0;
}
