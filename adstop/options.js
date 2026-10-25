const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Doit rester aligné avec DEFAULT_LISTS dans background.js
const FILTERS = [
  { key: "easylist", name: "Publicités", desc: "EasyList : bannières, pubs vidéo et réseaux publicitaires", def: true },
  { key: "easyprivacy", name: "Pisteurs", desc: "EasyPrivacy : bloque le suivi et les statistiques intrusives", def: true },
  { key: "antiadblock", name: "Anti-détection", desc: "Masque les messages « désactivez votre bloqueur de pubs »", def: true },
  { key: "cookies", name: "Bannières cookies", desc: "Masque les popups « Accepter les cookies »", def: true },
  { key: "annoyances", name: "Nuisances", desc: "Boutons sociaux, newsletters, chats… Peut casser certains sites", def: false },
];

const toggle = (checked, onChange) => {
  const label = document.createElement("label");
  label.className = "switch";
  label.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><i></i>`;
  label.querySelector("input").addEventListener("change", (e) => onChange(e.target.checked));
  return label;
};

async function render() {
  const cfg = await chrome.storage.local.get({ lists: {}, paused: [], custom: {}, blocked: 0, youtube: true, listStatus: {} });
  const lists = Object.fromEntries(FILTERS.map((f) => [f.key, f.def]));
  Object.assign(lists, cfg.lists);

  // Filtres + YouTube
  const box = $("lists");
  box.innerHTML = "";
  const addRow = (name, desc, checked, onChange) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<div class="txt"><b>${esc(name)}</b><small>${desc}</small></div>`;
    row.append(toggle(checked, onChange));
    box.append(row);
  };
  for (const f of FILTERS) {
    // Chrome refuse d'activer une liste quand le quota global de règles est plein
    const full = lists[f.key] && cfg.listStatus[f.key] === false;
    const desc = esc(f.desc) + (full ? ` <span class="warn">— règles réseau non chargées (limite de Chrome atteinte)</span>` : "");
    addRow(f.name, desc, lists[f.key], (v) => chrome.storage.local.set({ lists: { ...lists, [f.key]: v } }));
  }
  addRow("Pubs YouTube", "Passe les pubs vidéo et masque les pubs dans les pages", cfg.youtube, (v) => chrome.storage.local.set({ youtube: v }));

  // Sites autorisés
  const paused = $("paused");
  paused.innerHTML = cfg.paused.length ? "" : `<div class="empty">Aucun. Utilisez « Ne pas bloquer sur ce site » dans le popup.</div>`;
  for (const h of cfg.paused) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<div class="txt">${esc(h)}</div><button>Bloquer à nouveau</button>`;
    row.querySelector("button").onclick = () => chrome.storage.local.set({ paused: cfg.paused.filter((x) => x !== h) });
    paused.append(row);
  }

  // Éléments masqués
  const custom = $("custom");
  const sites = Object.keys(cfg.custom).filter((h) => cfg.custom[h].length);
  custom.innerHTML = sites.length ? "" : `<div class="empty">Aucun. Utilisez « Bloquer un élément de la page » dans le popup.</div>`;
  for (const h of sites) {
    for (const sel of cfg.custom[h]) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<div class="txt"><b>${esc(h)}</b><small><code>${esc(sel)}</code></small></div><button class="danger">Retirer</button>`;
      row.querySelector("button").onclick = () => {
        const next = { ...cfg.custom, [h]: cfg.custom[h].filter((s) => s !== sel) };
        if (!next[h].length) delete next[h];
        chrome.storage.local.set({ custom: next });
      };
      custom.append(row);
    }
  }

  $("blocked").textContent = cfg.blocked.toLocaleString("fr-FR");
}

$("reset").onclick = () => confirm("Remettre le compteur à zéro ?") && chrome.storage.local.set({ blocked: 0 });
chrome.storage.onChanged.addListener((_, area) => area === "local" && render());
render();
