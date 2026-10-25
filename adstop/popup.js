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
    const isPaused = paused.some((h) => host === h || host.endsWith("." + h));
    const on = enabled && !isPaused && !!host;

    $("enabled").checked = enabled;
    $("blocked").textContent = blocked.toLocaleString("fr-FR");
    $("pick").disabled = !on;
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
    const hit = paused.filter((h) => host === h || host.endsWith("." + h));
    const next = hit.length ? paused.filter((h) => !hit.includes(h)) : [...paused, host];
    await chrome.storage.local.set({ paused: next });
    chrome.tabs.reload(tab.id);
    render();
  });

  $("pick").addEventListener("click", async () => {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["picker.js"] });
    window.close();
  });
  $("settings").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  render();
  // Compteur de la page : relevé frais demandé au background
  if (host) {
    const { page } = await chrome.runtime.sendMessage({ type: "stats", tabId: tab.id });
    $("page").textContent = page.toLocaleString("fr-FR");
    render(); // le total a pu bouger pendant le relevé
  }
})();
