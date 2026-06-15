import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createWalletStore } from '@autonomys/auto-wallet';
import type { WalletState } from '@autonomys/auto-wallet';

// Singleton store instance — shared across all components
let storeInstance: ReturnType<typeof createWalletStore> | null = null;

function getStore() {
  if (!storeInstance) {
    storeInstance = createWalletStore({
      dappName: 'Subspace Tools',
      ss58Prefix: 6094,
      storageKey: 'autonomys-helpers-substrate-wallet',
    });
  }
  return storeInstance;
}

type WalletSelectors = Pick<
  WalletState,
  | 'isConnected'
  | 'isLoading'
  | 'loadingType'
  | 'connectionError'
  | 'selectedWallet'
  | 'selectedAccount'
  | 'accounts'
  | 'injector'
  | 'availableWallets'
  | 'connectWallet'
  | 'disconnectWallet'
  | 'selectAccount'
  | 'clearError'
>;

/**
 * React hook wrapping @autonomys/auto-wallet Zustand store.
 * Uses a singleton store so wallet state is shared across the app.
 */
export function useSubstrateWallet(): WalletSelectors {
  const store = getStore();
  const detected = useRef(false);

  // Detect wallets once on mount
  useEffect(() => {
    if (!detected.current) {
      detected.current = true;
      store.getState().detectWallets();
    }
  }, [store]);

  const state = store(useShallow((s) => ({
    isConnected: s.isConnected,
    isLoading: s.isLoading,
    loadingType: s.loadingType,
    connectionError: s.connectionError,
    selectedWallet: s.selectedWallet,
    selectedAccount: s.selectedAccount,
    accounts: s.accounts,
    injector: s.injector,
    availableWallets: s.availableWallets,
    connectWallet: s.connectWallet,
    disconnectWallet: s.disconnectWallet,
    selectAccount: s.selectAccount,
    clearError: s.clearError,
  })));

  return state;
}
