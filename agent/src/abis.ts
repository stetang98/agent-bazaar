import { parseAbi } from "viem";

export const identityRegistryAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function totalAgents() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function agentExists(uint256 agentId) view returns (bool)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

export const reputationRegistryAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function getClients(uint256 agentId) view returns (address[])",
  "event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
]);

export const paymentEscrowAbi = parseAbi([
  "function settle(bytes32 taskId, uint256 agentId, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function hasPaid(address payer, uint256 agentId) view returns (bool)",
  "function owed(address agentWallet) view returns (uint256)",
  "function withdraw()",
  "event TaskPaid(address indexed payer, uint256 indexed agentId, bytes32 indexed taskId, uint256 amount)",
]);

// USDC (Circle FiatTokenV2_2) — EIP-3009 + EIP-712 domain reads.
export const usdcAbi = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);
