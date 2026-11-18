# btc-race-24h-bot

[![make.fun bounty](https://make.fun/badge/btc-race-24h-20261118-1444/bounty.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![make.fun rank](https://make.fun/badge/btc-race-24h-20261118-1444/hokireceh/btc-race-24h-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![make.fun reward](https://make.fun/badge/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)

A long-only washout-recovery bot for cbBTC (CBBTC/USDC): it buys only after a deep washout (more than 120 bps below the 240-minute high) with a bounce (up more than 10 bps over 30 minutes), then rides the recovery with a trailing stop 80 bps below the peak since entry. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty.

## Run it

```
git clone https://github.com/hokireceh/btc-race-24h-bot
cd btc-race-24h-bot
# Grade it on the dev window with the make.fun competition kit:
node ../btc-race-24h-20261118-1444-kit/cli/makefun.mjs grade-local --kit ../btc-race-24h-20261118-1444-kit --bot . --driver process
```

<sub>Entered on [make.fun](https://make.fun/?ref=jjqnkn84&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
