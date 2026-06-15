import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Accordion, Alert, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import SegmentedControl from '../components/SegmentedControl';
import { JsonRpcProvider } from 'ethers';
import { ai3ToShannons, shannonsToAi3 } from '@autonomys/auto-utils';
import NetworkSelector from '../components/NetworkSelector';
import EvmWalletConnect from '../components/wallet/EvmWalletConnect';
import { useEvmWallet } from '../components/wallet/useEvmWallet';
import { NETWORKS, getEvmChainDisplayName, type NetworkType } from '../config/networks';
import {
  addWai3ToWallet,
  formatShannonsAi3,
  getWai3BalanceShannons,
  unwrapWai3,
  wrapAi3,
} from '../utils/wai3';
import { describeWalletError } from '../utils/walletErrors';

// Leave this much native AI3 in the wallet to cover gas when the user clicks
// MAX on a wrap. 0.01 AI3 ≈ enough for several txs at typical Auto EVM fees.
const GAS_BUFFER_SHANNONS = ai3ToShannons('0.01');

type WrapDirection = 'wrap' | 'unwrap';

function directionLabel(direction: WrapDirection, nativeSymbol: string, wrappedSymbol: string): string {
  return direction === 'wrap'
    ? `Wrap ${nativeSymbol} -> ${wrappedSymbol}`
    : `Unwrap ${wrappedSymbol} -> ${nativeSymbol}`;
}

const DIRECTIONS: WrapDirection[] = ['wrap', 'unwrap'];

const DOCS_URL = 'https://develop.autonomys.xyz/evm/wrapping_ai3';

