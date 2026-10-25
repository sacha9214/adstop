// Extrait les règles cosmétiques génériques (##sélecteur, sans domaine) d'EasyList -> adstop/cosmetic.css
import fs from "node:fs";
const lines = fs.readFileSync(new URL("../lists-raw/easylist.txt", import.meta.url), "utf8").split("\n");
const sels = new Set();
const except = new Set(lines.filter((l) => l.startsWith("#@#")).map((l) => l.slice(3)));
for (const l of lines) {
  if (!l.startsWith("##")) continue;                       // uniquement génériques
  const s = l.slice(2);
  if (/:-abp-|:has-text|:xpath|:matches-|:upward|:style|:remove|\+js\(/.test(s)) continue; // non-CSS
  if (except.has(s)) continue;
  sels.add(s);
}
const arr = [...sels];
// Un sélecteur invalide invalide toute la règle : un bloc par sélecteur.
fs.writeFileSync(new URL("../adstop/cosmetic.css", import.meta.url), arr.map((s) => `${s}{display:none!important}`).join("\n"));
console.log(arr.length, "sélecteurs");
