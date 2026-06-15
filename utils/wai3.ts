import { ai3ToShannons, shannonsToAi3 } from '@autonomys/auto-utils';
import { Contract } from 'ethers';
import type { ContractRunner, JsonRpcSigner } from 'ethers';
import { NETWORKS, type NetworkType } from '../config/networks';
import { getEvmFeeOverrides } from './evmFees';

/**
 * Minimal ABI for the WAI3 contract.
 * WAI3 is a WETH-style wrapper: `deposit()` wraps native AI3 sent with the tx,
 * `withdraw(uint256)` unwraps WAI3 back to native AI3, and standard ERC-20
 * methods expose balance and metadata.
 */
export const WAI3_ABI = [
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

export interface WrapResult {
  success: boolean;
  txHash: string;
  blockNumber?: number;
}

/**
 * Wrap native AI3 into WAI3 by calling `deposit()` with the native amount as value.
 */
export async function wrapAi3(params: {
  network: NetworkType;
  signer: JsonRpcSigner;
  amountAi3: string;
}): Promise<WrapResult> {
  const { network, signer, amountAi3 } = params;
  const { wai3Address } = NETWORKS[network];
  const value = ai3ToShannons(amountAi3);

  const contract = new Contract(wai3Address, WAI3_ABI, signer);
  const tx = await contract.deposit({
    value,
    ...(await getEvmFeeOverrides(signer)),
  });
  const receipt = await tx.wait();
  return {
    success: receipt?.status === 1,
    txHash: tx.hash,
    blockNumber: receipt?.blockNumber,
  };
}

/**
 * Unwrap WAI3 back into native AI3 by calling `withdraw(amount)`.
 */
export async function unwrapWai3(params: {
  network: NetworkType;
  signer: JsonRpcSigner;
  amountAi3: string;
}): Promise<WrapResult> {
  const { network, signer, amountAi3 } = params;
  const { wai3Address } = NETWORKS[network];
  const amount = ai3ToShannons(amountAi3);

  const contract = new Contract(wai3Address, WAI3_ABI, signer);
  const tx = await contract.withdraw(amount, await getEvmFeeOverrides(signer));
  const receipt = await tx.wait();
  return {
    success: receipt?.status === 1,
    txHash: tx.hash,
    blockNumber: receipt?.blockNumber,
  };
}

/**
 * Read the WAI3 balance of an address in Shannons (the smallest unit, 1e-18 AI3).
 *
 * Returns the raw bigint so callers can do exact comparisons against
 * `ai3ToShannons(amount)` and avoid the JS-number rounding that bit us
 * before (Number(formatUnits(...)).toFixed(4) can round *up*, which made
 * MAX / insufficient-balance checks let through amounts slightly larger
 * than the wallet actually holds).
 *
 * Use `shannonsToAi3` from @autonomys/auto-utils to format for display.
 */
export async function getWai3BalanceShannons(
  network: NetworkType,
  provider: ContractRunner,
  address: string,
): Promise<bigint> {
  const { wai3Address } = NETWORKS[network];
  const contract = new Contract(wai3Address, WAI3_ABI, provider);
  return await contract.balanceOf(address);
}

/**
 * Format a Shannon amount as an AI3 display string truncated to a fixed
 * number of decimal places. Truncation never inflates the displayed value
 * above what's actually there, which matters for balances feeding into
 * MAX and validation.
 */
export function formatShannonsAi3(shannons: bigint, decimals = 4): string {
  const precise = shannonsToAi3(shannons);
  const [intPart, fracPart = ''] = precise.split('.');
  if (decimals === 0) return intPart;
  return `${intPart}.${fracPart.slice(0, decimals).padEnd(decimals, '0')}`;
}

export type AddWai3Result =
  | { ok: true }
  | { ok: false; reason: 'no-wallet' | 'wrong-chain' | 'declined' };

/**
 * Ask the connected wallet to track WAI3 as an ERC-20.
 *
 * wallet_watchAsset registers the address against the wallet's *current*
 * chain — there's no way to specify which chain the token belongs to. So
 * we verify the wallet is on the expected Auto EVM chain before issuing
 * the request; otherwise the user ends up with e.g. the mainnet WAI3
 * address showing up as a token on Chronos.
 *
 * Pass the raw EIP-1193 provider the user picked at connect time so the
 * request routes to the right extension on multi-wallet setups. Falls
 * back to window.ethereum for older wallets that don't implement
 * EIP-6963.
 */
export async function addWai3ToWallet(
  network: NetworkType,
  rawProvider?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null,
): Promise<AddWai3Result> {
  const target = rawProvider ?? (typeof window !== 'undefined' ? window.ethereum : undefined);
  if (!target) return { ok: false, reason: 'no-wallet' };
  const { wai3Address, wrappedSymbol, evmChainId, wrappedTokenImage } = NETWORKS[network];
  try {
    const walletChainHex = await target.request({ method: 'eth_chainId' }) as string;
    const walletChainId = parseInt(walletChainHex, 16);
    if (walletChainId !== evmChainId) {
      return { ok: false, reason: 'wrong-chain' };
    }
    const result = await target.request({
      method: 'wallet_watchAsset',
      // wallet_watchAsset expects an object, not an array — MetaMask accepts both
      // but the EIP-747 shape is a plain object. Cast to the loose params type.
      params: {
        type: 'ERC20',
        options: {
          address: wai3Address,
          symbol: wrappedSymbol,
          decimals: 18,
          // Absolute URL: the wallet fetches this itself. Wallets that
          // honour EIP-747's image field (e.g. MetaMask) show it as the
          // token icon; others ignore it.
          image: wrappedTokenImage,
        },
      } as unknown as unknown[],
    });
    return result ? { ok: true } : { ok: false, reason: 'declined' };
  } catch {
    return { ok: false, reason: 'declined' };
  }
}
