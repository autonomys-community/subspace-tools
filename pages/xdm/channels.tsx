import React, { useEffect, useState, useMemo } from 'react';
import SegmentedControl from '../../components/SegmentedControl';
import { fetchChannels } from '../../utils/fetchChannels';
import ChannelList from '../../components/ChannelList';
import ChainSummaryCard from '../../components/ChainSummaryCard';
import NetworkSelector from '../../components/NetworkSelector';
import { NETWORKS, NetworkType } from '../../config/networks';

export interface ChannelEntry {
  channelId: string;
  state: string;
  nextInboxNonce: string;
  nextOutboxNonce: string;
  latestResponseReceivedMessageNonce: string;
  maxOutgoingMessages: string;
  [key: string]: string;
}

type ChainType = 'consensus' | 'autoEvm';

function parseNumber(value: string | undefined): number {
  return Math.max(0, parseInt(value?.replace(/,/g, '') || '0', 10));
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('mainnet');
  const [selectedChain, setSelectedChain] = useState<ChainType>('consensus');

  const { endpoint, destinationChainId } = useMemo(() => {
    const rpc = NETWORKS[selectedNetwork].rpc;
    return {
      endpoint: selectedChain === 'consensus' ? rpc.consensus : rpc.autoEvm,
      destinationChainId: selectedChain === 'consensus' ? { Domain: 0 } : { Consensus: 0 }
    };
  }, [selectedNetwork, selectedChain]);

  useEffect(() => {
    setLoading(true);
    fetchChannels(endpoint, destinationChainId)
      .then((data) => {
        const validChannels = (data as unknown[])
          .filter((entry): entry is ChannelEntry =>
            typeof entry === 'object' &&
            entry !== null &&
            'channelId' in entry
          );

        console.log("Valid channels passed to state:", validChannels);
        setChannels(validChannels);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Fetching channels failed:', error);
        setLoading(false);
      });
  }, [endpoint, destinationChainId]);

  const summary = useMemo(() => {
    let totalCapacity = 0;
    let totalInbound = 0;
    let totalOutbound = 0;
    let totalPending = 0;

    channels.forEach((channel) => {
      const capacity = parseNumber(channel.maxOutgoingMessages);
      const inbox = parseNumber(channel.nextInboxNonce);
      const outbox = parseNumber(channel.nextOutboxNonce);
      const response = parseNumber(channel.latestResponseReceivedMessageNonce);

      if (channel.state === 'Open') {
        totalCapacity += capacity;
      }
      totalInbound += Math.max(0, inbox - 1);
      totalOutbound += Math.max(0, response);
      totalPending += Math.max(0, outbox - 1 - response);
    });

    return {
      totalChannels: channels.filter(channel => channel.state === 'Open').length,
      totalCapacity,
      totalInbound,
      totalOutbound,
      totalPending
    };
  }, [channels]);

  return (
    <div className="container py-5">
      <h1>XDM Channels Status</h1>

      <div className="mb-4">
        <div className="row">
          <div className="col-md-6 mb-3">
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onChange={setSelectedNetwork}
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label fw-bold">Select Chain:</label>
            <SegmentedControl
              name="chainToggle"
              ariaLabel="Select chain"
              value={selectedChain}
              onChange={setSelectedChain}
              options={[
                { value: 'consensus', label: 'Consensus Chain' },
                { value: 'autoEvm', label: 'Auto EVM' },
              ]}
            />
          </div>
        </div>
      </div>

      {!loading && channels.length > 0 && (
        <ChainSummaryCard {...summary} />
      )}

      {loading ? (
        <div>Loading channel data...</div>
      ) : channels.length === 0 ? (
        <div>No channel data available.</div>
      ) : (
        <ChannelList channels={channels} parseNumber={parseNumber} />
      )}
    </div>
  );
}
