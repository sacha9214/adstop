// Convertit les listes brutes (../lists-raw) en rulesets declarativeNetRequest (../adstop/lists).
import fs from "node:fs";
import { CompatibilityTypes, FilterListPreprocessor, setConfiguration } from "@adguard/tsurlfilter";
import { DeclarativeFilterConverter, Filter } from "@adguard/tsurlfilter/es/declarative-converter";
import { LISTS } from "./lists.mjs";

setConfiguration({ engine: "extension", version: "3", verbose: false, compatibility: CompatibilityTypes.Extension });

const MAX = Number(process.env.MAX_RULES || 100000);
const out = new URL("../adstop/lists/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });

const converter = new DeclarativeFilterConverter();
for (const { name, id } of LISTS) {
  const raw = fs.readFileSync(new URL(`../lists-raw/${name}.txt`, import.meta.url), "utf8");
  const filter = new Filter(id, { getContent: () => Promise.resolve(FilterListPreprocessor.preprocess(raw)) });
  const res = await converter.convertStaticRuleSet(filter, { resourcesPath: "/war", maxNumberOfRules: MAX, maxNumberOfRegexpRules: 1000 });
  let rules = await res.ruleSet.getDeclarativeRules();
  // On retire les redirections vers des ressources locales (non embarquées dans cette extension)
  rules = rules.filter((r) => r.action.type !== "redirect");
  fs.writeFileSync(out + name + ".json", JSON.stringify(rules));
  // Ids des règles qui ne bloquent rien (exceptions @@...) : exclues du compteur.
  fs.writeFileSync(out + name + ".skip.json", JSON.stringify(rules.filter((r) => r.action.type !== "block").map((r) => r.id)));
  console.log(name, "règles:", rules.length, "erreurs:", res.errors?.length, "limites:", res.limitations?.length);
}
