import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import SegmentedControl from '../../components/SegmentedControl';
import NetworkSelector from '../../components/NetworkSelector';
import SubstrateWalletConnect from '../../components/wallet/SubstrateWalletConnect';
import EvmWalletConnect from '../../components/wallet/EvmWalletConnect';
import SendForm from '../../components/SendForm';
import { useSubstrateWallet } from '../../components/wallet/useSubstrateWallet';
import { useEvmWallet } from '../../components/wallet/useEvmWallet';
import { NETWORKS, getEvmChainDisplayName, type NetworkType } from '../../config/networks';
import { describeWalletError } from '../../utils/walletErrors';
import {
  transferConsensusToEvm,
  transferEvmToConsensus,
  type TransferDirection,
} from '../../utils/xdmTransfer';

const DIRECTIONS: { value: TransferDirection; label: string }[] = [
  { value: 'consensus-to-evm', label: 'Consensus → Auto EVM' },
  { value: 'evm-to-consensus', label: 'Auto EVM → Consensus' },
];

export default function SendPage() {
  const router = useRouter();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('mainnet');
  const [direction, setDirection] = useState<TransferDirection>('consensus-to-evm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const substrateWallet = useSubstrateWallet();
  const evmWallet = useEvmWallet();

  const isConsensusToEvm = direction === 'consensus-to-evm';
  const networkConfig = NETWORKS[selectedNetwork];

  // Determine sender address based on direction
  const senderAddress = isConsensusToEvm
    ? substrateWallet.selectedAccount?.address ?? null
    : evmWallet.address;

  const handleSwitchEvmChain = useCallback(async () => {
    await evmWallet.switchChain(
      networkConfig.evmChainId,
      getEvmChainDisplayName(selectedNetwork),
      networkConfig.evmRpcHttp,
      networkConfig.networkImage,
      networkConfig.nativeSymbol,
    );
  }, [evmWallet, networkConfig]);

  const handleSubmit = useCallback(async (recipient: string, amountAi3: string) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isConsensusToEvm) {
        if (!substrateWallet.injector || !substrateWallet.selectedAccount) {
          throw new Error('Substrate wallet not connected');
        }
        await transferConsensusToEvm({
          network: selectedNetwork,
          injector: substrateWallet.injector,
          senderAddress: substrateWallet.selectedAccount.address,
          recipientEvmAddress: recipient,
          amountAi3,
        });
      } else {
        if (!evmWallet.signer) {
          throw new Error('EVM wallet not connected');
        }
        await transferEvmToConsensus({
          signer: evmWallet.signer,
          recipientSs58Address: recipient,
          amountAi3,
        });
      }

      // Redirect to transfers page to track progress
      const searchAddr = senderAddress ?? '';
      router.push(`/xdm/transfers?search=${encodeURIComponent(searchAddr)}&network=${selectedNetwork}`);
    } catch (err) {
      console.error('Transfer failed:', err);
      setSubmitError(describeWalletError(err, 'Transfer failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isConsensusToEvm, substrateWallet, evmWallet, selectedNetwork, senderAddress, router]);

  const isEvmWrongChain = evmWallet.isConnected && evmWallet.chainId !== networkConfig.evmChainId;

  return (
    <div className="container py-3 py-md-5" style={{ maxWidth: 640 }}>
      <h1 className="fs-3">Send XDM Transfer</h1>
      <p className="text-muted mb-4">
        Transfer AI3 tokens between the Consensus chain and Auto EVM domain.
      </p>

      <NetworkSelector
        selectedNetwork={selectedNetwork}
        onChange={setSelectedNetwork}
      />

      <div className="mb-4">
        <label className="form-label fw-bold">Transfer Direction:</label>
        <SegmentedControl
          name="directionToggle"
          ariaLabel="Transfer direction"
          value={direction}
          options={DIRECTIONS}
          onChange={(value) => {
            setDirection(value);
            setSubmitError(null);
          }}
        />
      </div>

      <div className="mb-4">
        <label className="form-label fw-bold">
          {isConsensusToEvm ? 'Substrate Wallet (Source):' : 'EVM Wallet (Source):'}
        </label>
        {isConsensusToEvm ? (
          <SubstrateWalletConnect
            isConnected={substrateWallet.isConnected}
            isLoading={substrateWallet.isLoading}
            connectionError={substrateWallet.connectionError}
            selectedAccount={substrateWallet.selectedAccount}
            accounts={substrateWallet.accounts}
            availableWallets={substrateWallet.availableWallets}
            onConnect={substrateWallet.connectWallet}
            onDisconnect={substrateWallet.disconnectWallet}
            onSelectAccount={substrateWallet.selectAccount}
            onClearError={substrateWallet.clearError}
          />
        ) : (
          <EvmWalletConnect
            isConnected={evmWallet.isConnected}
            isLoading={evmWallet.isLoading}
            address={evmWallet.address}
            chainId={evmWallet.chainId}
            expectedChainId={networkConfig.evmChainId}
            expectedChainName={getEvmChainDisplayName(selectedNetwork)}
            error={evmWallet.error}
            discoveredWallets={evmWallet.discoveredWallets}
            hasDetected={evmWallet.hasDetected}
            hasLegacyProvider={evmWallet.hasLegacyProvider}
            connectedRdns={evmWallet.connectedRdns}
            onConnect={evmWallet.connect}
            onDisconnect={evmWallet.disconnect}
            onSwitchChain={handleSwitchEvmChain}
            onClearError={evmWallet.clearError}
          />
        )}
      </div>

      <SendForm
        direction={direction}
        network={selectedNetwork}
        senderAddress={!isConsensusToEvm && isEvmWrongChain ? null : senderAddress}
        evmProvider={evmWallet.provider}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </div>
  );
}
