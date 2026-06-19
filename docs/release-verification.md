# Release verification

Checks to run before a release. The automated parts gate CI; the manual
round-trip is the one thing only a human with a wallet can do — and it's the
highest-assurance check we have that funds actually move correctly end to end.

**Why this exists.** A security audit found no fund-safety bug in the app code,
but the Autonomys SDKs (`@autonomys/auto-xdm`, `auto-wallet`, `auto-utils`) and
the live contracts are trusted black boxes: the code is verified to pass them
correct, exact-precision arguments, but their internal behaviour is not. The
round-trip below is how we confirm that reality. See issue #30 §2.

## Automated (already gating CI)

- **Config integrity** — `npm test` (hermetic) on every PR, plus the live
  on-chain check (`npm run test:onchain`) on any PR that edits
  `config/networks.ts`, confirming each `wai3Address` is a real WAI3 contract on
  its configured chain. (#30 §2.1)
- **Tx-input invariant** — `test/tx-input-invariant.test.ts` fails if a
  transaction-submission page starts reading URL query params (see *Standing
  invariants* below). (#30 §2.3)

## Manual: testnet round-trip (#30 §2.2)

Do this on **Chronos testnet** (native `tAI3`) so no real funds are at risk.
Obtain test `tAI3` from the Autonomys Chronos faucet (see the Autonomys docs).
You need a Substrate wallet (e.g. SubWallet/Talisman) and an EVM wallet (e.g.
MetaMask/Rabby), both holding a little `tAI3`.

For **every** flow, confirm the **exact amount** and the **exact destination**
on the block explorer — do not trust the app's success message alone. Chronos
explorers: consensus → <https://autonomys-chronos.subscan.io>, Auto EVM →
<https://explorer.auto-evm.chronos.autonomys.xyz>. Use a round amount `N` ≥ 1
`tAI3` (the send form enforces a 1 AI3 minimum for XDM transfers).

### 1. Wrap — instant
- [ ] On `/wrap` with Chronos selected and the wallet on Auto EVM (chain 8700), wrap `N` `tAI3`.
- [ ] Native balance dropped by `N` + gas; WAI3 balance rose by **exactly** `N`.
- [ ] The `deposit()` tx on the Auto EVM explorer shows value = `N`.

### 2. Unwrap — instant
- [ ] On `/wrap`, unwrap `N` WAI3.
- [ ] WAI3 balance dropped by **exactly** `N`; native balance rose by `N` − gas.
- [ ] The `withdraw(N)` tx on the Auto EVM explorer shows the right amount.

### 3. Consensus → Auto EVM (XDM) — ~10 min
- [ ] On `/xdm/send`, direction **Consensus → Auto EVM**, recipient = your EVM address, amount `N`.
- [ ] Track on `/xdm/transfers`; wait for execution (~10 min / 100 domain blocks).
- [ ] On the Auto EVM explorer, **your EVM address** received the expected amount, and it matches the address you entered (not truncated or altered).

### 4. Auto EVM → Consensus (XDM) — ~1 day
- [ ] On `/xdm/send`, direction **Auto EVM → Consensus**, recipient = your Substrate (SS58) address, amount `N`.
- [ ] Track on `/xdm/transfers`; this direction finalises in ~1 day (14,400 domain blocks).
- [ ] On Subscan, **your Substrate address** received the expected amount.

> Asymmetry to plan around: wrap/unwrap and Consensus→EVM are quick; EVM→Consensus
> takes ~1 day, so kick it off early or verify it out-of-band of the release cut.

## Standing invariants

These must hold in any change. Breaking one means re-auditing the fund-safety
argument — not just updating the check.

- **No transaction input from external data.** Recipient, amount, and chain for
  any transaction come *only* from user-entered form state — never from URL
  query params, the indexer, or RPC responses. The URL-param vector is enforced
  by `test/tx-input-invariant.test.ts`; indexer/RPC-sourced inputs must be
  caught in review. (#30 §2.3)
- **Send the exact confirmed string.** Every flow passes the exact amount string
  the user confirmed to `ai3ToShannons` — no float ever touches the sent value,
  and the precision library throws (never silently rounds) on bad input. (#30 §2)
