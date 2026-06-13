import { http, createConfig } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(import.meta.env.VITE_RPC_URL),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
