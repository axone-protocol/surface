# Visual Language

Surface communicates institutional structure through visual language.

Visual decisions must express meaning before aesthetics.

## Hierarchy

Visual hierarchy follows institutional hierarchy.

Higher-level institutional concepts receive greater visual emphasis.

Technical information remains secondary.

## Reading order

Interfaces should naturally guide the reader through:

1. identification;
2. qualification;
3. verification;
4. inspection.

## Typography

Typography distinguishes roles, not styles.

Different typefaces may coexist when they express different institutional functions.

Typography must never be used as decoration.

## Layout

Layout communicates relationships.

Position is semantic.

Spacing establishes structure.

Alignment establishes continuity.

## Color

Color communicates state.

Never use color for branding alone.

Every color must carry semantic meaning.
Every semantic state—including active, warning, error, unavailable, focus, recorded, and revoked—MUST also have a concurrent non-color cue: visible text, an icon or shape with an accessible name, or both.

## Motion

Motion communicates protocol state.

Animation represents transitions.

Stable institutional facts remain visually stable.
An interface MAY show a pending animation after submission, but it MUST mark an institutional act completed or stable only after authoritative protocol confirmation. On rejection, expiration, or unavailable confirmation, stop the pending animation and expose the corresponding semantic state; do not show a completion transition. With `prefers-reduced-motion`, replace all nonessential transitions with an immediate state change while retaining the non-motion state cue.

## Density

Interfaces should present only the information required for the current level of understanding.

Technical density belongs to inspection views.

## Consistency

The same institutional concept must always be represented in the same visual way.

Equivalent concepts should never receive different visual treatments.

Different concepts should never appear visually equivalent.

## Simplicity

Prefer fewer visual elements.

Each element must justify its existence through the information it communicates.