export default function WrapPage() {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('mainnet');
  const [direction, setDirection] = useState<WrapDirection>('wrap');
  const [amount, setAmount] = useState('');
  // Balances tracked in Shannons (BigInt) for exact arithmetic. Formatted
  // for display with formatShannonsAi3.
  const [nativeShannons, setNativeShannons] = useState<bigint | null>(null);
  const [wai3Shannons, setWai3Shannons] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [addTokenStatus, setAddTokenStatus] = useState<string | null>(null);

  const evmWallet = useEvmWallet();
  const networkConfig = NETWORKS[selectedNetwork];
  const nativeSymbol = networkConfig.nativeSymbol;
  const wrappedSymbol = networkConfig.wrappedSymbol;
  const isWrap = direction === 'wrap';
  const isWrongChain = evmWallet.isConnected && evmWallet.chainId !== networkConfig.evmChainId;

  // Read balances through a direct JSON-RPC provider, not the wallet's
  // injected provider. The wallet caches state from its own block tracker
  // (MetaMask polls every ~4s), so eth_getBalance immediately after
  // tx.wait() returns can come back with the pre-tx state. Reading
  // directly from the chain RPC always returns the latest committed
  // state - and since balance lookups are public, the wallet isn't
  // needed for them.
  const readProvider = useMemo(
    () => new JsonRpcProvider(networkConfig.evmRpcHttp),
    [networkConfig.evmRpcHttp]
  );

  const handleSwitchEvmChain = useCallback(async () => {
    await evmWallet.switchChain(
      networkConfig.evmChainId,
      getEvmChainDisplayName(selectedNetwork),
      networkConfig.evmRpcHttp,
      networkConfig.networkImage,
      networkConfig.nativeSymbol,
    );
  }, [evmWallet, networkConfig]);

  // Refresh balances when address, network, chain, or last-tx changes.
  useEffect(() => {
    if (!evmWallet.address || isWrongChain) {
      setNativeShannons(null);
      setWai3Shannons(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    (async () => {
      try {
        const [native, wai3] = await Promise.all([
          readProvider.getBalance(evmWallet.address!),
          getWai3BalanceShannons(selectedNetwork, readProvider, evmWallet.address!),
        ]);
        if (!cancelled) {
          setNativeShannons(native);
          setWai3Shannons(wai3);
        }
      } catch (err) {
        console.error('Failed to fetch balances:', err);
        // Clear stale balances so validation and MAX don't operate on
        // figures that no longer match the current address / network.
        if (!cancelled) {
          setNativeShannons(null);
          setWai3Shannons(null);
        }
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [evmWallet.address, readProvider, evmWallet.chainId, selectedNetwork, isWrongChain, txHash]);

  // Reset form on direction/network change. Closing the confirm modal here
  // matters: otherwise it can survive a network switch and then submit the
  // (now stale) amount against the newly-selected network's contract.
  useEffect(() => {
    setAmount('');
    setValidationError(null);
    setSubmitError(null);
    setTxHash(null);
    setAddTokenStatus(null);
    setShowConfirm(false);
  }, [direction, selectedNetwork]);

  // Close the confirm modal if the wallet's chain or account changes while
  // it's open. Otherwise a user could open the modal on the right chain /
  // account, switch in the wallet, then submit a wrap/unwrap against the
  // UI network with a signer on a different chain or account.
  useEffect(() => {
    setShowConfirm(false);
  }, [evmWallet.chainId, evmWallet.address]);

  const sourceShannons = isWrap ? nativeShannons : wai3Shannons;
  const sourceSymbol = isWrap ? nativeSymbol : wrappedSymbol;
  const targetSymbol = isWrap ? wrappedSymbol : nativeSymbol;

  const validate = useCallback((): string | null => {
    if (!amount.trim()) return 'Amount is required.';
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return 'Amount must be greater than 0.';
    // We must know the source balance before allowing submission; null
    // means it's still loading or the last fetch failed.
    if (sourceShannons === null) {
      return `${sourceSymbol} balance not loaded yet. Please wait or reconnect.`;
    }
    // Compare in Shannons (BigInt) so we don't let through amounts that
    // round up to within balance but actually exceed it. ai3ToShannons may
    // throw on out-of-bounds input (e.g. >18 decimals); catch that as a
    // validation error rather than letting the chain reject it.
    let amountShannons: bigint;
    try {
      amountShannons = ai3ToShannons(amount.trim(), { rounding: 'truncate' });
    } catch {
      return 'Amount has too many decimal places. Please use up to 18.';
    }
    if (amountShannons <= BigInt(0)) return 'Amount must be greater than 0.';
    if (amountShannons > sourceShannons) {
      return `Insufficient ${sourceSymbol} balance.`;
    }
    return null;
  }, [amount, sourceShannons, sourceSymbol]);

  const handleSetMax = useCallback(() => {
    if (sourceShannons === null) return;
    if (isWrap) {
      // Wrap consumes native AI3 for gas, so leave a buffer.
      const max = sourceShannons > GAS_BUFFER_SHANNONS
        ? sourceShannons - GAS_BUFFER_SHANNONS
        : BigInt(0);
      setAmount(max > BigInt(0) ? shannonsToAi3(max) : '0');
    } else {
      // Unwrap doesn't move native AI3, so the user can unwrap the full
      // WAI3 balance.
      setAmount(shannonsToAi3(sourceShannons));
    }
  }, [sourceShannons, isWrap]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setShowConfirm(true);
  }, [validate]);

  const handleConfirm = useCallback(async () => {
    // Guard against double-click races: setIsSubmitting(true) below isn't
    // visible to a synchronous second click, so check the flag directly.
    if (isSubmitting) return;
    setShowConfirm(false);
    if (!evmWallet.signer) {
      setSubmitError('EVM wallet not connected.');
      return;
    }
    // Re-validate at submit time so a closure captured before the user
    // changed network / amount / balance can't ship a stale request.
    const validationErr = validate();
    if (validationErr) {
      setSubmitError(validationErr);
      return;
    }
    // Verify the wallet is still on the network we're about to transact
    // against - chain switches in the wallet are async and the modal-close
    // effect may race with this submit.
    if (evmWallet.chainId !== networkConfig.evmChainId) {
      setSubmitError(
        `Wallet is on chain ${evmWallet.chainId ?? '?'} but the UI is targeting ${networkConfig.name} (chain ${networkConfig.evmChainId}). Switch your wallet and try again.`,
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setTxHash(null);
    try {
      const result = isWrap
        ? await wrapAi3({ network: selectedNetwork, signer: evmWallet.signer, amountAi3: amount.trim() })
        : await unwrapWai3({ network: selectedNetwork, signer: evmWallet.signer, amountAi3: amount.trim() });
      // result.success mirrors receipt.status === 1. A mined-but-reverted tx
      // has success === false; still surface its hash so the user can inspect
      // it on the explorer, but flag the failure rather than showing a
      // green "submitted" confirmation.
      setTxHash(result.txHash);
      if (result.success) {
        setAmount('');
      } else {
        setSubmitError('Transaction was mined but reverted on-chain. Inspect it on the explorer for details.');
      }
    } catch (err) {
      console.error('Transaction failed:', err);
      setSubmitError(describeWalletError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, evmWallet.signer, evmWallet.chainId, networkConfig.evmChainId, networkConfig.name, isWrap, selectedNetwork, amount, validate]);

  const handleAddNetwork = useCallback(async () => {
    await evmWallet.switchChain(
      networkConfig.evmChainId,
      getEvmChainDisplayName(selectedNetwork),
      networkConfig.evmRpcHttp,
      networkConfig.networkImage,
      networkConfig.nativeSymbol,
    );
  }, [evmWallet, networkConfig]);

  const handleAddToken = useCallback(async () => {
    setAddTokenStatus(null);
    const result = await addWai3ToWallet(selectedNetwork, evmWallet.rawProvider);
    if (result.ok) {
      setAddTokenStatus(`${wrappedSymbol} was added to your wallet.`);
    } else if (result.reason === 'wrong-chain') {
      setAddTokenStatus(
        `Switch your wallet to ${networkConfig.name} Auto EVM (chain ${networkConfig.evmChainId}) before adding ${wrappedSymbol}.`,
      );
    } else if (result.reason === 'no-wallet') {
      setAddTokenStatus('No EVM wallet detected.');
    } else {
      setAddTokenStatus(`Could not add ${wrappedSymbol} - your wallet may not support this, or you declined.`);
    }
  }, [selectedNetwork, wrappedSymbol, networkConfig.name, networkConfig.evmChainId, evmWallet.rawProvider]);

  const explorerBase = networkConfig.explorers.autoEvm;
  const contractExplorerUrl = `${explorerBase}/address/${networkConfig.wai3Address}`;
  const txExplorerUrl = txHash ? `${explorerBase}/tx/${txHash}` : null;

  return (
    <div className="container py-3 py-md-5" style={{ maxWidth: 720 }}>
      <h1 className="fs-3">Wrap & Unwrap AI3</h1>
      <p className="text-muted">
        Convert native AI3 into the ERC-20 token <strong>WAI3</strong>, and back.
      </p>

      <Accordion className="mb-4">
        <Accordion.Item eventKey="why-wrap">
          <Accordion.Header>Why wrap?</Accordion.Header>
          <Accordion.Body>
            <ul className="small mb-2">
              <li>
                <strong>Native AI3</strong> is the Auto EVM gas token - like ETH on Ethereum.
                Most smart contracts can&apos;t accept it directly as a function argument.
              </li>
              <li>
                <strong>WAI3</strong> is a standard ERC-20 backed 1:1 by native AI3 held in
                the wrapper contract. Most dapps, including DeFi protocols and AMMs, expect an
                ERC-20 interface, so they need WAI3 rather than native AI3.
              </li>
              <li>
                Wrapping locks AI3 in the contract and mints WAI3 to you. Unwrapping burns WAI3
                and releases AI3 back to your account. The rate is always 1:1; no fees beyond gas.
              </li>
            </ul>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="small">
              Read the full docs
            </a>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <NetworkSelector selectedNetwork={selectedNetwork} onChange={setSelectedNetwork} disabled={isSubmitting} />

      <Card className="mb-4">
        <Card.Body>
          <div className="fw-bold mb-2">Step 1 - Connect EVM wallet</div>
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
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Body>
          <div className="fw-bold mb-2">Step 2 - Prepare your wallet</div>
          <p className="small text-muted mb-3">
            Add the {networkConfig.name} Auto EVM network (chain {networkConfig.evmChainId}) to
            your wallet, and optionally the {wrappedSymbol} token so it appears in your asset list.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleAddNetwork}
              // Require an active connection: switchChain routes through
              // the connected wallet's raw provider, so pre-connect we
              // wouldn't know which extension to add the network to on
              // a multi-wallet setup (and on EIP-6963-only wallets with
              // no window.ethereum the call would silently no-op).
              disabled={!evmWallet.isConnected || isSubmitting}
              title={!evmWallet.isConnected ? 'Connect a wallet first' : undefined}
            >
              Add network
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleAddToken}
              // Requires an active connection (so addWai3ToWallet can
              // route through the picked wallet) AND the wallet being on
              // the matching chain (otherwise wallet_watchAsset would
              // register this network's contract address against
              // whatever chain the wallet is currently on).
              disabled={
                !evmWallet.isConnected
                || isSubmitting
                || evmWallet.chainId !== networkConfig.evmChainId
              }
              title={
                !evmWallet.isConnected
                  ? 'Connect a wallet first'
                  : evmWallet.chainId !== networkConfig.evmChainId
                  ? `Switch your wallet to ${networkConfig.name} Auto EVM first`
                  : undefined
              }
            >
              Add token
            </Button>
          </div>
          {addTokenStatus && (
            <div className="small text-muted mt-2">{addTokenStatus}</div>
          )}
          <div className="small text-muted mt-2">
            WAI3 contract:{' '}
            <a href={contractExplorerUrl} target="_blank" rel="noopener noreferrer" className="font-monospace">
              {networkConfig.wai3Address}
            </a>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Body>
          <div className="fw-bold mb-2">Step 3 - Choose direction</div>
          <SegmentedControl
            name="wrapDirToggle"
            ariaLabel="Wrap direction"
            value={direction}
            disabled={isSubmitting}
            options={DIRECTIONS.map((d) => ({
              value: d,
              label: directionLabel(d, nativeSymbol, wrappedSymbol),
            }))}
            onChange={setDirection}
          />
          <div className="small text-muted mt-2">
            {isWrap ? (
              <>
                Wrapping calls the <code>payable</code> function{' '}
                <code>deposit()</code> on the WAI3 contract, attaching the amount of{' '}
                {nativeSymbol} as the transaction&apos;s <code>value</code>. The contract
                holds the {nativeSymbol} and mints an equal amount of {wrappedSymbol} to you.
              </>
            ) : (
              <>
                Unwrapping calls <code>withdraw(uint256 amount)</code> on the WAI3 contract,
                passing the amount as an argument. The contract burns your {wrappedSymbol}{' '}
                and releases an equal amount of native {nativeSymbol} back to your address.
              </>
            )}
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <div className="fw-bold mb-2">Step 4 - Enter amount</div>
          {!evmWallet.isConnected ? (
            <div className="text-muted small">Connect your wallet above to continue.</div>
          ) : isWrongChain ? (
            <Alert variant="warning" className="py-2 small mb-0">
              Switch your wallet to {networkConfig.name} Auto EVM to see balances.
            </Alert>
          ) : (
            <Form onSubmit={handleSubmit}>
              <div className="mb-3 small">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Native {nativeSymbol} balance:</span>
                  <span className="font-monospace">
                    {balanceLoading ? <Spinner size="sm" animation="border" /> : (nativeShannons !== null ? formatShannonsAi3(nativeShannons) : '-')}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">{wrappedSymbol} balance:</span>
                  <span className="font-monospace">
                    {balanceLoading ? <Spinner size="sm" animation="border" /> : (wai3Shannons !== null ? formatShannonsAi3(wai3Shannons) : '-')}
                  </span>
                </div>
              </div>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">
                  Amount ({sourceSymbol})
                </Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setValidationError(null);
                    }}
                    // Prevent the mouse wheel from changing the amount when the input is focused.
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    disabled={isSubmitting}
                  />
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleSetMax}
                    disabled={sourceShannons === null || isSubmitting}
                    className="flex-shrink-0"
                  >
                    MAX
                  </Button>
                </div>
                <Form.Text className="text-muted">
                  You will receive the same amount in {targetSymbol}.
                </Form.Text>
              </Form.Group>

              {validationError && (
                <Alert variant="warning" className="py-2 small">{validationError}</Alert>
              )}
              {submitError && (
                <Alert variant="danger" className="py-2 small">
                  {submitError}
                  {txExplorerUrl && (
                    <>
                      {' '}
                      <a href={txExplorerUrl} target="_blank" rel="noopener noreferrer">
                        View on explorer
                      </a>
                    </>
                  )}
                </Alert>
              )}
              {!submitError && txHash && txExplorerUrl && (
                <Alert variant="success" className="py-2 small">
                  Transaction submitted!{' '}
                  <a href={txExplorerUrl} target="_blank" rel="noopener noreferrer">
                    View on explorer
                  </a>
                </Alert>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-100"
                disabled={isSubmitting || !evmWallet.signer}
              >
                {isSubmitting ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    {isWrap ? 'Wrapping...' : 'Unwrapping...'}
                  </>
                ) : (
                  isWrap ? `Wrap ${nativeSymbol} -> ${wrappedSymbol}` : `Unwrap ${wrappedSymbol} -> ${nativeSymbol}`
                )}
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>

      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">
            Confirm {isWrap ? 'Wrap' : 'Unwrap'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2">
            <strong className="small text-muted">Network</strong>
            <div>{networkConfig.name} Auto EVM</div>
          </div>
          <div className="mb-2">
            <strong className="small text-muted">Action</strong>
            <div>
              {isWrap
                ? `Call deposit() on the WAI3 contract with ${amount} ${nativeSymbol} attached as value`
                : `Call withdraw(${amount}) on the WAI3 contract`}
            </div>
          </div>
          <div className="mb-2">
            <strong className="small text-muted">Amount</strong>
            <div className="fs-5 fw-bold">{amount} {sourceSymbol}</div>
          </div>
          <div className="mb-2">
            <strong className="small text-muted">You will receive</strong>
            <div>{amount} {targetSymbol}</div>
          </div>
          <div className="p-2 bg-light rounded small">
            Your wallet will prompt you to sign the transaction. Gas is paid in native{' '}
            {nativeSymbol}.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Confirm in Wallet'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
