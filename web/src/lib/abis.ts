import { parseAbi } from "viem";

export const identityRegistryAbi = parseAbi([
  "function totalAgents() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function agentExists(uint256 agentId) view returns (bool)",
]);

export const reputationRegistryAbi = parseAbi([
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getClients(uint256 agentId) view returns (address[])",
]);

export const paymentEscrowAbi = parseAbi([
  "function hasPaid(address payer, uint256 agentId) view returns (bool)",
  "event TaskPaid(address indexed payer, uint256 indexed agentId, bytes32 indexed taskId, uint256 amount)",
]);

export const usdcAbi = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]);
