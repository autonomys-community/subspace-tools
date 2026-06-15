import React, { useState, useCallback } from 'react';
import TransferCard from './TransferCard';
import { XdmTransfer } from '../utils/fetchTransfers';
import { TransferProgress, transferKey } from '../utils/fetchTransferProgress';
import { NetworkType } from '../config/networks';

interface TransferListProps {
  transfers: XdmTransfer[];
  searchAddress: string;
  progress?: Map<string, TransferProgress>;
  network: NetworkType;
  onSearchAddress?: (address: string) => void;
}

const TransferList: React.FC<TransferListProps> = ({ transfers, searchAddress, progress, network, onSearchAddress }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const params = new URLSearchParams({ search: searchAddress });
    if (network !== 'mainnet') {
      params.set('network', network);
    }
    const url = `${window.location.origin}/xdm/transfers/?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [searchAddress, network]);

  if (transfers.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        No transfers found for this address.
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted">
          Found {transfers.length} transfer{transfers.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
          onClick={handleShare}
          title={copied ? 'Link copied!' : 'Copy shareable link to clipboard'}
        >
          {copied ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </>
          )}
        </button>
      </div>
      {transfers.map((transfer) => (
        <TransferCard
          key={transferKey(transfer)}
          transfer={transfer}
          searchAddress={searchAddress}
          progress={progress?.get(transferKey(transfer))}
          initiatedAt={transfer.initiated_src_block?.block_time
            ? new Date(transfer.initiated_src_block.block_time)
            : undefined}
          network={network}
          onSearchAddress={onSearchAddress}
        />
      ))}
    </div>
  );
};

export default TransferList;
