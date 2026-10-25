// Listes de filtres utilisées par AdStop. L'ordre = la priorité d'activation
// (Chrome limite le nombre total de règles réseau : les premières passent d'abord).
export const LISTS = [
  { name: "easylist", id: 1, url: "https://easylist.to/easylist/easylist.txt" },
  { name: "easyprivacy", id: 2, url: "https://easylist.to/easylist/easyprivacy.txt" },
  { name: "antiadblock", id: 3, url: "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt" },
  { name: "cookies", id: 4, url: "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt" },
  { name: "annoyances", id: 5, url: "https://easylist.to/easylist/fanboy-annoyance.txt" },
];
