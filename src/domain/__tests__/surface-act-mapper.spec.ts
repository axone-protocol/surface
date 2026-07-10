import { describe, expect, it } from 'vitest'

import { dedupeSurfaceActs, mapTxToSurfaceActs, sortSurfaceActs } from '../surface-act-mapper'

describe('surface-act-mapper', () => {
  it('maps contract and action pairs to canonical event labels', () => {
    const instantiateTx = {
      height: '10',
      txhash: 'TX-INST',
      timestamp: '2026-07-09T12:00:00Z',
      tx: {
        body: {
          messages: [
            {
              '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract2',
              sender: 'axone1sender',
              code_id: '7',
            },
          ],
        },
      },
      events: [
        {
          type: 'instantiate',
          attributes: [
            { key: '_contract_address', value: 'axone1contract' },
            { key: 'msg_index', value: '0' },
          ],
        },
      ],
    }

    const makeExecuteTx = (txhash: string, attributes: Array<{ key: string; value: string }>) => ({
      height: '11',
      txhash,
      timestamp: '2026-07-09 12:01 UTC',
      tx: {
        body: {
          messages: [
            {
              '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
              sender: 'axone1sender',
            },
          ],
        },
      },
      events: [
        {
          type: 'wasm-abstract',
          attributes,
        },
      ],
    })

    const cases = [
      {
        tx: instantiateTx,
        kind: 'identity.created',
        title: 'IDENTITY REGISTERED',
        description: 'registered as an Axone identity',
      },
      {
        tx: makeExecuteTx('TX-CAP', [
          { key: 'contract', value: 'abstract:account' },
          { key: 'action', value: 'install_modules' },
          { key: 'installed_modules', value: 'gov,vc' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1cap' },
        ]),
        kind: 'capability.installed',
        title: 'CAPABILITY INSTALLED',
        description: 'installed the requested modules',
      },
      {
        tx: makeExecuteTx('TX-GOV', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'instantiate' },
          { key: 'constitution_hash', value: 'hash-1' },
          { key: 'constitution_revision', value: '7' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1gov' },
        ]),
        kind: 'governance.instantiated',
        title: 'GOVERNANCE INSTANTIATED',
        description: 'governance capability was instantiated',
      },
      {
        tx: makeExecuteTx('TX-REC', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'record_decision' },
          { key: 'decision_id', value: '1' },
          { key: 'verdict', value: 'gov:permitted' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1gov' },
        ]),
        kind: 'governance.decision.recorded',
        title: 'ACT RECORDED',
        description: 'Verdict: gov:permitted',
      },
      {
        tx: makeExecuteTx('TX-REV', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'revise_constitution' },
          { key: 'constitution_hash', value: 'hash-2' },
          { key: 'constitution_revision', value: '8' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1gov' },
        ]),
        kind: 'governance.constitution.revised',
        title: 'GOVERNANCE REVISED',
        description: 'governance constitution was revised',
      },
      {
        tx: makeExecuteTx('TX-VCI', [
          { key: 'contract', value: 'axone:axone-vc' },
          { key: 'action', value: 'instantiate' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1vc' },
        ]),
        kind: 'credential.authority.instantiated',
        title: 'CREDENTIAL AUTHORITY INSTANTIATED',
        description: 'credential authority was instantiated',
      },
      {
        tx: makeExecuteTx('TX-ISS', [
          { key: 'contract', value: 'axone:axone-vc' },
          { key: 'action', value: 'issue_credential' },
          { key: 'identifier', value: 'cred-1' },
          { key: 'issuer', value: 'axone1issuer' },
          { key: 'subject', value: 'axone1subject' },
          { key: 'credential_type', value: 'membership' },
          { key: 'valid_from', value: '2026-07-09T12:00:00Z' },
          { key: 'valid_until', value: '2026-12-31T23:59:59Z' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1vc' },
        ]),
        kind: 'credential.issued',
        title: 'CREDENTIAL ISSUED',
        description: 'credential was issued by the authority',
      },
      {
        tx: makeExecuteTx('TX-REVK', [
          { key: 'contract', value: 'axone:axone-vc' },
          { key: 'action', value: 'revoke_credential' },
          { key: 'identifier', value: 'cred-1' },
          { key: 'issuer', value: 'axone1issuer' },
          { key: 'revoked_at', value: '2026-07-09T13:00:00Z' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1vc' },
        ]),
        kind: 'credential.revoked',
        title: 'CREDENTIAL REVOKED',
        description: 'credential was revoked by the authority',
      },
    ] as const

    for (const testCase of cases) {
      const acts = mapTxToSurfaceActs(testCase.tx as never)

      expect(acts).toHaveLength(1)
      expect(acts[0]?.kind).toBe(testCase.kind)
      expect(acts[0]?.title).toBe(testCase.title)
      expect(acts[0]?.description).toContain(testCase.description)
    }
  })

  it('dedupes and sorts acts by chain order', () => {
    const deduped = dedupeSurfaceActs([
      {
        id: 'b',
        kind: 'identity.created',
        txhash: 'b',
        msgIndex: 0,
        actIndex: 0,
        height: 3,
        timestamp: '2026-07-09T12:00:00Z',
        title: 'IDENTITY CREATED',
        description: '',
        payload: {},
      },
      {
        id: 'a',
        kind: 'identity.created',
        txhash: 'a',
        msgIndex: 0,
        actIndex: 0,
        height: 5,
        timestamp: '2026-07-09T12:00:00Z',
        title: 'IDENTITY CREATED',
        description: '',
        payload: {},
      },
      {
        id: 'a',
        kind: 'identity.created',
        txhash: 'a',
        msgIndex: 0,
        actIndex: 0,
        height: 5,
        timestamp: '2026-07-09T12:00:00Z',
        title: 'IDENTITY CREATED',
        description: '',
        payload: {},
      },
    ])

    const sorted = sortSurfaceActs(deduped)

    expect(sorted.map((act) => act.id)).toEqual(['a', 'b'])
  })
})
