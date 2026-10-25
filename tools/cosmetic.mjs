// Extrait les règles cosmétiques de chaque liste :
//   ##sélecteur            -> adstop/lists/<liste>.css (appliqué partout)
//   exemple.com##sélecteur -> adstop/lists/<liste>.sites.json ({ "exemple.com": [sélecteurs] })
import fs from "node:fs";
import { LISTS } from "./lists.mjs";

const NON_CSS = /:-abp-|:has-text|:xpath|:matches-|:upward|:style|:remove|:contains|\+js\(/;

for (const { name } of LISTS) {
  const lines = fs.readFileSync(new URL(`../lists-raw/${name}.txt`, import.meta.url), "utf8").split(/\r?\n/);
  const except = new Set();
  for (const l of lines) {
    const m = l.match(/^([^#]*)#@#(.+)$/);
    if (m) except.add(m[1] + "|" + m[2]);
  }

  const generic = new Set();
  const sites = {};
  for (const l of lines) {
    const m = l.match(/^([^#]*)##(.+)$/); // ignore #?#, #$#, #@#, etc.
    if (!m) continue;
    const [, doms, sel] = m;
    if (NON_CSS.test(sel)) continue;
    if (!doms) {
      if (!except.has("|" + sel)) generic.add(sel);
      continue;
    }
    for (const d of doms.split(",")) {
      if (!d || d.startsWith("~") || d.includes("*") || except.has(d + "|" + sel)) continue;
      (sites[d] ||= []).push(sel);
    }
  }

  const base = new URL(`../adstop/lists/${name}`, import.meta.url).pathname;
  // Un sélecteur invalide invalide toute la règle : un bloc par sélecteur.
  fs.writeFileSync(base + ".css", [...generic].map((s) => `${s}{display:none!important}`).join("\n"));
  fs.writeFileSync(base + ".sites.json", JSON.stringify(sites));
  console.log(name, "génériques:", generic.size, "sites:", Object.keys(sites).length);
}
