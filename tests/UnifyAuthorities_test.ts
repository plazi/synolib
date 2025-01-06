import { unifyAuthorithy } from "../UnifyAuthorities.ts";
import { assertEquals } from "jsr:@std/assert";

const unify_tests: [string, string, string][] = [
  ["Bolívar, 1893", "Bolivar, 1893", "Bolívar, 1893"],
  ["García-Aldrete, 2009", "Garcia Aldrete, 2009", "García-Aldrete, 2009"],
  ["Kulczyński, 1901", "Kulczynski, 1901", "Kulczyński, 1901"],
  ["(Kulczyński, 1903)", "(Kulczynski, 1903)", "(Kulczyński, 1903)"],
  ["Mello-Leitão, 1942", "Mello-Leitao, 1942", "Mello-Leitão, 1942"],
  // ["Quatrefages, 1842", "de Quatrefages, 1842", "Quatrefages, 1842"],
  // ["(Linnaeus, 1753) Linnaeus, 1763", "(L.) L.", "(Linnaeus, 1753) Linnaeus, 1763"],
  // ["(Linnaeus, 1753)", "(L.)", "(Linnaeus, 1753)"],
  ["Linnaeus", "L.", "Linnaeus"],
  [
    "Bakker et al., 1988",
    "Bakker, Williams & Currie, 1988",
    "Bakker, Williams & Currie, 1988",
  ],

  // TODO
  // debatable if these should unify -- how to handle cases like "Gorgosaurus" where the same authority is given with different years: how would a hypothetical third authority without year unify?
  ["(Cass.) Greuter, 1791", "(Cass.) Greuter", "(Cass.) Greuter, 1791"],
  // ["(Linnaeus) Linnaeus", "(L., 1753) L., 1763", "(Linnaeus, 1753) Linnaeus, 1763"],
  ["Osborn, 1905", "Osborn", "Osborn, 1905"],
  [
    "Bakker et al., 1988",
    "Bakker, Williams & Currie",
    "Bakker, Williams & Currie, 1988",
  ],
  [
    "Bakker et al.",
    "Bakker, Williams & Currie, 1988",
    "Bakker, Williams & Currie, 1988",
  ],
];

const incompatible_tests: [string, string][] = [
  ["(Bolívar, 1893)", "Bolivar, 1893"],
  ["Simon, 1890", "(Simon, 1890)"],
];

for (const test of unify_tests) {
  Deno.test({
    name: `Unify '${test[0]}','${test[1]}' → '${test[2]}'`,
    fn() {
      assertEquals(unifyAuthorithy(test[0], test[1]), test[2]);
    },
  });
}

for (const test of incompatible_tests) {
  Deno.test({
    name: `No-Unify '${test[0]}','${test[1]}'`,
    fn() {
      assertEquals(unifyAuthorithy(test[0], test[1]), null);
    },
  });
}
