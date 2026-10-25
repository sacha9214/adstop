// Sélecteur d'élément : injecté depuis le popup. Survoler, cliquer, confirmer -> l'élément
// est masqué sur ce site, maintenant et aux prochaines visites.
(() => {
  if (window.__adstopPicker) return;
  window.__adstopPicker = true;

  const host = location.hostname.replace(/^www\./, "");
  const root = document.createElement("adstop-picker");
  const shadow = root.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .box { position: fixed; pointer-events: none; z-index: 2147483646; background: rgba(31,94,255,.18);
             outline: 2px solid #1f5eff; border-radius: 3px; transition: all .06s; }
      .bar { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 2147483647;
             display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 12px;
             background: #0b1f4b; color: #fff; font: 13px -apple-system, "Segoe UI", Roboto, sans-serif;
             box-shadow: 0 6px 24px rgba(0,0,0,.35); max-width: 90vw; }
      .msg { margin-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; }
      button { font: 600 13px inherit; font-family: inherit; border: 0; border-radius: 8px; padding: 7px 11px; cursor: pointer; }
      .ok { background: #1f5eff; color: #fff; } .ok:hover { background: #164ad1; }
      .sec { background: rgba(255,255,255,.14); color: #fff; } .sec:hover { background: rgba(255,255,255,.24); }
      [hidden] { display: none; }
    </style>
    <div class="box" hidden></div>
    <div class="bar">
      <span class="msg">Cliquez sur l'élément à masquer</span>
      <button class="sec" id="wider" hidden>Plus large</button>
      <button class="ok" id="hide" hidden>Masquer</button>
      <button class="sec" id="cancel">Annuler</button>
    </div>`;
  document.documentElement.appendChild(root);
  const $ = (s) => shadow.querySelector(s);
  const box = $(".box"), msg = $(".msg");

  let hovered = null, picked = null;

  const draw = (el) => {
    if (!el) return (box.hidden = true);
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    box.hidden = false;
  };

  // Ignore les ids/classes générés automatiquement (chiffres en série, hash...)
  const stable = (s) => s && !/\d{3,}|[a-f0-9]{8,}|^[a-z]{1,2}-?[A-Za-z0-9]{5,}$/.test(s) && !s.includes(":");
  const part = (el) => {
    if (stable(el.id)) return "#" + CSS.escape(el.id);
    let s = el.localName;
    const cls = [...el.classList].filter(stable).slice(0, 3);
    if (cls.length) s += cls.map((c) => "." + CSS.escape(c)).join("");
    const same = el.parentElement ? [...el.parentElement.children].filter((c) => c.localName === el.localName) : [];
    if (!cls.length && same.length > 1) s += `:nth-of-type(${same.indexOf(el) + 1})`;
    return s;
  };
  const selectorOf = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      parts.unshift(part(e));
      const sel = parts.join(" > ");
      if (parts[0].startsWith("#") || document.querySelectorAll(sel).length === 1) return sel;
      if (parts.length >= 5) return sel;
    }
    return parts.join(" > ") || el.localName;
  };

  const pick = (el) => {
    picked = el;
    draw(el);
    const n = document.querySelectorAll(selectorOf(el)).length;
    msg.textContent = n > 1 ? `${n} éléments seront masqués` : "Cet élément sera masqué";
    $("#hide").hidden = false;
    $("#wider").hidden = !el.parentElement || el.parentElement === document.body;
  };

  const onMove = (e) => {
    if (picked) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== root) draw((hovered = el));
  };
  const onClick = (e) => {
    if (e.composedPath().includes(root)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (hovered) pick(hovered);
  };
  const block = (e) => {
    if (!e.composedPath().includes(root)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  const onKey = (e) => e.key === "Escape" && close();

  const close = () => {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    for (const t of ["mousedown", "mouseup", "pointerdown", "pointerup"]) document.removeEventListener(t, block, true);
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    window.__adstopPicker = false;
  };

  $("#cancel").onclick = close;
  $("#wider").onclick = () => picked?.parentElement && pick(picked.parentElement);
  $("#hide").onclick = async () => {
    const sel = selectorOf(picked);
    const { custom } = await chrome.storage.local.get({ custom: {} });
    custom[host] = [...new Set([...(custom[host] || []), sel])];
    await chrome.storage.local.set({ custom });
    // Masque tout de suite (le background le réappliquera aux prochaines visites)
    const st = document.createElement("style");
    st.textContent = `${sel}{display:none!important}`;
    (document.head || document.documentElement).appendChild(st);
    close();
  };

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  for (const t of ["mousedown", "mouseup", "pointerdown", "pointerup"]) document.addEventListener(t, block, true);
  document.addEventListener("keydown", onKey, true);
})();
