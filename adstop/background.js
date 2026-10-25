const hostOf = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const siteOf = (u) => {
  const p = hostOf(u).split(".");
  const n = p.length > 2 && p[p.length - 1].length === 2 && p[p.length - 2].length <= 3 ? 3 : 2;
  return p.slice(-n).join(".");
};
// Le site est-il dans la liste "ne pas bloquer" (sous-domaines compris) ?
const isPaused = (host, paused) => paused.some((h) => host === h || host.endsWith("." + h));

// Ordre = priorité d'activation quand Chrome manque de place pour les règles.
const LISTS = ["easylist", "easyprivacy", "antiadblock", "cookies", "annoyances"];
const DEFAULT_LISTS = { easylist: true, easyprivacy: true, antiadblock: true, cookies: true, annoyances: false };

const getCfg = async () => {
  const c = await chrome.storage.local.get({ enabled: true, paused: [], blocked: 0, lists: {}, custom: {} });
  c.lists = { ...DEFAULT_LISTS, ...c.lists };
  return c;
};

// --- Compteurs -----------------------------------------------------------
// Blocage fait par nos scripts (popup, redirection...) : +1 sur le badge de l'onglet et au total.
const bump = async (tabId) => {
  if (tabId >= 0) {
    chrome.declarativeNetRequest.setExtensionActionOptions({ tabUpdate: { tabId, increment: 1 } }).catch(() => {});
    const k = "n" + tabId;
    const v = (await chrome.storage.session.get(k))[k] || 0;
    chrome.storage.session.set({ [k]: v + 1 });
  }
  const { blocked } = await chrome.storage.local.get({ blocked: 0 });
  chrome.storage.local.set({ blocked: blocked + 1 });
};

// Les blocages réseau sont faits par Chrome : on relève régulièrement les règles déclenchées.
let skipIds = null;
const loadSkip = async () => {
  if (skipIds) return skipIds;
  skipIds = {};
  for (const id of LISTS) {
    const r = await fetch(chrome.runtime.getURL(`lists/${id}.skip.json`));
    skipIds[id] = new Set(await r.json());
  }
  return skipIds;
};
// Un seul relevé à la fois, sinon deux appels simultanés compteraient deux fois les mêmes blocages.
let polling = null;
const collectMatches = () => (polling ||= pollMatches().finally(() => (polling = null)));
async function pollMatches() {
  const { lastPoll = Date.now() - 60000 } = await chrome.storage.session.get("lastPoll");
  let info;
  try {
    info = await chrome.declarativeNetRequest.getMatchedRules({ minTimeStamp: lastPoll + 1 });
  } catch {
    return; // quota d'appels dépassé : on réessaiera au prochain tour
  }
  const skip = await loadSkip();
  const { navAt = {} } = await chrome.storage.session.get("navAt");
  const perTab = {};
  let total = 0, newest = lastPoll;
  for (const m of info.rulesMatchedInfo) {
    newest = Math.max(newest, m.timeStamp);
    const { rulesetId, ruleId } = m.rule;
    if (rulesetId === "_dynamic" || rulesetId === "_session" || skip[rulesetId]?.has(ruleId)) continue;
    total++;
    // Pour la page, seuls comptent les blocages postérieurs à son chargement.
    if (m.tabId >= 0 && m.timeStamp >= (navAt[m.tabId] || 0)) perTab[m.tabId] = (perTab[m.tabId] || 0) + 1;
  }
  const cur = await chrome.storage.session.get(Object.keys(perTab).map((t) => "n" + t));
  const upd = { lastPoll: newest };
  for (const t in perTab) upd["n" + t] = (cur["n" + t] || 0) + perTab[t];
  await chrome.storage.session.set(upd);
  if (total) {
    const { blocked } = await chrome.storage.local.get({ blocked: 0 });
    await chrome.storage.local.set({ blocked: blocked + total });
  }
}
chrome.alarms.create("poll", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => a.name === "poll" && collectMatches());

// --- Règles réseau + masquage générique : activation globale, listes, pause par site --
async function syncRules() {
  const { enabled, paused, lists } = await getCfg();
  const dnr = chrome.declarativeNetRequest;
  const status = {};
  await dnr.updateEnabledRulesets({ disableRulesetIds: ["ads", ...LISTS] });
  if (enabled) {
    await dnr.updateEnabledRulesets({ enableRulesetIds: ["ads"] });
    // Les listes dépassent le quota garanti par Chrome : on les active par priorité tant qu'il reste de la place.
    for (const id of LISTS) {
      if (!lists[id]) continue;
      try {
        await dnr.updateEnabledRulesets({ enableRulesetIds: [id] });
        status[id] = true;
      } catch {
        status[id] = false;
      }
    }
  }
  await dnr.updateDynamicRules({
    removeRuleIds: [1],
    addRules: paused.length
      ? [{
          id: 1,
          priority: 1000000,
          action: { type: "allowAllRequests" },
          condition: { requestDomains: paused, resourceTypes: ["main_frame", "sub_frame"] }
        }]
      : []
  });

  // Feuilles CSS génériques des listes actives, injectées dès le début du chargement.
  await chrome.scripting.unregisterContentScripts({ ids: ["cosmetic"] }).catch(() => {});
  const css = enabled ? LISTS.filter((id) => lists[id]).map((id) => `lists/${id}.css`) : [];
  if (css.length) {
    await chrome.scripting.registerContentScripts([{
      id: "cosmetic",
      matches: ["<all_urls>"],
      excludeMatches: paused.flatMap((h) => [`*://${h}/*`, `*://*.${h}/*`]),
      css,
      allFrames: true,
      runAt: "document_start",
      persistAcrossSessions: true
    }]);
  }

  chrome.storage.local.set({ listStatus: status });
  await dnr.setExtensionActionOptions({ displayActionCountAsBadgeText: enabled });
  chrome.action.setBadgeBackgroundColor({ color: "#1f5eff" });
  chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
}
chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && (c.enabled || c.paused || c.lists)) syncRules();
});

