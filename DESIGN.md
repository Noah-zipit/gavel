# GAVEL — Design Document

The visual law for the Disagreement Engine's AI Courtroom. Read this before writing
any UI code. When a rule here conflicts with a generic instinct, this file wins.

## Visual reference

`~/workspace/graph-hacks/media-generation-disagreement-engine-courtroom-0-605facc4-b543-41f6-bae7-30d7d504e7f5.webp`

Dark charcoal courtroom. Two advocates in opposition: amber Advocate A vs teal
Advocate B. A tug-of-war meter sits between the two candidate cards. A live
transcript with evidence chips streams beneath. An evidence board node-graph maps
taste preferences. A gold THE VERDICT banner closes the session. The mood is a
late-night courtroom: solemn, dramatic, legible at phone distance.

## Design tokens (exact)

Linear-derived near-black product system: near-black canvas, a 4-step surface
ladder, hairline borders, scarce accent, no gradients. Advocate opposition
(amber vs teal) is kept from the approved mockup, retinted for near-black.

| Token        | Value     | Use                                        |
|--------------|-----------|--------------------------------------------|
| bg           | `#08080c` | Page background — near-black canvas        |
| panel        | `#0e0e13` | Cards, transcript blocks, board panels (surface-1) |
| surface2     | `#131318` | Lifted cards, featured panels (surface-2)  |
| surface3     | `#1a1a21` | Deepest lifted surface (surface-3)         |
| border       | `#23252d` | Hairlines, dividers, card outlines        |
| border-strong| `#34343a` | Stronger hairlines, input focus borders    |
| amber        | `#dda02f` | Advocate A, accent for A's evidence       |
| teal         | `#34b3a5` | Advocate B, accent for B's evidence        |
| gold         | `#e0b83c` | THE VERDICT banner only — reserved for finality |
| text         | `#f4f4f5` | Primary text                               |
| muted        | `#a8adb8` | Secondary text, labels, timestamps         |
| subtle       | `#6e7480` | Tertiary text, deselected states, footnotes |
| live-red     | `#e5484d` | LIVE indicator only — reserved for "on air" state |

Tokens live in `app/globals.css` as Tailwind v4 `@theme` entries
(`--color-court-*`) and CSS vars. Never hardcode hex outside the token file.
4th-candidate board tone is clay `#e07a5f` (kept, works on near-black).

## Hard rules

- **Solid colors only. NO gradients.** No purple/dark radial gradients, no harsh or
  rainbow gradients, no radial orbs, no liquid glass. If a headline needs emphasis,
  use solid brand type at a larger size — never gradient-filled text.
- **Typography:** system-ui font stack only
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
  No Inter, no Geist, no Space Grotesk. Base 16px, line-height ~1.5.
- **No em dashes in copy.** No "it's not X, it's Y" phrasing. No "Supercharge your
  workflow"-style hero claims. Read copy aloud; if it sounds AI-written, rewrite it.
- **No three-card feature rows, no "01/02/03" section headers, no pill-shaped
  buttons, no colored left stripes, no checkmark bullets, no terminal-window
  decorations, no Lucide-in-rounded-square icon badges.** Icons are real matched
  SVG graphics (per the standing icon rule), never emoji, never generic.
- **No AI-generated imagery.** Mock visuals are hand-built DOM/SVG only.
- **Buttons:** rectangular or slightly rounded (radius <= 8px), min 44x44px targets.
- **Motion:** restrained and purposeful. The tug-of-war meter and node-graph pulses
  may animate; everything else is static. Always honor `prefers-reduced-motion`.

## Layout (from the reference)

1. **Header bar:** gavel mark + "AI COURTROOM" wordmark, debate question centered,
   LIVE badge (live-red) when a session is streaming.
2. **Candidates row:** two candidate cards — amber-bordered (Advocate A) left,
   teal-bordered (Advocate B) right. Tug-of-war score meter between them showing
   the current lean. Each card: name, cuisine tags, stats row (rating, distance,
   price, match %), one pros strip.
3. **Live debate transcript:** scrollable, advocate-colored blocks alternating;
   each argument carries an evidence chip naming its source
   (e.g. "Sara's taste graph · 92%").
4. **Evidence board:** node-graph of the group — center node for the party,
   per-person nodes colored by preference (amber = side A, teal = side B,
   neutral = muted), edge weights from Qloo taste-graph overlap. Legend at the
   bottom of the board.
5. **Verdict banner:** full-width solid gold bar — "THE VERDICT" + the decision
   text + a "DECISION · FINAL" tag. Renders only when the judge has ruled.

## Quality bar (standing mandates)

- Every build change is visually inspected in a real browser before being shown;
  if it looks off, fix it autonomously, then present.
- Never send an untested build. Verify it renders on a phone-width viewport first.
- Accessibility: contrast 4.5:1 minimum, visible focus rings, alt text, keyboard nav.
- Copy must be real and specific (real restaurant names, real scores, real stakes).
- Terms + Privacy pages, custom 404, favicon, SEO basics (titles, descriptions,
  sitemap, canonical), and `llms.txt` ship with production.
