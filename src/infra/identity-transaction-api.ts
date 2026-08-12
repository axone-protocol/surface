export type IdentityTransactionResult =
  | { status: 'pending' }
  | {
      status: 'succeeded'
      height?: string
      timestamp?: string
    }
  | {
      status: 'failed'
      height?: string
      timestamp?: string
      error: string
    }

type CosmosTransactionResponse = {
  tx_response?: {
    code?: number | string
    raw_log?: string
    height?: string
    timestamp?: string
  }
}

export async function fetchIdentityTransactionResult(
  api: string,
  transactionHash: string,
  signal?: AbortSignal,
): Promise<IdentityTransactionResult> {
  const response = await fetch(
    `${api}/cosmos/tx/v1beta1/txs/${encodeURIComponent(transactionHash)}`,
    { signal, headers: { accept: 'application/json' } },
  )

  if (response.status === 404) {
    return { status: 'pending' }
  }
  if (!response.ok) {
    throw new Error(`Transaction observation failed (${response.status}).`)
  }

  const transaction = ((await response.json()) as CosmosTransactionResponse).tx_response
  if (!transaction || transaction.code === undefined) {
    throw new Error('The selected network returned an unsupported transaction result.')
  }

  const code = Number(transaction.code)
  if (!Number.isFinite(code)) {
    throw new Error('The selected network returned an invalid transaction code.')
  }

  if (code === 0) {
    return {
      status: 'succeeded',
      height: transaction.height,
      timestamp: transaction.timestamp,
    }
  }

  return {
    status: 'failed',
    height: transaction.height,
    timestamp: transaction.timestamp,
    error: transaction.raw_log?.trim() || `Transaction failed with code ${code}.`,
  }
}
