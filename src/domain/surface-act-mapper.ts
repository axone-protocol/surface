import {
  eventAttribute,
  eventAttributes,
  extractInstantiateEvents,
  extractWasmAbstractEvents,
  messageType,
  type CosmosMessage,
  type CosmosTxResponse,
} from "../infra/axone-event-extractor";
import {
  surfaceActKindDescriptions,
  surfaceActKindLabels,
  type SurfaceAct,
  type SurfaceActKind,
} from "./surface-act";

const instantiateAction = "/cosmwasm.wasm.v1.MsgInstantiateContract2";
const executeAction = "/cosmwasm.wasm.v1.MsgExecuteContract";

function toNumber(value: string | undefined, fallback = 0) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function txHeight(tx: CosmosTxResponse) {
  return toNumber(tx.height);
}

function txHash(tx: CosmosTxResponse) {
  return tx.txhash ?? "";
}

function txTimestamp(tx: CosmosTxResponse) {
  return tx.timestamp ?? "";
}

function txMessages(tx: CosmosTxResponse) {
  return tx.tx?.body?.messages ?? [];
}

function messageIndexForEvent(eventIndex: number, tx: CosmosTxResponse) {
  const event = extractWasmAbstractEvents(tx)[eventIndex];
  const msgIndex = Number.parseInt(eventAttribute(event, "msg_index"), 10);
  return Number.isFinite(msgIndex) ? msgIndex : -1;
}

function instantiateEventForMessage(tx: CosmosTxResponse, messageIndex: number) {
  const instantiateEvents = extractInstantiateEvents(tx);
  return (
    instantiateEvents.find((event, eventIndex) => {
      const msgIndex = Number.parseInt(eventAttribute(event, "msg_index"), 10);
      return Number.isFinite(msgIndex) ? msgIndex === messageIndex : eventIndex === messageIndex;
    }) ?? instantiateEvents[messageIndex]
  );
}

function stringPayload(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? ""])) as Record<
    string,
    string
  >;
}

function truncateIdentityAddress(address: string) {
  if (address.length <= 24) {
    return address;
  }

  return `${address.slice(0, 12)}...${address.slice(-6)}`;
}

function makeActBase(tx: CosmosTxResponse, messageIndex: number, actIndex: number, kind: SurfaceActKind) {
  const txhash = txHash(tx);
  return {
    id: `${txhash}:${messageIndex}:${actIndex}`,
    kind,
    txhash,
    msgIndex: messageIndex,
    actIndex,
    height: txHeight(tx),
    timestamp: txTimestamp(tx),
    title: surfaceActKindLabels[kind],
    description: surfaceActKindDescriptions[kind],
    payload: {},
  } satisfies SurfaceAct;
}

function fromInstantiate(tx: CosmosTxResponse, message: CosmosMessage, messageIndex: number): SurfaceAct[] {
  const instantiateEvent = instantiateEventForMessage(tx, messageIndex);
  const contractAddress =
    eventAttribute(instantiateEvent, "_contract_address") ||
    eventAttribute(extractWasmAbstractEvents(tx)[messageIndex], "_contract_address") ||
    String(message["contract_address"] ?? "");

  if (messageType(message) !== instantiateAction || !contractAddress) {
    return [];
  }

  return [
    {
      ...makeActBase(tx, messageIndex, 0, "identity.created"),
      signer: String(message.sender ?? ""),
      contractAddress,
      action: "instantiate",
      description: `Abstract account ${truncateIdentityAddress(contractAddress)} was registered as an Axone identity.`,
      payload: stringPayload({
        _contract_address: contractAddress,
        code_id: String(message.code_id ?? message["codeId"] ?? ""),
        msg_index: String(messageIndex),
      }),
    },
  ];
}

