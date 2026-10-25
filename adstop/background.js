const hostOf = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const siteOf = (u) => {
  const p = hostOf(u).split(".");
  const n = p.length > 2 && p[p.length - 1].length === 2 && p[p.length - 2].length <= 3 ? 3 : 2;
  return p.slice(-n).join(".");
};

const getCfg = () => chrome.storage.local.get({ enabled: true, paused: [], blocked: 0 });
const bump = async () => {
  const { blocked } = await getCfg();
  chrome.storage.local.set({ blocked: blocked + 1 });
};

// --- Règles réseau : activation globale + pause par site ------------------
async function syncRules() {
  const { enabled, paused } = await getCfg();
  const dnr = chrome.declarativeNetRequest;
  const status = {};
  if (!enabled) {
    await dnr.updateEnabledRulesets({ disableRulesetIds: ["ads", "easylist", "easyprivacy"] });
  } else {
    await dnr.updateEnabledRulesets({ enableRulesetIds: ["ads"], disableRulesetIds: ["easylist", "easyprivacy"] });
    // Les listes dépassent le quota garanti par Chrome : on les active par priorité tant qu'il reste de la place.
    for (const id of ["easylist", "easyprivacy"]) {
      try {
        await dnr.updateEnabledRulesets({ enableRulesetIds: [id] });
        status[id] = true;
      } catch (e) {
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
  chrome.storage.local.set({ listStatus: status });
  chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
}
chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((c) => {
  if (c.enabled || c.paused) syncRules();
});

// --- Dernier vrai clic sur un lien, par onglet (session storage : survit au SW) --
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "blocked") bump();
  if (msg.type === "gesture" && sender.tab) {
    chrome.storage.session.set({ ["g" + sender.tab.id]: Date.now() });
  }
  if (msg.type === "link" && sender.tab) {
    chrome.storage.session.set({ ["link" + sender.tab.id]: { href: msg.href, t: Date.now() } });
  }
});

// --- Popups / popunders : nouvel onglet ouvert sans vrai clic sur un lien ---
const opened = new Map(); // tabId -> { source: tabId }
chrome.webNavigation.onCreatedNavigationTarget.addListener((d) => {
  opened.set(d.tabId, d.sourceTabId);
});
chrome.tabs.onRemoved.addListener((id) => {
  opened.delete(id);
  chrome.storage.session.remove(["link" + id, "site" + id, "g" + id]);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0 || !opened.has(d.tabId)) return;
  const sourceId = opened.get(d.tabId);
  const { enabled, paused } = await getCfg();
  if (!enabled) return opened.delete(d.tabId);

  let source;
  try { source = await chrome.tabs.get(sourceId); } catch { return opened.delete(d.tabId); }
  const srcHost = hostOf(source.url || "");
  if (paused.includes(srcHost)) return opened.delete(d.tabId);
  if (!d.url.startsWith("http")) return; // about:blank : on attend la vraie destination

  opened.delete(d.tabId);
  if (siteOf(d.url) === siteOf(source.url || "")) return; // même site : OK

  const key = "link" + sourceId;
  const link = (await chrome.storage.session.get(key))[key];
  const legit = link && Date.now() - link.t < 3000 && siteOf(link.href) === siteOf(d.url);
  if (legit) return;

  chrome.tabs.remove(d.tabId).catch(() => {});
  chrome.tabs.update(sourceId, { active: true }).catch(() => {});
  bump();
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
  const tab = await chrome.tabs.get(d.tabId).catch(() => null);
  if (tab && paused.some((h) => siteOf("https://" + h) === prev)) return;

  chrome.tabs.goBack(d.tabId).catch(() => {});
  bump();
});
