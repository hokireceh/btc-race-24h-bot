// Washout-recovery bot for cbBTC (CBBTC/USDC) on the bars-replay/v1 harness.
//
// Idea: the dev window falls 2.8% over 24 hours with only small one-minute
// moves, so trend-following whipsaws and holding loses. The money is in the
// one deep washout and its slow multi-hour recovery. This bot is long-only
// and patient: it buys only after a washout (price more than 120 bps below
// its 240-bar high) AND a bounce (up more than 10 bps over the last 30 bars),
// then rides the recovery with a trailing stop 80 bps below the peak since
// entry. At most one position, full size, a couple of trades a day.
//
// All decisions are exact integer (BigInt) comparisons, no floats, no clock,
// no randomness, no network, so two runs on the same bars give the same orders.

import {
  runBars,
  type Bar,
  type BarsState,
  type BuyInput,
  type SellInput,
} from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 100;
const LOOKBACK_BARS = 240;
const BOUNCE_BARS = 30;
const DRAWDOWN_BPS = 120;
const BOUNCE_BPS = 10;
const TRAIL_BPS = 80;

// Rolling closes, oldest first; at most LOOKBACK_BARS + 1 entries
// (the 240 bars before the current one, plus the current one).
const closes: bigint[] = [];
// Highest close seen since entry, while holding; null when flat.
let peak: bigint | null = null;
// Our own view of whether we hold; reconciled with the real account each bar.
let holding = false;

function maxOf(values: bigint[]): bigint {
  let best = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > best) best = values[i];
  }
  return best;
}

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }): (BuyInput | SellInput)[] {
    if (state.warmingUp) return [];
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);

    // A buy we sent fills at the next bar's open; when its fill arrives, anchor
    // the trailing stop to the actual fill price, not the decision close, so a
    // gap up at the open does not make the stop trigger on a small dip.
    for (const fill of batch.fills) {
      if (
        fill.symbol === SYMBOL &&
        fill.side === 'buy' &&
        fill.status === 'filled'
      ) {
        peak = BigInt(fill.price);
      }
    }

    // Reconcile our view with the real account: a buy we sent may have been
    // rejected (for example max_slippage), so only trust the position.
    const position = state.positions.get(SYMBOL);
    const reallyHolding = position !== undefined && position.qty > 0n;
    if (holding && !reallyHolding) {
      holding = false;
      peak = null;
    }
    if (reallyHolding && !holding) {
      holding = true;
      peak = close;
    }

    closes.push(close);
    if (closes.length > LOOKBACK_BARS + 1) closes.shift();

    if (holding) {
      if (peak === null || close > peak) peak = close;
      // Sell once the close falls TRAIL_BPS below the peak since entry:
      // close <= peak * (10000 - TRAIL_BPS) / 10000, in exact integers.
      if (peak !== null && close * 10000n <= peak * BigInt(10000 - TRAIL_BPS)) {
        const qty = position !== undefined ? position.qty : 0n;
        if (qty > 0n) {
          holding = false;
          peak = null;
          return [
            {
              side: 'sell',
              symbol: SYMBOL,
              qty,
              max_slippage_bps: MAX_SLIPPAGE_BPS,
            },
          ];
        }
      }
      return [];
    }

    // Flat: wait until we have a full 240-bar lookback, then look for the
    // washout-plus-bounce setup.
    if (closes.length < LOOKBACK_BARS + 1) return [];
    const past = closes.slice(0, closes.length - 1);
    const high = maxOf(past);
    const thirtyBarsAgo = closes[closes.length - 1 - BOUNCE_BARS];

    // Washout: high is more than DRAWDOWN_BPS above the close:
    // high / close - 1 > DRAWDOWN_BPS / 10000.
    const washedOut =
      high * 10000n > close * BigInt(10000 + DRAWDOWN_BPS);
    // Bounce: close is more than BOUNCE_BPS above the close 30 bars ago.
    const bouncing =
      close * 10000n > thirtyBarsAgo * BigInt(10000 + BOUNCE_BPS);

    if (washedOut && bouncing) {
      const room = state.weightRoom(SYMBOL);
      const amount = state.cash < room ? state.cash : room;
      if (amount <= 0n) return [];
      holding = true;
      peak = close;
      return [
        {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: amount,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});
