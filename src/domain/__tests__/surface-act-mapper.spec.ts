import { describe, expect, it } from 'vitest'

import {
  dedupeSurfaceActs,
  mapTxToSurfaceActs,
  moduleAdministratorsFromInstallations,
  moduleContractAddresses,
  sortSurfaceActs,
} from '../surface-act-mapper'
import { surfaceActKindCategories } from '../surface-act'

describe('surface-act-mapper', () => {
  it('maps on-chain sources to the specified assertions', () => {
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
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'abstract:account' },
            { key: 'action', value: 'instantiate' },
            { key: '_contract_address', value: 'axone1contract' },
            { key: 'msg_index', value: '0' },
          ],
        },
      ],
    }

    const makeExecuteTx = (
      txhash: string,
      attributes: Array<{ key: string; value: string }>,
      message: Record<string, unknown> = {},
    ) => ({
      height: '11',
      txhash,
      timestamp: '2026-07-09 12:01 UTC',
      tx: {
        body: {
          messages: [
            {
              '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
              sender: 'axone1sender',
              ...message,
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

    const administrators = new Map([
      ['axone1govmodule', 'axone1account'],
      ['axone1vcmodule', 'axone1account'],
    ])
    const cases = [
      {
        tx: instantiateTx,
        kind: 'identity.created',
        assertion: 'Identity created for axone1contract.',
      },
      {
        tx: {
          ...makeExecuteTx('TX-GOV-INSTALL', [
            { key: 'contract', value: 'abstract:account' },
            { key: 'action', value: 'install_modules' },
            { key: 'installed_modules', value: '["axone:axone-gov:1.0.0"]' },
            { key: 'msg_index', value: '0' },
            { key: '_contract_address', value: 'axone1account' },
          ]),
          events: [
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'abstract:account' },
                { key: 'action', value: 'install_modules' },
                { key: 'installed_modules', value: '["axone:axone-gov:1.0.0"]' },
                { key: 'msg_index', value: '0' },
                { key: '_contract_address', value: 'axone1account' },
              ],
            },
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'axone:axone-gov' },
                { key: 'action', value: 'instantiate' },
                { key: 'msg_index', value: '0' },
                { key: '_contract_address', value: 'axone1govmodule' },
              ],
            },
          ],
        },
        kind: 'governance.instantiated',
        assertion: 'Governance established on axone1account.',
      },
      {
        tx: makeExecuteTx('TX-VC-INSTALL', [
          { key: 'contract', value: 'abstract:account' },
          { key: 'action', value: 'install_modules' },
          { key: 'installed_modules', value: '["axone:axone-vc:0.1.0"]' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1account' },
        ]),
        kind: 'credential.authority.instantiated',
        assertion: 'Credential authority established on axone1account.',
      },
      {
        tx: makeExecuteTx('TX-REC', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'record_decision' },
          { key: 'decision_id', value: '1' },
          { key: 'verdict', value: 'gov:permitted' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1govmodule' },
        ]),
        kind: 'governance.decision.recorded',
        assertion: 'Decision recorded by axone1account.',
      },
      {
        tx: makeExecuteTx('TX-REV', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'revise_constitution' },
          { key: 'constitution_hash', value: 'hash-2' },
          { key: 'constitution_revision', value: '8' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1govmodule' },
        ]),
        kind: 'governance.constitution.revised',
        assertion: 'Governance amended on axone1account.',
      },
      {
        tx: makeExecuteTx(
          'TX-ISS',
          [
            { key: 'contract', value: 'axone:axone-vc' },
            { key: 'action', value: 'issue_credential' },
            { key: 'identifier', value: 'cred-1' },
            { key: 'credential_type', value: 'membership' },
            { key: 'valid_from', value: '2026-07-09T12:00:00Z' },
            { key: 'valid_until', value: '2026-12-31T23:59:59Z' },
            { key: 'msg_index', value: '0' },
            { key: '_contract_address', value: 'axone1vcmodule' },
          ],
          {
            msg: {
              module: {
                issue_credential: {
                  credential: btoa(
                    '<urn:credential> <https://www.w3.org/2018/credentials#issuer> <did:pkh:cosmos:issuer> .\n<urn:credential> <https://www.w3.org/2018/credentials#credentialSubject> <urn:axone:subject> .',
                  ),
                },
              },
            },
          },
        ),
        kind: 'credential.issued',
        assertion: 'Credential issued by did:pkh:cosmos:issuer to urn:axone:subject.',
      },
      {
        tx: makeExecuteTx('TX-REVK', [
          { key: 'contract', value: 'axone:axone-vc' },
          { key: 'action', value: 'revoke_credential' },
          { key: 'identifier', value: 'cred-1' },
          { key: 'revoked_at', value: '2026-07-09T13:00:00Z' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1vcmodule' },
        ]),
        kind: 'credential.revoked',
        assertion: 'Credential revoked by axone1account.',
      },
    ] as const

    for (const testCase of cases) {
      const acts = mapTxToSurfaceActs(testCase.tx as never, administrators)

      expect(acts).toHaveLength(1)
      expect(acts[0]?.kind).toBe(testCase.kind)
      expect(acts[0]?.assertion).toBe(testCase.assertion)
    }

    const verdict = mapTxToSurfaceActs(cases[3].tx as never, administrators)[0]!
    expect(surfaceActKindCategories[verdict.kind]).toBe('VERDICT')
    expect(verdict.payload.verdict).toBe('gov:permitted')
    expect(verdict.assertion).not.toContain('record_decision')
    expect(verdict.assertion).not.toContain('gov:permitted')
  })

  it('rejects unrelated contract instantiation and module events without an AA owner', () => {
    expect(
      mapTxToSurfaceActs({
        tx: { body: { messages: [{ '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract2' }] } },
        events: [
          {
            type: 'instantiate',
            attributes: [{ key: '_contract_address', value: 'axone1unrelated' }],
          },
        ],
      }),
    ).toEqual([])

    expect(
      mapTxToSurfaceActs({
        tx: {
          body: {
            messages: [{ '@type': '/cosmwasm.wasm.v1.MsgExecuteContract' }],
          },
        },
        events: [
          {
            type: 'wasm-abstract',
            attributes: [
              { key: 'contract', value: 'axone:axone-gov' },
              { key: 'action', value: 'record_decision' },
              { key: '_contract_address', value: 'axone1govmodule' },
              { key: 'msg_index', value: '0' },
            ],
          },
        ],
      }),
    ).toEqual([])
  })

  it('derives module owners from installation transactions before querying contracts', () => {
    const installation = {
      events: [
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'abstract:account' },
            { key: 'action', value: 'install_modules' },
            { key: '_contract_address', value: 'axone1account' },
            { key: 'msg_index', value: '0' },
          ],
        },
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'axone:axone-gov' },
            { key: 'action', value: 'instantiate' },
            { key: '_contract_address', value: 'axone1govmodule' },
            { key: 'msg_index', value: '0' },
          ],
        },
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'axone:axone-vc' },
            { key: 'action', value: 'instantiate' },
            { key: '_contract_address', value: 'axone1vcmodule' },
            { key: 'msg_index', value: '0' },
          ],
        },
      ],
    }

    expect(moduleAdministratorsFromInstallations([installation])).toEqual(
      new Map([
        ['axone1govmodule', 'axone1account'],
        ['axone1vcmodule', 'axone1account'],
      ]),
    )
    expect(moduleContractAddresses([installation])).toEqual([])
    expect(
      moduleContractAddresses([
        {
          events: [
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'axone:axone-gov' },
                { key: 'action', value: 'record_decision' },
                { key: '_contract_address', value: 'axone1govmodule' },
              ],
            },
          ],
        },
      ]),
    ).toEqual(['axone1govmodule'])
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
        assertion: '',
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
        assertion: '',
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
        assertion: '',
        payload: {},
      },
    ])

    const sorted = sortSurfaceActs(deduped)

    expect(sorted.map((act) => act.id)).toEqual(['a', 'b'])
  })
})
