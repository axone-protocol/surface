import { type CosmosTxListResponse, type CosmosTxResponse } from './axone-event-extractor'

const AXONE_API_BASE = 'https://api.axone.aknodes.net'
const DEFAULT_LIMIT = 3

export type FetchedTxBatch = {
  txResponses: CosmosTxResponse[]
  total: number
}

async function fetchTxsByAction(
  action: string,
  signal?: AbortSignal,
  limit = DEFAULT_LIMIT,
): Promise<FetchedTxBatch> {
  const url = new URL('/cosmos/tx/v1beta1/txs', AXONE_API_BASE)
  url.searchParams.set('query', `message.action='${action}'`)
  url.searchParams.set('page', '1')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('order_by', 'ORDER_BY_DESC')

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Axone API request failed (${response.status})`)
  }

  const data = (await response.json()) as CosmosTxListResponse
  return {
    txResponses: data.tx_responses ?? [],
    total: Number.parseInt(data.total ?? '0', 10) || 0,
  }
}

export function fetchInstantiateContract2Txs(signal?: AbortSignal, limit = DEFAULT_LIMIT) {
  return fetchTxsByAction('/cosmwasm.wasm.v1.MsgInstantiateContract2', signal, limit)
}

export function fetchExecuteContractTxs(signal?: AbortSignal, limit = DEFAULT_LIMIT) {
  return fetchTxsByAction('/cosmwasm.wasm.v1.MsgExecuteContract', signal, limit)
}

export function mergeTxResponses(...groups: CosmosTxResponse[][]) {
  return groups.flat()
}
