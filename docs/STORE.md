# Chrome Web Store listing

Ready-to-paste text for publishing AdStop on the Chrome Web Store
(https://chrome.google.com/webstore/devconsole, one-time $5 developer fee).

**Package:** zip the contents of the `adstop/` folder (not the folder itself), without `_metadata/`.
**Icon:** `adstop/icons/128.png`
**Screenshots (1280×800 or 640×400):** take them from `docs/` and resize.
**Category:** Productivity → Workflow & Planning (or "Tools").
**Language:** French

## Name

AdStop – Bloqueur de pubs gratuit

## Short description (132 characters max)

Bloqueur de pubs gratuit et open source : pubs, pisteurs, popups, redirections, bannières cookies et pubs YouTube.

## Detailed description

AdStop bloque les publicités, gratuitement et sans compte.

✔ Pubs et pisteurs bloqués (EasyList + EasyPrivacy)
✔ Popups, popunders et redirections forcées vers d'autres sites stoppés
✔ Pubs YouTube passées automatiquement
✔ Bannières « Accepter les cookies » masquées
✔ Messages « Désactivez votre bloqueur de pubs » masqués
✔ « Bloquer un élément » : cliquez sur n'importe quel élément gênant pour le faire disparaître
✔ Un clic pour autoriser les pubs sur un site que vous voulez soutenir
✔ Compteur de pubs bloquées sur la page et au total
✔ Listes de filtres mises à jour chaque semaine

Aucune donnée collectée. Code source ouvert : https://github.com/sacha9214/adstop

## Single purpose (asked by the store)

Bloquer les publicités, les pisteurs et les popups indésirables dans les pages web.

## Permission justifications (asked by the store)

- **declarativeNetRequest**: block requests to ad and tracking servers.
- **declarativeNetRequestFeedback**: count blocked requests to show the counter.
- **host permissions (<all_urls>)**: hide ads and block popups on every site the user visits.
- **scripting**: hide ad elements and run the "block an element" tool.
- **tabs / webNavigation**: detect and close popup tabs and forced redirects.
- **storage**: save settings, allowed sites and counters locally.
- **alarms**: update the counter regularly.
- **activeTab**: run the element picker on the current tab when the user asks.

## Privacy

Data usage: AdStop does not collect or transmit any user data. Tick "I do not sell or transfer user data…" and all three certifications.