// --- Masquage propre à chaque site (listes + éléments choisis avec le sélecteur) --
const siteSelectors = {};
const loadSites = async (id) => {
  if (!siteSelectors[id]) {
    const r = await fetch(chrome.runtime.getURL(`lists/${id}.sites.json`));
    siteSelectors[id] = await r.json();
  }
  return siteSelectors[id];
};
async function selectorsFor(host, cfg) {
  const suffixes = host.split(".").map((_, i, p) => p.slice(i).join("."));
  const sels = [];
  for (const id of LISTS) {
    if (!cfg.lists[id]) continue;
    const map = await loadSites(id);
    for (const s of suffixes) if (map[s]) sels.push(...map[s]);
  }
  for (const s of suffixes) if (cfg.custom[s]) sels.push(...cfg.custom[s]);
  return sels;
}
chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (!d.url.startsWith("http")) return;
  const cfg = await getCfg();
  if (!cfg.enabled) return;
  let top = d.url;
  if (d.frameId !== 0) top = (await chrome.tabs.get(d.tabId).catch(() => ({}))).url || d.url;
  if (isPaused(hostOf(top), cfg.paused)) return;
  const sels = await selectorsFor(hostOf(d.url).replace(/^www\./, ""), cfg);
  if (!sels.length) return;
  chrome.scripting.insertCSS({
    target: { tabId: d.tabId, frameIds: [d.frameId] },
    origin: "USER",
    css: sels.map((s) => `${s}{display:none!important}`).join("\n")
  }).catch(() => {});
});

// --- Messages des scripts de contenu et de la page d'options -------------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab?.id;
  if (msg.type === "blocked") bump(tabId);
  if (msg.type === "gesture" && sender.tab) {
    chrome.storage.session.set({ ["g" + tabId]: Date.now() });
  }
  if (msg.type === "link" && sender.tab) {
    chrome.storage.session.set({ ["link" + tabId]: { href: msg.href, t: Date.now() } });
  }
  if (msg.type === "stats") {
    // Demandé par le popup : relevé frais puis compteur de la page.
    collectMatches().then(async () => {
      const k = "n" + msg.tabId;
      reply({ page: (await chrome.storage.session.get(k))[k] || 0 });
    });
    return true;
  }
});

// Nouvelle page dans l'onglet : son compteur repart de zéro.
chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const { navAt = {} } = await chrome.storage.session.get("navAt");
  navAt[d.tabId] = d.timeStamp;
  chrome.storage.session.set({ navAt, ["n" + d.tabId]: 0 });
});

// --- Popups / popunders : nouvel onglet ouvert sans vrai clic sur un lien ---
const opened = new Map(); // tabId -> { source: tabId }
chrome.webNavigation.onCreatedNavigationTarget.addListener((d) => {
  opened.set(d.tabId, d.sourceTabId);
});
chrome.tabs.onRemoved.addListener(async (id) => {
  opened.delete(id);
  const { navAt = {} } = await chrome.storage.session.get("navAt");
  delete navAt[id];
  chrome.storage.session.set({ navAt });
  chrome.storage.session.remove(["link" + id, "site" + id, "g" + id, "n" + id]);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0 || !opened.has(d.tabId)) return;
  const sourceId = opened.get(d.tabId);
  const { enabled, paused } = await getCfg();
  if (!enabled) return opened.delete(d.tabId);

  let source;
  try { source = await chrome.tabs.get(sourceId); } catch { return opened.delete(d.tabId); }
  const srcHost = hostOf(source.url || "");
  if (isPaused(srcHost, paused)) return opened.delete(d.tabId);
  if (!d.url.startsWith("http")) return; // about:blank : on attend la vraie destination

  opened.delete(d.tabId);
  if (siteOf(d.url) === siteOf(source.url || "")) return; // même site : OK

  const key = "link" + sourceId;
  const link = (await chrome.storage.session.get(key))[key];
  const legit = link && Date.now() - link.t < 3000 && siteOf(link.href) === siteOf(d.url);
  if (legit) return;

  chrome.tabs.remove(d.tabId).catch(() => {});
  chrome.tabs.update(sourceId, { active: true }).catch(() => {});
  bump(sourceId);
});

// --- Redirections JS de l'onglet vers un autre site sans action utilisateur ---
chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0 || !d.url.startsWith("http")) return;
  const sk = "site" + d.tabId, gk = "g" + d.tabId;
  const st = await chrome.storage.session.get([sk, gk]);
  const prev = st[sk];
  chrome.storage.session.set({ [sk]: siteOf(d.url) });

  if (!prev || prev === siteOf(d.url) || opened.has(d.tabId)) return;
  if (!d.transitionQualifiers.includes("client_redirect")) return;
  const { enabled, paused } = await getCfg();
  if (!enabled) return;
  if (st[gk] && Date.now() - st[gk] < 5000) return; // l'utilisateur vient d'agir (login OAuth, etc.)
  if (paused.some((h) => siteOf("https://" + h) === prev)) return;

  chrome.tabs.goBack(d.tabId).catch(() => {});
  bump();
});
