export type RegistryEvent = {
  height: number;
  messageIndex: number;
  author: string;
  timestamp?: string;
  tx: string;
  subject: string;
  event: string;
};

export function eventId(entry: RegistryEvent) {
  return `${entry.height}:${entry.messageIndex}`;
}

export const registryEvents: RegistryEvent[] = [
  {
    height: 1844902,
    messageIndex: 0,
    author: "axone1chris9v0n6r7t2u8",
    timestamp: "2026-06-20 08:31 UTC",
    tx: "0F9D...5A2C",
    subject: "Registry authority",
    event: "Authority account created and ready to anchor attestations.",
  },
  {
    height: 1847114,
    messageIndex: 0,
    author: "axone1medgov4k9t0v7",
    timestamp: "2026-06-22 11:08 UTC",
    tx: "91BB...044A",
    subject: "Medical authority account",
    event: "Authority account registered for the medical domain.",
  },
  {
    height: 1848840,
    messageIndex: 0,
    author: "axone1registry8r6f",
    timestamp: "2026-06-25 10:12 UTC",
    tx: "E7A2...91F0",
    subject: "Medical profile credential",
    event: "ProfileCredential issued to the authority account.",
  },
  {
    height: 1849022,
    messageIndex: 0,
    author: "axone1chris9v0n6r7t2u8",
    timestamp: "2026-06-24 09:14 UTC",
    tx: "A12C...8F11",
    subject: "Chris / Abstract Account",
    event: "Abstract account created and anchored on-chain.",
  },
  {
    height: 1849201,
    messageIndex: 0,
    author: "axone1medgov4k9t0v7",
    timestamp: "2026-06-25 16:42 UTC",
    tx: "4C1A...52E8",
    subject: "Medical Data Consortium governance",
    event: "Revision 07 amended the access conditions for clinical contact data.",
  },
  {
    height: 1849286,
    messageIndex: 0,
    author: "axone1clinic5t3",
    timestamp: "2026-06-26 07:55 UTC",
    tx: "4D88...9C21",
    subject: "Consent credential",
    event: "ConsentCredential attached to the patient case.",
  },
  {
    height: 1849302,
    messageIndex: 0,
    author: "axone1chris9v0n6r7t2u8",
    timestamp: "2026-06-26 08:04 UTC",
    tx: "6B0C...C441",
    subject: "Verdict #84",
    event: "Case rendered permitted under revision 07.",
  },
];
