// Monde MAIN de youtube.com : passe les pubs vidéo et masque les emplacements publicitaires.
// YouTube change souvent son code : les sélecteurs ci-dessous sont à mettre à jour si ça casse.
(() => {
  let on = true;
  document.addEventListener("adstop-config", (e) => {
    try {
      const c = JSON.parse(e.detail);
      on = c.active && c.youtube !== false;
    } catch {}
    style.disabled = !on;
  });

  const report = () => document.dispatchEvent(new CustomEvent("adstop-blocked"));

  // 1. Emplacements pub dans les pages (accueil, recherche, à côté de la vidéo, bannières)
  const style = document.createElement("style");
  style.textContent = `
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer,
    ytd-promoted-sparkles-web-renderer, ytd-promoted-video-renderer, ytd-display-ad-renderer,
    ytd-companion-slot-renderer, ytd-action-companion-ad-renderer, ytd-player-legacy-desktop-watch-ads-renderer,
    ytd-statement-banner-renderer, ytd-search-pyv-renderer, ytd-merch-shelf-renderer,
    ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer),
    ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
    #masthead-ad, #player-ads, #panels > ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    .ytp-ad-overlay-container, .ytp-ad-overlay-slot, .ytp-featured-product, .ytp-suggested-action,
    ytm-promoted-sparkles-web-renderer, ytm-companion-ad-renderer, ad-slot-renderer
    { display: none !important; }`;
  const addStyle = () => (document.head || document.documentElement).appendChild(style);
  document.documentElement ? addStyle() : document.addEventListener("DOMContentLoaded", addStyle);

  // 2. Pubs vidéo : coupe le son, saute à la fin et clique "Passer" dès que possible
  let lastAd = 0, wasMuted = false;
  const skip = () => {
    if (!on) return;
    const player = document.querySelector("#movie_player, .html5-video-player");
    if (!player || !player.classList.contains("ad-showing")) return;
    const video = player.querySelector("video");
    if (video) {
      if (!lastAd) wasMuted = video.muted;
      video.muted = true;
      if (isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration;
    }
    document
      .querySelectorAll(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[id^='skip-button']")
      .forEach((b) => b.click());
    if (!lastAd) report(); // une pub = un blocage, pas un par tick
    lastAd = Date.now();
  };
  // Après la pub, on rend le son que l'utilisateur avait
  const unmute = () => {
    const player = document.querySelector("#movie_player");
    const video = player?.querySelector("video");
    if (video && lastAd && !player.classList.contains("ad-showing") && Date.now() - lastAd < 60000) {
      video.muted = wasMuted;
      lastAd = 0;
    }
  };
  setInterval(() => { skip(); unmute(); }, 300);
})();
