# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bingx12/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bingx12/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar: every pre-token protocol in the sealed DefiLlama snapshot, ranked by what its launch would be worth — priced by its own market, not by a flat multiple. The radar-2 model prices each protocol at its category's comparable multiple (the median market-cap-to-TVL ratio of that category's live-token protocols in the same snapshot, winsorised at the 90th percentile; thin categories fall back to the market median of 0.21x), then adjusts for seven-day TVL growth, age with no token, and chain breadth. The board covers all 40 watchlist protocols plus 138 pre-token protocols below the floor that the house's own watchlist rule would keep — 178 rows, each with a concrete six-step farm plan with costs and times. The dashboard is a static page with no network: a sortable, filterable board, a live-token view showing the market's own values, a comparables and method view with a model sandbox, and a detail view for every protocol that shows the model working and recomputes its implied value.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
# open out/dashboard/index.html — the board, detail views and filters render from out/data.js
```

Built for the make.fun "Build the best token launch radar" bounty, $1,325 in USDC. Node.js 22.18+ and a browser for the three screenshots.

---

<sub>Entered on [make.fun](https://make.fun/?ref=k6eq9xtw&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
