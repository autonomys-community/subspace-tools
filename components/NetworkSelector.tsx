import React from 'react';
import SegmentedControl from './SegmentedControl';
import { NETWORKS, NetworkType } from '../config/networks';

interface NetworkSelectorProps {
  selectedNetwork: NetworkType;
  onChange: (network: NetworkType) => void;
  disabled?: boolean;
}

const NetworkSelector: React.FC<NetworkSelectorProps> = ({ selectedNetwork, onChange, disabled = false }) => {
  return (
    <div className="mb-4">
      <label className="form-label fw-bold">Select Network:</label>
      <SegmentedControl
        name="networkToggle"
        ariaLabel="Select network"
        value={selectedNetwork}
        disabled={disabled}
        onChange={onChange}
        options={(Object.keys(NETWORKS) as NetworkType[]).map((key) => ({
          value: key,
          label: NETWORKS[key].name,
        }))}
      />
    </div>
  );
};

export default NetworkSelector;
