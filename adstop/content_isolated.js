// Monde isolé : fait le pont entre le storage de l'extension et la page.
(() => {
  const host = location.hostname.replace(/^www\./, "");

  // Après un rechargement de l'extension, l'ancien script reste dans la page :
  // chrome.runtime.id disparaît et sendMessage lève une erreur synchrone.
  const send = (msg) => {
    if (!chrome.runtime?.id) return;
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {}
  };

  // Transmet la config aux scripts du monde MAIN (anti-popups, YouTube), et à chaque changement.
  const pushConfig = () =>
    chrome.storage.local.get({ enabled: true, paused: [], youtube: true }, ({ enabled, paused, youtube }) => {
      const active = enabled && !paused.some((h) => host === h || host.endsWith("." + h));
      document.dispatchEvent(new CustomEvent("adstop-config", { detail: JSON.stringify({ active, youtube }) }));
    });
  pushConfig();
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "local" && chrome.runtime?.id && (c.enabled || c.paused || c.youtube)) pushConfig();
  });

  document.addEventListener("adstop-blocked", () => {
    send({ type: "blocked" });
  });

  // Toute action réelle de l'utilisateur autorise une navigation légitime (login, paiement...)
  let lastG = 0;
  const gesture = (e) => {
    if (!e.isTrusted || Date.now() - lastG < 1000) return;
    lastG = Date.now();
    send({ type: "gesture" });
  };
  document.addEventListener("pointerdown", gesture, true);
  document.addEventListener("keydown", gesture, true);

  // Mémorise les vrais clics sur de vrais liens visibles : ce sont les seules
  // ouvertures d'onglet vers un autre site que l'on autorise.
  document.addEventListener(
    "click",
    (e) => {
      if (!e.isTrusted) return;
      const a = e.target instanceof Element && e.target.closest("a[href]");
      if (!a) return;
      const r = a.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      send({ type: "link", href: a.href });
    },
    true
  );
})();
