import React from 'react';
import Image from 'next/image';
import { Button, Spinner, Alert } from 'react-bootstrap';
import type { Eip6963ProviderDetail } from './eip6963';
import { LEGACY_RDNS } from './useEvmWallet';

interface EvmWalletConnectProps {
  isConnected: boolean;
  isLoading: boolean;
  address: string | null;
  chainId: number | null;
  expectedChainId: number;
  expectedChainName: string;
  error: string | null;
  discoveredWallets: Eip6963ProviderDetail[];
  hasDetected: boolean;
  hasLegacyProvider: boolean;
  connectedRdns: string | null;
  onConnect: (rdns?: string) => Promise<void>;
  onDisconnect: () => void;
  onSwitchChain: () => Promise<void>;
  onClearError: () => void;
}

function shortenEvmAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const EvmWalletConnect: React.FC<EvmWalletConnectProps> = ({
  isConnected,
  isLoading,
  address,
  chainId,
  expectedChainId,
  expectedChainName,
  error,
  discoveredWallets,
  hasDetected,
  hasLegacyProvider,
  connectedRdns,
  onConnect,
  onDisconnect,
  onSwitchChain,
  onClearError,
}) => {
  const isWrongChain = isConnected && chainId !== null && chainId !== expectedChainId;

  if (isConnected && address) {
    const connectedWallet = discoveredWallets.find((w) => w.info.rdns === connectedRdns);
    return (
      <div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className={`badge ${isWrongChain ? 'bg-warning text-dark' : 'bg-success'}`}>
            {isWrongChain ? 'Wrong Network' : 'Connected'}
          </span>
          {connectedWallet && (
            <span className="d-inline-flex align-items-center gap-1 small text-muted">
              <Image
                src={connectedWallet.info.icon}
                alt=""
                width={16}
                height={16}
                unoptimized
              />
              {connectedWallet.info.name}
            </span>
          )}
          <span className="small" style={{ fontFamily: 'monospace' }}>
            {shortenEvmAddress(address)}
          </span>
          <Button variant="outline-secondary" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
        <div className="text-muted small mt-1" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {address}
        </div>

        {isWrongChain && (
          <Alert variant="warning" className="mt-2 py-2 small">
            Please switch to <strong>{expectedChainName}</strong> (Chain ID: {expectedChainId}).
            <Button
              variant="warning"
              size="sm"
              className="ms-2"
              onClick={onSwitchChain}
            >
              Switch Network
            </Button>
          </Alert>
        )}
      </div>
    );
  }

  // Connect view: render one button per discovered wallet, plus a legacy
  // fallback button when window.ethereum is present but no EIP-6963
  // announcement was made.
  const showLegacyFallback = hasLegacyProvider && discoveredWallets.length === 0;
  const noWallets = hasDetected && discoveredWallets.length === 0 && !hasLegacyProvider;

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={onClearError} className="mb-2 py-2 small">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner animation="border" size="sm" />
          <span className="small">Connecting wallet…</span>
        </div>
      ) : noWallets ? (
        <div className="small text-muted">
          No EVM wallet detected. Install one to continue:{' '}
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">MetaMask</a>,{' '}
          <a href="https://rabby.io/" target="_blank" rel="noopener noreferrer">Rabby</a>,{' '}
          or any browser wallet that supports EIP-6963.
        </div>
      ) : (
        <div className="d-flex flex-column align-items-stretch gap-2" style={{ maxWidth: 320 }}>
          {discoveredWallets.map((w) => (
            <Button
              key={w.info.rdns}
              variant="outline-primary"
              size="sm"
              onClick={() => onConnect(w.info.rdns)}
              className="d-flex align-items-center gap-2 text-start"
            >
              <Image
                src={w.info.icon}
                alt=""
                width={20}
                height={20}
                unoptimized
              />
              <span>Connect {w.info.name}</span>
            </Button>
          ))}
          {showLegacyFallback && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => onConnect(LEGACY_RDNS)}
              className="d-flex align-items-center gap-2"
            >
              Connect Browser Wallet
            </Button>
          )}
          {!hasDetected && discoveredWallets.length === 0 && (
            <div className="d-flex align-items-center gap-2 text-muted small">
              <Spinner animation="border" size="sm" />
              <span>Detecting wallets…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvmWalletConnect;
