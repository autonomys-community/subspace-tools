import { describe, it, expect } from 'vitest';
import { NETWORKS, type NetworkType } from './networks';

const keys = Object.keys(NETWORKS) as NetworkType[];

// Hermetic guards against the failure mode this config is actually prone to:
// it is built by copy-pasting a network block, so the real risk is forgetting
// to change a per-network value (e.g. leaving chronos pointing at mainnet's
// networkId or WAI3 contract). These run offline on every PR.
//
// A *well-formed-but-wrong* address — one that passes every structural check
// but points at the wrong contract — can only be caught against the chain.
// That is config/networks.onchain.test.ts, which CI runs whenever this config
// changes.
describe('NETWORKS config integrity', () => {
  it.each(keys)('%s: networkId matches its key', (key) => {
    expect(NETWORKS[key].networkId).toBe(key);
  });

  it('no two networks share a WAI3 contract address', () => {
    const addrs = keys.map((k) => NETWORKS[k].wai3Address.toLowerCase());
    expect(new Set(addrs).size).toBe(addrs.length);
  });

  it('every network has a distinct chainId and indexer host', () => {
    const ids = keys.map((k) => NETWORKS[k].evmChainId);
    expect(new Set(ids).size).toBe(ids.length);
    const hosts = keys.map((k) => new URL(NETWORKS[k].indexer).host);
    expect(new Set(hosts).size).toBe(hosts.length);
  });
});
