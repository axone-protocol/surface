# Motion

Motion communicates protocol state.

Animation is part of the information model.

It is never decorative.

## Principles

Motion must explain change.

Motion must never distract from stable information.

Motion must end when the represented state becomes durable.

## Motion represents procedures

Motion should express institutional procedures rather than visual effects.

An interface MAY show a pending animation after submission, but it MUST mark an institutional act completed or stable only after authoritative protocol confirmation.
On rejection, expiration, or unavailable confirmation, stop the pending animation and expose the corresponding semantic state; do not show a completion transition.

## Protocol activity

Motion represents protocol activity.

Examples include:

- observation;
- inscription;
- transition;
- confirmation;
- stabilization.

Do not animate idle interfaces without semantic purpose.

## Duration

Prefer deliberate motion over fast motion.

Institutional events are recorded.

They are not broadcast.

## Continuity

Movement should preserve spatial continuity.

New information should integrate into the existing interface rather than interrupt it.

## Stability

Recorded institutional facts become visually stable.

Avoid perpetual animation.

Persistent motion suggests uncertainty.

## Attention

Motion directs attention.

Only one primary motion should exist within a viewport at any given time.

Competing animations reduce meaning.

## Interaction

Motion should acknowledge user actions.

Avoid animations that delay interaction.

## Reduced motion

Respect user accessibility preferences.

When `prefers-reduced-motion` is enabled:

- preserve meaning and the same non-motion semantic cue;
- replace all nonessential transitions with an immediate state change.
