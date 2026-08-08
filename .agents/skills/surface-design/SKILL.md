---
name: surface-design
description: Work safely and coherently in the Axone Surface repository. Use when designing, implementing, reviewing, or evolving Surface UI, protocol-facing copy, identity or wallet flows, Chain Register behaviour, visual styling, motion, or related tests.
---

# Surface Design

## Surface in one sentence

Treat Surface as an institutional, inspectable interface to observable Axone protocol facts. It is not a generic blockchain explorer, SaaS dashboard, or decorative futuristic landing page.

Make the interface useful to people, organisations, and agents: stable references, clear assertions, inspectable evidence, and no invented institutional meaning.

## Start every change this way

1. Inspect `git status`, the affected component/composable/domain code, its tests, and the relevant scripts in `package.json` before editing.
2. Preserve unrelated worktree changes. Do not reformat, rename, or “clean up” adjacent code unless it is necessary to the requested change.
3. Identify the observable protocol fact, the user-visible assertion, the supporting evidence, and any derived interpretation before changing copy or UI.
4. Make the smallest independently reviewable change. Split behavioural changes from broad CSS, motion, routing, or architectural work.
5. Inspect the rendered result for UI work. Passing lint or unit tests does not establish visual or semantic acceptance.

## Preserve these product boundaries

- Show protocol facts as facts. A Chain Register row is a projection of chain data, not a new protocol record.
- Keep an assertion legible first and its evidence inspectable second. Use stable, addressable chain references; do not invent identifiers or folios.
- Mark derived relations as interpretations. Expose their evidence, recognition policy, version, computation time, and limits rather than presenting them as protocol truth.
- Keep implementation mechanics out of the primary reading surface. Reveal addresses, hashes, modules, raw events, and other technical detail progressively.
- Use `ACT` only for `axone-gov / record_decision`; do not use it as a synonym for a transaction, event, or record.
- Use the established register vocabulary and dry, structured microcopy. Do not replace accepted copy with explanatory filler or a generic product voice.

## Treat identity and wallet control separately

- Treat wallet connection as provider, wallet address, network, and connection state only.
- Let an explicit DID or route establish the identity context. Resolve whether the connected wallet controls that DID on demand.
- Apply the 0/1/infinity rule: never discover, enumerate, count, or auto-select all identities controlled by a wallet.
- Keep connection actions direct: show the selected wallet address; make `Disconnect` clear provider and remembered in-memory state and prevent automatic reconnection.
- Do not introduce `SESSION`, `SELF`, an identity picker, `activeIdentity`, or automatic identity discovery into the connection flow.

## Build the interface as a reading surface

- Prefer the calm institutional register aesthetic: dense but readable, post-digital, and inspectable.
- Use institutional typography for assertions and monospace for identifiers, addresses, hashes, timestamps, and other evidence. Do not add typefaces without a semantic role.
- Let layout express institutional roles. Keep the Chain Register’s `ENTRY / STATEMENT / EVIDENCE` distinction; preserve the same hierarchy when columns collapse on small screens.
- Keep primary content in DOM/Vue so it remains selectable and accessible. Reserve Pixi/canvas for atmospheric or procedural rendering, never essential text or controls.
- Use neutral surfaces and semantic colour sparingly. Never depend on colour alone for state, focus, or affordance.
- Make all controls semantic, named, keyboard-operable, and visibly focusable. Preserve a non-motion semantic cue with reduced motion enabled.

## Make motion carry information

- Animate a meaningful transition, observation, inscription, confirmation, or pending state; do not animate an idle surface for decoration.
- Show only one primary moving element in a viewport. Stabilise recorded facts once confirmed.
- Do not present completion until authoritative protocol confirmation. On rejection, expiry, or unavailable confirmation, stop the pending animation and expose that state.
- Preserve the established sequential register behaviour unless the request explicitly changes it: one active inscription at a time, an inline cursor, and a bounded five-fact window.

## Change code deliberately

- Change behaviour before normalising styles. Do not mix wallet/identity semantics, routing, hero motion, component architecture, and CSS migration in one patch.
- Keep Tailwind utility use local and keep bespoke layout, typography, animation, and complex visual work in `src/styles.css` when that gives a clearer, more stable result.
- Update the full data-to-render contract when changing the register window, event taxonomy, or displayed evidence: fetching, retention, rendering, skeletons, dimensions, and tests.
- Preserve accessible complete text when animating text. Do not let glyph-level rendering make a screen reader receive partial or malformed assertions.
- Treat an unsupported runtime or pre-existing failure as an environment finding, not proof that the application change is broken. State it clearly and verify with the supported runtime when available.

## Validate before handoff

Run the repository scripts after every modification, in this order unless the user explicitly narrows validation:

```sh
pnpm format
pnpm run lint
pnpm run check
pnpm run type-check
pnpm run build-only
```

Then inspect the final diff and, for rendered changes, verify the affected flow at desktop and a narrow viewport. Report exactly what passed, what could not run, and any remaining visual or semantic risk.
