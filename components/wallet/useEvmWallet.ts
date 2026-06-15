import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import {
  listenForProviders,
  type Eip1193Provider,
  type Eip6963ProviderDetail,
} from './eip6963';

interface EvmWalletState {
  isConnected: boolean;
  isLoading: boolean;
  address: string | null;
  chainId: number | null;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  error: string | null;
  /** Wallets that announced themselves via EIP-6963. */
  discoveredWallets: Eip6963ProviderDetail[];
  /** True once we've mounted and queried for wallets. False during SSR / first render. */
  hasDetected: boolean;
  /** True if `window.ethereum` is present (older wallets that don't implement EIP-6963). */
  hasLegacyProvider: boolean;
  /** Stable identifier (rdns) of the wallet that's currently connected, if any. */
  connectedRdns: string | null;
  /** Raw EIP-1193 provider of the currently-connected wallet, for direct request() calls. */
  rawProvider: Eip1193Provider | null;
  /**
   * Connect to a specific wallet by rdns. If omitted, falls back to
   * `window.ethereum` for older wallets that don't announce.
   */
  connect: (rdns?: string) => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number, chainName: string, rpcUrl: string, iconUrl?: string, nativeSymbol?: string) => Promise<void>;
  clearError: () => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { isMetaMask?: boolean };
  }
}

/** rdns we use to mean "the unannounced window.ethereum provider". */
export const LEGACY_RDNS = 'legacy:window.ethereum';

/**
 * React hook for EVM wallet connection.
 *
 * Discovers all installed EIP-6963 wallets (MetaMask, Rabby, Brave, OKX,
 * Coinbase, etc.) so the UI can present a chooser. Falls back to
 * `window.ethereum` for older wallets that don't implement EIP-6963.
 */
