import { ensureRegistered } from "../registry";

// Registers the agent on-chain (idempotent if AGENT_ID is set) and prints its id.
ensureRegistered()
  .then((identity) => {
    console.log(`agentId=${identity.agentId.toString()} wallet=${identity.agentWallet}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
