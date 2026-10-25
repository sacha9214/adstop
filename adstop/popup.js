const $ = (id) => document.getElementById(id);

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try {
    const u = new URL(tab.url);
    if (u.protocol.startsWith("http")) host = u.hostname.replace(/^www\./, "");
  } catch {}

  const render = async () => {
    const { enabled, paused, blocked } = await chrome.storage.local.get({ enabled: true, paused: [], blocked: 0 });
    const isPaused = paused.includes(host);
    const on = enabled && !isPaused && !!host;

    $("enabled").checked = enabled;
    $("blocked").textContent = blocked.toLocaleString("fr-FR");
    $("nsites").textContent = paused.length;
    $("site").textContent = host || "Page non prise en charge";
    $("hero").classList.toggle("off", !on);
    $("status").textContent = !enabled ? "Protection désactivée"
      : !host ? "Rien à bloquer ici"
      : isPaused ? "Pubs autorisées sur ce site"
      : "Protégé";

    $("pause").disabled = !host || !enabled;
    $("pause").textContent = isPaused ? "Bloquer à nouveau sur ce site" : "Ne pas bloquer sur ce site";
    $("pause").classList.toggle("ghost", isPaused);
  };

  $("enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
    render();
  });
  $("pause").addEventListener("click", async () => {
    const { paused } = await chrome.storage.local.get({ paused: [] });
    const next = paused.includes(host) ? paused.filter((h) => h !== host) : [...paused, host];
    await chrome.storage.local.set({ paused: next });
    chrome.tabs.reload(tab.id);
    render();
  });

  render();
})();
