import { describe, it, expect } from 'vitest';
import { getAddress, isAddress } from 'ethers';
import { NETWORKS, type NetworkType } from './networks';

const keys = Object.keys(NETWORKS) as NetworkType[];

// Hermetic structural checks — no network access. These catch malformed or
// typo'd config (bad checksum, wrong scheme, accidental copy-paste between
// networks). They CANNOT catch a well-formed-but-wrong address pointing at the
// wrong contract — that is what config/networks.onchain.test.ts verifies.
describe('NETWORKS config integrity (hermetic)', () => {
  it('defines exactly the expected networks', () => {
    expect([...keys].sort()).toEqual(['chronos', 'mainnet']);
  });

  it.each(keys)('%s: networkId matches its key', (key) => {
    expect(NETWORKS[key].networkId).toBe(key);
  });

  it.each(keys)('%s: wai3Address is a well-formed, checksum-valid EVM address', (key) => {
    const addr = NETWORKS[key].wai3Address;
    expect(isAddress(addr)).toBe(true);
    // getAddress throws on a bad EIP-55 checksum — catches a single-character
    // typo in a checksummed address before it can ship.
    expect(() => getAddress(addr)).not.toThrow();
  });

  it.each(keys)('%s: evmChainId is a positive integer', (key) => {
    const id = NETWORKS[key].evmChainId;
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
  });

  it.each(keys)('%s: domainId is 0 (Auto EVM)', (key) => {
    expect(NETWORKS[key].domainId).toBe(0);
  });

  it.each(keys)('%s: consensus and autoEvm RPCs use wss://', (key) => {
    expect(NETWORKS[key].rpc.consensus.startsWith('wss://')).toBe(true);
    expect(NETWORKS[key].rpc.autoEvm.startsWith('wss://')).toBe(true);
  });

  it.each(keys)('%s: evmRpcHttp, indexer and explorers use https://', (key) => {
    const cfg = NETWORKS[key];
    expect(cfg.evmRpcHttp.startsWith('https://')).toBe(true);
    expect(cfg.indexer.startsWith('https://')).toBe(true);
    expect(cfg.explorers.consensus.startsWith('https://')).toBe(true);
    expect(cfg.explorers.autoEvm.startsWith('https://')).toBe(true);
  });

  it('no two networks share a WAI3 address (guards a copy-paste swap)', () => {
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
