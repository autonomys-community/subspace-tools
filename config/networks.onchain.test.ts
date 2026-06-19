import { afterAll, describe, expect, it } from 'vitest';
import { Contract, JsonRpcProvider } from 'ethers';
import { NETWORKS, type NetworkType } from './networks';

// Minimal ABI kept local so this test does not import utils/wai3 (which pulls
// the @autonomys/* SDKs in). The deposit()/withdraw() surface is verified via
// the bytecode selectors below instead.
const ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];
const DEPOSIT_SELECTOR = 'd0e30db0'; // deposit()
const WITHDRAW_SELECTOR = '2e1a7d4d'; // withdraw(uint256)

const keys = Object.keys(NETWORKS) as NetworkType[];

// Live RPC checks — opt in with RUN_ONCHAIN=1 (npm run test:onchain). Kept out
// of the default `npm test` run so that suite stays hermetic and offline-safe.
// This is the layer that catches a well-formed-but-wrong wai3Address: it
// confirms each configured address is actually a WAI3 contract on the chain
// the config claims.
describe.skipIf(!process.env.RUN_ONCHAIN)('NETWORKS on-chain reality (live RPC)', () => {
  for (const key of keys) {
    describe(key, () => {
      const cfg = NETWORKS[key];
      const provider = new JsonRpcProvider(cfg.evmRpcHttp);
      afterAll(() => provider.destroy());

      it('RPC chainId matches config.evmChainId', async () => {
        const net = await provider.getNetwork();
        expect(Number(net.chainId)).toBe(cfg.evmChainId);
      });

      it('wai3Address has code exposing deposit() and withdraw()', async () => {
        const code = (await provider.getCode(cfg.wai3Address)).toLowerCase();
        expect(code.length).toBeGreaterThan(2);
        expect(code).toContain(DEPOSIT_SELECTOR);
        expect(code).toContain(WITHDRAW_SELECTOR);
      });

      it('contract symbol matches config and reports 18 decimals', async () => {
        const c = new Contract(cfg.wai3Address, ABI, provider);
        expect(await c.symbol()).toBe(cfg.wrappedSymbol);
        expect(Number(await c.decimals())).toBe(18);
      });
    });
  }
});
