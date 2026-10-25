// Télécharge les listes de filtres brutes dans ../lists-raw.
import fs from "node:fs";
import { LISTS } from "./lists.mjs";

const dir = new URL("../lists-raw/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
for (const { name, url } of LISTS) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes("!") || text.length < 1000) throw new Error(`${name}: contenu inattendu`);
  fs.writeFileSync(new URL(`${name}.txt`, dir), text);
  console.log(name, (text.length / 1024).toFixed(0), "Ko");
}
