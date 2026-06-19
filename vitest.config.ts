import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Headroom for the opt-in live RPC checks (config/networks.onchain.test.ts).
    // Harmless for the hermetic suite, which is near-instant.
    testTimeout: 30_000,
  },
});
