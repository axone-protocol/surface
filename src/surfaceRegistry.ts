export type ProtocolFactKind = "IDENTITY" | "GOVERNANCE" | "CREDENTIAL" | "VERDICT";
export type InterpretationKind = "ZONE" | "RESOURCE" | "ORGANISATION" | "CONTEXTUAL_RECOGNITION" | "POLICY";
export type RegistryLevel = "constitutive" | "declarative" | "jurisdictional" | "effective";
export type RegistryItemKind = ProtocolFactKind | InterpretationKind;
export type RegistryNature = "protocol fact" | "interpreted object";
export type RelationKind = "native" | "interpreted";

export type RegistryRelation = {
  label: string;
  targetId: string;
  kind: RelationKind;
  basis?: string;
  policy?: string;
  context?: string;
  limit?: string;
};

export type RegistryItem = {
  id: string;
  kind: RegistryItemKind;
  nature: RegistryNature;
  level: RegistryLevel;
  title: string;
  status: string;
  summary: string;
  details: Array<{
    label: string;
    value: string;
    code?: boolean;
  }>;
  relations: RegistryRelation[];
  searchTerms: string[];
  timestamp: string;
  block: string;
};

export const registryItems: RegistryItem[] = [
  {
    id: "identity-chris-aa",
    kind: "IDENTITY",
    nature: "protocol fact",
    level: "constitutive",
    title: "Chris / Abstract Account",
    status: "IDENTITY / CREATED",
    summary: "Abstract Account created and available as an authority anchor.",
    details: [
      { label: "account", value: "did:pkh:cosmos:axone-1:axone1chris9v0n6r7t2u8", code: true },
      { label: "transaction", value: "E7A2...91F0", code: true },
      { label: "message sender", value: "axone1chris9v0n6r7t2u8", code: true },
    ],
    relations: [],
    searchTerms: ["identity", "abstract account", "chris", "did:pkh:cosmos:axone-1:axone1chris9v0n6r7t2u8"],
    timestamp: "2026-06-24 09:14 UTC",
    block: "1849022",
  },
  {
    id: "governance-medical-rev07",
    kind: "GOVERNANCE",
    nature: "protocol fact",
    level: "constitutive",
    title: "Medical Data Consortium governance",
    status: "GOVERNANCE / AMENDED",
    summary: "Revision 07 records access conditions for clinical contact data.",
    details: [
      { label: "authority", value: "did:pkh:cosmos:axone-1:axone1medgov4k9t0v7", code: true },
      { label: "revision", value: "07", code: true },
      { label: "capability", value: "data-steward", code: true },
    ],
    relations: [
      {
        label: "authority account",
        targetId: "identity-medical-aa",
        kind: "native",
      },
    ],
    searchTerms: ["governance", "governance revision 07", "medical", "data-steward", "authority"],
    timestamp: "2026-06-25 16:42 UTC",
    block: "1849201",
  },
  {
    id: "identity-medical-aa",
    kind: "IDENTITY",
    nature: "protocol fact",
    level: "constitutive",
    title: "Medical authority account",
    status: "IDENTITY / CREATED",
    summary: "Authority account referenced by the Medical Data Consortium governance.",
    details: [
      { label: "account", value: "did:pkh:cosmos:axone-1:axone1medgov4k9t0v7", code: true },
      { label: "transaction", value: "91BB...044A", code: true },
    ],
    relations: [
      {
        label: "published governance",
        targetId: "governance-medical-rev07",
        kind: "native",
      },
    ],
    searchTerms: ["identity", "medical authority", "did:pkh:cosmos:axone-1:axone1medgov4k9t0v7"],
    timestamp: "2026-06-22 11:08 UTC",
    block: "1847114",
  },
  {
    id: "credential-profile-medical",
    kind: "CREDENTIAL",
    nature: "protocol fact",
    level: "declarative",
    title: "Medical profile credential",
    status: "CREDENTIAL / ISSUED",
    summary: "ProfileCredential issued for the authority account.",
    details: [
      { label: "issuer", value: "did:pkh:cosmos:axone-1:axone1registry8r6f", code: true },
      { label: "subject", value: "did:pkh:cosmos:axone-1:axone1medgov4k9t0v7", code: true },
      { label: "type", value: "ProfileCredential", code: true },
    ],
    relations: [
      {
        label: "issuer",
        targetId: "identity-registry-aa",
        kind: "native",
      },
      {
        label: "subject",
        targetId: "identity-medical-aa",
        kind: "native",
      },
    ],
    searchTerms: ["credential", "profilecredential", "medical data consortium", "profile"],
    timestamp: "2026-06-25 10:12 UTC",
    block: "1848840",
  },
  {
    id: "identity-registry-aa",
    kind: "IDENTITY",
    nature: "protocol fact",
    level: "constitutive",
    title: "Registry authority",
    status: "IDENTITY / CREATED",
    summary: "Account that issued the recognised profile credential.",
    details: [
      { label: "account", value: "did:pkh:cosmos:axone-1:axone1registry8r6f", code: true },
      { label: "transaction", value: "0F9D...5A2C", code: true },
    ],
    relations: [],
    searchTerms: ["identity", "registry authority", "issuer", "did:pkh:cosmos:axone-1:axone1registry8r6f"],
    timestamp: "2026-06-20 08:31 UTC",
    block: "1844902",
  },
  {
    id: "credential-consent",
    kind: "CREDENTIAL",
    nature: "protocol fact",
    level: "declarative",
    title: "Consent credential",
    status: "CREDENTIAL / ISSUED",
    summary: "ConsentCredential attached to the evaluated case.",
    details: [
      { label: "issuer", value: "did:pkh:cosmos:axone-1:axone1clinic5t3", code: true },
      { label: "subject", value: "did:pkh:cosmos:axone-1:axone1patient8d2", code: true },
      { label: "type", value: "ConsentCredential", code: true },
    ],
    relations: [
      {
        label: "accepted in verdict",
        targetId: "verdict-contact-data-84",
        kind: "interpreted",
        basis: "Credential reference appears in the evaluation evidence set.",
        policy: "surface-recognition v1",
        context: "governance revision 07, block 1849302",
        limit: "Acceptance is observed in this evaluation context only.",
      },
    ],
    searchTerms: ["credential", "consentcredential", "evidence", "verdict 84"],
    timestamp: "2026-06-26 07:55 UTC",
    block: "1849286",
  },
  {
    id: "verdict-contact-data-84",
    kind: "VERDICT",
    nature: "protocol fact",
    level: "jurisdictional",
    title: "Verdict #84",
    status: "VERDICT / RENDERED",
    summary: "Case evaluated under governance revision 07. Outcome: permitted.",
    details: [
      { label: "case", value: "store_contact_data(patient: redacted, purpose: continuity_of_care)", code: true },
      { label: "governance", value: "revision 07", code: true },
      { label: "outcome", value: "permitted", code: true },
      { label: "motivation", value: "Consent and steward capability satisfied the declared conditions." },
    ],
    relations: [
      {
        label: "governance revision",
        targetId: "governance-medical-rev07",
        kind: "native",
      },
      {
        label: "submitter",
        targetId: "identity-chris-aa",
        kind: "native",
      },
      {
        label: "evidence",
        targetId: "credential-consent",
        kind: "native",
      },
      {
        label: "recognised actor",
        targetId: "recognition-chris-steward",
        kind: "interpreted",
        basis: "Credential and verdict jointly establish a contextual capability.",
        policy: "surface-recognition v1",
        context: "case evaluated under governance revision 07",
        limit: "Recognition is not global and does not outlive the stated context.",
      },
    ],
    searchTerms: ["verdict", "verdict #84", "permitted", "case evaluated", "governance revision 07", "contact data"],
    timestamp: "2026-06-26 08:04 UTC",
    block: "1849302",
  },
  {
    id: "zone-medical-consortium",
    kind: "ZONE",
    nature: "interpreted object",
    level: "constitutive",
    title: "Medical Data Consortium",
    status: "INTERPRETATION / ZONE",
    summary: "Account currently satisfies the Zone interpretation policy.",
    details: [
      { label: "interpreted as", value: "zone", code: true },
      { label: "policy", value: "surface-recognition v1", code: true },
      { label: "computed at block", value: "1849201", code: true },
      { label: "basis", value: "governance capability + recognised profile credential + declared schema" },
    ],
    relations: [
      {
        label: "recognition policy",
        targetId: "policy-surface-recognition-v1",
        kind: "interpreted",
        basis: "Surface applies its public recognition policy to chain facts.",
        policy: "surface-recognition v1",
        context: "computed at block 1849201",
        limit: "Zone is an interpretation, not a native protocol object.",
      },
      {
        label: "source governance",
        targetId: "governance-medical-rev07",
        kind: "interpreted",
        basis: "Governance capability is one source fact for the Zone interpretation.",
        policy: "surface-recognition v1",
        context: "computed at block 1849201",
        limit: "Changing the policy can change the interpretation.",
      },
      {
        label: "source credential",
        targetId: "credential-profile-medical",
        kind: "interpreted",
        basis: "ProfileCredential contributes the declared institutional profile.",
        policy: "surface-recognition v1",
        context: "computed at block 1849201",
        limit: "Interpretation is bounded by the declared policy and block.",
      },
    ],
    searchTerms: ["zone", "medical data consortium", "surface recognition", "zone interpretation"],
    timestamp: "2026-06-26 08:11 UTC",
    block: "1849201",
  },
  {
    id: "recognition-chris-steward",
    kind: "CONTEXTUAL_RECOGNITION",
    nature: "interpreted object",
    level: "effective",
    title: "Chris as steward in case #84",
    status: "INTERPRETATION / RECOGNIZED",
    summary: "Surface recognises the submitter as steward within the case context.",
    details: [
      { label: "interpreted as", value: "organisation", code: true },
      { label: "policy", value: "surface-recognition v1", code: true },
      { label: "computed at block", value: "1849302", code: true },
      { label: "basis", value: "verdict outcome + capability + submitter role" },
    ],
    relations: [
      {
        label: "evidence",
        targetId: "verdict-contact-data-84",
        kind: "interpreted",
        basis: "Verdict #84 anchors the contextual recognition.",
        policy: "surface-recognition v1",
        context: "computed at block 1849302",
        limit: "Recognition exists only for the validated case and policy.",
      },
      {
        label: "role",
        targetId: "identity-chris-aa",
        kind: "interpreted",
        basis: "The submitter identity is the source fact behind the recognition.",
        policy: "surface-recognition v1",
        context: "computed at block 1849302",
        limit: "The interpretation does not claim a global or permanent status.",
      },
    ],
    searchTerms: ["recognition", "steward", "case #84", "organisation"],
    timestamp: "2026-06-26 08:12 UTC",
    block: "1849302",
  },
  {
    id: "policy-surface-recognition-v1",
    kind: "POLICY",
    nature: "interpreted object",
    level: "constitutive",
    title: "Surface recognition v1",
    status: "INTERPRETATION / POLICY",
    summary: "Policy that binds the surface's interpretive layer.",
    details: [
      { label: "interpreted as", value: "policy", code: true },
      { label: "basis", value: "public chain facts + declared context" },
      { label: "computed at block", value: "1849201", code: true },
    ],
    relations: [
      {
        label: "applied to zone interpretation",
        targetId: "zone-medical-consortium",
        kind: "interpreted",
        basis: "Policy is the rule used to produce the surface interpretation.",
        policy: "surface-recognition v1",
        context: "computed at block 1849201",
        limit: "Policy can be updated without mutating chain facts.",
      },
    ],
    searchTerms: ["policy", "surface recognition v1"],
    timestamp: "2026-06-26 08:15 UTC",
    block: "1849303",
  },
];

export function isProtocolFact(item: RegistryItem) {
  return item.nature === "protocol fact";
}