export function useEvmWallet(): EvmWalletState {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveredWallets, setDiscoveredWallets] = useState<Eip6963ProviderDetail[]>([]);
  const [hasDetected, setHasDetected] = useState(false);
  const [hasLegacyProvider, setHasLegacyProvider] = useState(false);
  const [connectedRdns, setConnectedRdns] = useState<string | null>(null);
  const [rawProvider, setRawProvider] = useState<Eip1193Provider | null>(null);
  const mountedRef = useRef(true);
  // Ref-mirror of `rawProvider` so callbacks/effects see it without re-binding.
  const rawProviderRef = useRef<Eip1193Provider | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setChainId(null);
    setSigner(null);
    setProvider(null);
    setConnectedRdns(null);
    setRawProvider(null);
    rawProviderRef.current = null;
    setError(null);
  }, []);

  // Discover EIP-6963 wallets on mount, plus check for the legacy window.ethereum.
  useEffect(() => {
    const stop = listenForProviders((detail) => {
      if (!mountedRef.current) return;
      // Dedupe at the state level too, not just inside the helper: in React
      // Strict Mode (and any other effect-resubscribe path) the helper's
      // own Set is fresh while the discoveredWallets state survives, so
      // wallets re-announcing would otherwise double up here.
      setDiscoveredWallets((prev) =>
        prev.some((w) => w.info.rdns === detail.info.rdns) ? prev : [...prev, detail]
      );
    });
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasLegacyProvider(true);
    }
    // Give wallets enough time to respond before showing "no wallet
    // detected". Most extensions announce in well under 100ms, but a
    // longer-than-strictly-necessary timeout makes the "no wallet"
    // message essentially flash-free for late EIP-6963 announcements
    // (cold-started extensions, lazy-loading wallets). The listener
    // stays subscribed past this, so wallets that arrive even later
    // still appear in the picker - this timer only gates the "no
    // wallet" message, not discovery itself.
    const t = setTimeout(() => {
      if (mountedRef.current) setHasDetected(true);
    }, 1500);
    return () => {
      stop();
      clearTimeout(t);
    };
  }, []);

  const connect = useCallback(async (rdns?: string) => {
    // Pick the raw provider:
    //   - If a specific rdns was requested, use that exact wallet or fail.
    //     Silently falling back to window.ethereum would mean the user
    //     authorises and signs with a different extension than the one
    //     they clicked on, which on a multi-wallet setup is a real footgun.
    //   - If no rdns (or the legacy sentinel) was passed, use window.ethereum.
    let raw: Eip1193Provider | undefined;
    let chosenRdns: string | null = null;
    if (rdns && rdns !== LEGACY_RDNS) {
      const match = discoveredWallets.find((w) => w.info.rdns === rdns);
      if (!match) {
        setError(`Wallet "${rdns}" is no longer available. Please pick another from the list.`);
        return;
      }
      raw = match.provider;
      chosenRdns = rdns;
    } else {
      raw = window.ethereum;
      chosenRdns = window.ethereum ? LEGACY_RDNS : null;
    }
    if (!raw) {
      setError('No EVM wallet detected. Please install MetaMask, Rabby, or another browser wallet.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const browserProvider = new BrowserProvider(raw);
      await browserProvider.send('eth_requestAccounts', []);
      const jsonRpcSigner = await browserProvider.getSigner();
      const addr = await jsonRpcSigner.getAddress();
      const network = await browserProvider.getNetwork();

      if (mountedRef.current) {
        rawProviderRef.current = raw;
        setRawProvider(raw);
        setProvider(browserProvider);
        setSigner(jsonRpcSigner);
        setAddress(addr);
        setChainId(Number(network.chainId));
        setConnectedRdns(chosenRdns);
        setIsConnected(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to connect wallet';
        if (/user rejected/i.test(msg)) {
          setError('Connection rejected. Please try again.');
        } else {
          setError(msg);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [discoveredWallets]);

  const switchChain = useCallback(async (targetChainId: number, chainName: string, rpcUrl: string, iconUrl?: string, nativeSymbol: string = 'AI3') => {
    const raw = rawProviderRef.current ?? window.ethereum;
    if (!raw) return;

    const hexChainId = '0x' + targetChainId.toString(16);
    try {
      await raw.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: unknown) {
      // Chain not added yet — add it
      if (switchError && typeof switchError === 'object' && 'code' in switchError && (switchError as { code: number }).code === 4902) {
        try {
          await raw.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexChainId,
              chainName,
              nativeCurrency: { name: nativeSymbol, symbol: nativeSymbol, decimals: 18 },
              rpcUrls: [rpcUrl],
              // EIP-3085 network icon. Honoured by some wallets; MetaMask
              // currently ignores it (it only shows icons for networks in
              // its own registry), but it's harmless and forward-compatible.
              iconUrls: iconUrl ? [iconUrl] : undefined,
            }],
          });
        } catch (addError) {
          setError(addError instanceof Error ? addError.message : 'Failed to add network');
        }
      } else {
        setError(switchError instanceof Error ? switchError.message : 'Failed to switch network');
      }
    }
  }, []);

  // Listen for account and chain changes on the *connected* provider.
  useEffect(() => {
    const raw = rawProviderRef.current;
    if (!raw || !isConnected) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else if (mountedRef.current) {
        setAddress(accounts[0]);
        if (provider) {
          try {
            const newSigner = await provider.getSigner();
            setSigner(newSigner);
          } catch {
            disconnect();
          }
        }
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const newChainId = args[0] as string;
      if (mountedRef.current) {
        setChainId(parseInt(newChainId, 16));
        const newProvider = new BrowserProvider(raw);
        setProvider(newProvider);
        newProvider.getSigner().then(s => {
          if (mountedRef.current) setSigner(s);
        }).catch(() => {
          if (mountedRef.current) disconnect();
        });
      }
    };

    raw.on('accountsChanged', handleAccountsChanged);
    raw.on('chainChanged', handleChainChanged);

    return () => {
      raw.removeListener('accountsChanged', handleAccountsChanged);
      raw.removeListener('chainChanged', handleChainChanged);
    };
  }, [isConnected, provider, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return {
    isConnected,
    isLoading,
    address,
    chainId,
    signer,
    provider,
    error,
    discoveredWallets,
    hasDetected,
    hasLegacyProvider,
    connectedRdns,
    rawProvider,
    connect,
    disconnect,
    switchChain,
    clearError,
  };
}
