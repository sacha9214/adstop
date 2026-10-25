# AdStop

A free, open-source ad blocker for Chrome (Manifest V3).

- Blocks ads and trackers using **EasyList** and **EasyPrivacy**
- Blocks popups, popunders and forced redirects to other sites
- One click to allow ads on a site you want to support, and one click to block them again

## Install (developer mode)

1. Download this repo (green **Code** button, then **Download ZIP**) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `adstop` folder.

## Updating the filter lists

```bash
cd tools && npm install
# put fresh easylist.txt / easyprivacy.txt in lists-raw/, then:
node convert.mjs
```

## Credits and license

The filter rules come from [EasyList](https://easylist.to/) (GPLv3 / CC BY-SA 3.0).
AdStop is released under the **GNU GPL v3** (see `LICENSE`).
AdStop is an independent project. It is not affiliated with AdBlock, AdBlock 360 or EasyList.