function mapWasmAbstractEvent(
  tx: CosmosTxResponse,
  messageIndex: number,
  actIndex: number,
  eventIndex: number,
): SurfaceAct | null {
  const event = extractWasmAbstractEvents(tx)[eventIndex];
  if (!event) {
    return null;
  }

  const contract = eventAttribute(event, "contract");
  const action = eventAttribute(event, "action");
  const contractAddress = eventAttribute(event, "_contract_address");
  const attributes = eventAttributes(event);
  const base = makeActBase(tx, messageIndex, actIndex, "identity.created");
  const signer = eventAttribute(event, "signer") || eventAttribute(event, "sender");

  if (contract === "abstract:account" && action === "install_modules") {
    return {
      ...base,
      kind: "capability.installed" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["capability.installed"],
      description: attributes.installed_modules
        ? `${surfaceActKindDescriptions["capability.installed"]} ${attributes.installed_modules}.`
        : surfaceActKindDescriptions["capability.installed"],
      payload: stringPayload({
        installed_modules: attributes.installed_modules ?? "",
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  if (contract === "axone:axone-gov" && action === "instantiate") {
    return {
      ...base,
      kind: "governance.instantiated" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["governance.instantiated"],
      description: surfaceActKindDescriptions["governance.instantiated"],
      payload: stringPayload({
        constitution_hash: attributes.constitution_hash ?? "",
        constitution_revision: attributes.constitution_revision ?? "",
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  if (contract === "axone:axone-gov" && action === "record_decision") {
    const verdict = attributes.verdict ?? "";
    return {
      ...base,
      kind: "governance.decision.recorded" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["governance.decision.recorded"],
      description: verdict
        ? `${surfaceActKindDescriptions["governance.decision.recorded"]} Verdict: ${verdict}.`
        : surfaceActKindDescriptions["governance.decision.recorded"],
      payload: stringPayload({
        decision_id: attributes.decision_id ?? "",
        constitution_revision: attributes.constitution_revision ?? "",
        constitution_hash: attributes.constitution_hash ?? "",
        case_hash: attributes.case_hash ?? "",
        verdict,
        verdict_hash: attributes.verdict_hash ?? "",
        motivation_hash: attributes.motivation_hash ?? "",
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  if (contract === "axone:axone-gov" && action === "revise_constitution") {
    return {
      ...base,
      kind: "governance.constitution.revised" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["governance.constitution.revised"],
      description: surfaceActKindDescriptions["governance.constitution.revised"],
      payload: stringPayload({
        constitution_revision: attributes.constitution_revision ?? "",
        constitution_hash: attributes.constitution_hash ?? "",
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  if (contract === "axone:axone-vc" && action === "instantiate") {
    return {
      ...base,
      kind: "credential.authority.instantiated" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["credential.authority.instantiated"],
      description: surfaceActKindDescriptions["credential.authority.instantiated"],
      payload: stringPayload({
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  if (contract === "axone:axone-vc" && action === "issue_credential") {
    return {
      ...base,
      kind: "credential.issued" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["credential.issued"],
      description: surfaceActKindDescriptions["credential.issued"],
      payload: stringPayload({
        identifier: attributes.identifier ?? "",
        issuer: attributes.issuer ?? "",
        subject: attributes.subject ?? "",
        credential_type: attributes.credential_type ?? "",
        valid_from: attributes.valid_from ?? "",
        valid_until: attributes.valid_until ?? "",
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  if (contract === "axone:axone-vc" && action === "revoke_credential") {
    return {
      ...base,
      kind: "credential.revoked" as const,
      signer,
      contract,
      contractAddress,
      action,
      title: surfaceActKindLabels["credential.revoked"],
      description: surfaceActKindDescriptions["credential.revoked"],
      payload: stringPayload({
        identifier: attributes.identifier ?? "",
        issuer: attributes.issuer ?? "",
        revoked_at: attributes.revoked_at ?? "",
        _contract_address: contractAddress,
        msg_index: String(messageIndex),
      }),
    };
  }

  return null;
}

export function mapTxToSurfaceActs(tx: CosmosTxResponse) {
  const acts: SurfaceAct[] = [];
  const abstractEvents = extractWasmAbstractEvents(tx);

  txMessages(tx).forEach((message, messageIndex) => {
    const type = messageType(message);

    if (type === instantiateAction) {
      acts.push(...fromInstantiate(tx, message, messageIndex));
      return;
    }

    if (type !== executeAction) {
      return;
    }

    let actIndex = 0;
    abstractEvents.forEach((_, eventIndex) => {
      const msgIndex = messageIndexForEvent(eventIndex, tx);
      if (msgIndex !== messageIndex) {
        return;
      }

      const act = mapWasmAbstractEvent(tx, messageIndex, actIndex, eventIndex);
      if (act) {
        acts.push(act);
        actIndex += 1;
      }
    });
  });

  return acts;
}

export function sortSurfaceActs(acts: SurfaceAct[]) {
  return [...acts].sort(
    (left, right) =>
      right.height - left.height ||
      right.timestamp.localeCompare(left.timestamp) ||
      left.msgIndex - right.msgIndex ||
      left.actIndex - right.actIndex,
  );
}

export function dedupeSurfaceActs(acts: SurfaceAct[]) {
  const deduped = new Map<string, SurfaceAct>();

  for (const act of acts) {
    deduped.set(act.id, act);
  }

  return [...deduped.values()];
}
