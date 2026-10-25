// Tourne dans le monde "MAIN" de la page : neutralise popups, popunders et redirections.
(() => {
  let active = true; // actif par défaut jusqu'à réception de la config
  document.addEventListener("adstop-config", (e) => {
    try { active = JSON.parse(e.detail).active; } catch {}
  });

  const report = () =>
    document.dispatchEvent(new CustomEvent("adstop-blocked"));

  const site = (u) => {
    try {
      const p = new URL(u, location.href).hostname.replace(/^www\./, "").split(".");
      const n = p.length > 2 && p[p.length - 1].length === 2 && p[p.length - 2].length <= 3 ? 3 : 2;
      return p.slice(-n).join(".");
    } catch { return ""; }
  };
  const crossSite = (u) => site(u) !== site(location.href);

  // 1. window.open : bloqué sans geste utilisateur, ou vers un autre site
  const realOpen = window.open;
  window.open = function (url, ...rest) {
    if (active) {
      const gesture = navigator.userActivation && navigator.userActivation.isActive;
      if (!gesture || (url && crossSite(url))) {
        report();
        return null;
      }
    }
    return realOpen.call(this, url, ...rest);
  };

  // 2. Clics programmatiques sur un <a> détaché (technique classique des popunders)
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (active && !this.isConnected && this.href && crossSite(this.href)) {
      report();
      return;
    }
    return realClick.apply(this, arguments);
  };

  // 3. Overlays invisibles plein écran qui détournent le clic
  document.addEventListener(
    "click",
    (e) => {
      if (!active || !e.isTrusted) return;
      const el = e.target;
      if (!(el instanceof HTMLElement) || el === document.body || el === document.documentElement) return;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") return;
      const r = el.getBoundingClientRect();
      const covers = r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.8;
      const empty = !el.textContent.trim() && !el.querySelector("img,video,input,button,svg,canvas");
      if (covers && empty) {
        e.preventDefault();
        e.stopImmediatePropagation();
        el.remove();
        report();
      }
    },
    true
  );
})();
