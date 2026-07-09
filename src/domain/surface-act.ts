export type SurfaceActKind =
  | "identity.created"
  | "capability.installed"
  | "governance.instantiated"
  | "governance.decision.recorded"
  | "governance.constitution.revised"
  | "credential.authority.instantiated"
  | "credential.issued"
  | "credential.revoked";

export type SurfaceAct = {
  id: string;
  kind: SurfaceActKind;
  txhash: string;
  msgIndex: number;
  actIndex: number;
  height: number;
  timestamp: string;
  signer?: string;
  contract?: string;
  contractAddress?: string;
  action?: string;
  title: string;
  description: string;
  payload: Record<string, string>;
};

export const surfaceActKindLabels: Record<SurfaceActKind, string> = {
  "identity.created": "IDENTITY REGISTERED",
  "capability.installed": "CAPABILITY INSTALLED",
  "governance.instantiated": "GOVERNANCE INSTANTIATED",
  "governance.decision.recorded": "ACT RECORDED",
  "governance.constitution.revised": "GOVERNANCE REVISED",
  "credential.authority.instantiated": "CREDENTIAL AUTHORITY INSTANTIATED",
  "credential.issued": "CREDENTIAL ISSUED",
  "credential.revoked": "CREDENTIAL REVOKED",
};

export const surfaceActKindCategories: Record<SurfaceActKind, string> = {
  "identity.created": "IDENTITY",
  "capability.installed": "CAPABILITY",
  "governance.instantiated": "GOVERNANCE",
  "governance.decision.recorded": "ACT",
  "governance.constitution.revised": "GOVERNANCE",
  "credential.authority.instantiated": "CREDENTIAL",
  "credential.issued": "CREDENTIAL",
  "credential.revoked": "CREDENTIAL",
};

export const surfaceActKindDescriptions: Record<SurfaceActKind, string> = {
  "identity.created": "Abstract account was registered as an Axone identity.",
  "capability.installed": "An Abstract account installed the requested modules.",
  "governance.instantiated": "A governance capability was instantiated for the identity.",
  "governance.decision.recorded": "A governance act was recorded for the case.",
  "governance.constitution.revised": "The governance constitution was revised.",
  "credential.authority.instantiated": "A credential authority was instantiated and can issue or revoke credentials.",
  "credential.issued": "A credential was issued by the authority.",
  "credential.revoked": "A credential was revoked by the authority.",
};
