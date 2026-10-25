// Convertit les listes EasyList/EasyPrivacy (../lists-raw) en rulesets declarativeNetRequest (../adstop/lists).
import fs from "node:fs";
import { CompatibilityTypes, FilterListPreprocessor, setConfiguration } from "@adguard/tsurlfilter";
import { DeclarativeFilterConverter, Filter } from "@adguard/tsurlfilter/es/declarative-converter";

setConfiguration({ engine: "extension", version: "3", verbose: false, compatibility: CompatibilityTypes.Extension });

const MAX = Number(process.env.MAX_RULES || 100000);
const lists = [
  ["easylist", 1],
  ["easyprivacy", 2],
];
const out = new URL("../adstop/lists/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });

const converter = new DeclarativeFilterConverter();
for (const [name, id] of lists) {
  const raw = fs.readFileSync(new URL(`../lists-raw/${name}.txt`, import.meta.url), "utf8");
  const filter = new Filter(id, { getContent: () => Promise.resolve(FilterListPreprocessor.preprocess(raw)) });
  const res = await converter.convertStaticRuleSet(filter, { resourcesPath: "/war", maxNumberOfRules: MAX, maxNumberOfRegexpRules: 1000 });
  let rules = await res.ruleSet.getDeclarativeRules();
  // On retire les redirections vers des ressources locales (non embarquées dans cette extension)
  rules = rules.filter((r) => r.action.type !== "redirect");
  fs.writeFileSync(out + name + ".json", JSON.stringify(rules));
  console.log(name, "règles:", rules.length, "erreurs:", res.errors?.length, "limites:", res.limitations?.length);
}
