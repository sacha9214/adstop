// Génère rules.json à partir de la liste de domaines. Usage : node gen_rules.js
const fs = require("fs");
const domains = `
doubleclick.net googlesyndication.com googleadservices.com adservice.google.com
adnxs.com amazon-adsystem.com adform.net criteo.com criteo.net pubmatic.com
rubiconproject.com openx.net taboola.com outbrain.com mgid.com revcontent.com
popads.net popcash.net propellerads.com propellerclick.com exoclick.com exosrv.com
exdynsrv.com realsrv.com juicyads.com trafficjunky.com adsterra.com hilltopads.net
hilltopads.com clickadu.com adcash.com ad-maven.com admaven.com onclkds.com a-ads.com
monetag.com tsyndicate.com plugrush.com trafficstars.com bidvertiser.com yllix.com
adskeeper.com adspyglass.com ero-advertising.com clickaine.com
syndication.realsrv.com richpush.co pushails.com adxxx.com ad.gt
adsco.re adtng.com betteradsystem.com cdn4ads.com
`.trim().split(/\s+/);

const rules = [
  {
    id: 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      requestDomains: domains,
      resourceTypes: [
        "main_frame", "sub_frame", "script", "image", "xmlhttprequest",
        "ping", "media", "stylesheet", "font", "object", "other"
      ]
    }
  }
];
fs.writeFileSync(__dirname + "/rules.json", JSON.stringify(rules, null, 2));
console.log(domains.length + " domaines");
