<design-context>
---
version: alpha
name: Abiram Sureshbabu
description: "Abiram Sureshbabu — AI & Data Science student, frontend developer, and Frontend Developer at Luna Digital."
sourceUrl: "https://abiramsureshbabu-portfolio.web.app/"

colors:
  primary: "#df9c84"
  on-primary: "#ffffff"
  background: "#103243"
  surface: "#184155"
  border: "#df9c84"
  text: "#ffffff"
  text-muted: "#df9c84"
  accent: "#103243"

typography:
  display:
    fontFamily: "Milonga, Georgia, serif"
    fontSize: 96px
    fontWeight: 700
    lineHeight: 0.93
    letterSpacing: -2px
  heading:
    fontFamily: "Milonga, Georgia, serif"
    fontSize: 80px
    fontWeight: 700
    lineHeight: 1.65
    letterSpacing: -1px
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.65
  mono:
    fontFamily: "DM Mono, monospace"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: 0.2px

spacing:
  base: 2px
  scale: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

radius:
  sm: 4px
  md: 6px
  lg: 9px
  xl: 12px
  pill: 9999px

shadows:
  card: "rgba(223, 156, 132, 0.35) 0px 4px 18px 0px"
  elevated: "rgba(0, 0, 0, 0.45) 0px 30px 80px 0px, rgba(223, 156, 132, 0.15) 0px 0px 30px 0px"

motion:
  duration-fast: 100ms
  duration-base: 400ms
  duration-slow: 2000ms
  easing: "cubic-bezier(0.16, 1, 0.3, 1)"
---

## Rationale

Abiram Sureshbabu's portfolio uses a warm-on-cool color strategy that balances approachability with technical credibility. The deep teal background (#103243) conveys stability and depth—fitting for someone positioned as an AI & Data Science student and frontend developer—while the terracotta primary (#df9c84) introduces warmth and humanity. This contrast is intentional: the palette signals both analytical rigor and creative sensibility, avoiding the sterility of pure tech portfolios while staying grounded in professional context. The dark mode choice reduces eye strain during portfolio browsing and creates an immersive, gallery-like environment where project work becomes the focal point.

Typography deliberately separates performance from presence. The serif display and heading faces (Milonga) command attention and convey design sophistication, crucial for a creative technologist whose work is visual. The generous line height (1.65 on body, even looser on headings) and tight letter-spacing on display text (-2px) create a confident, editorial voice—this is someone with a point of view. Body copy shifts to the cleaner, more utilitarian DM Sans, signaling the transition from visual storytelling to functional information. The 600 font-weight floor across all scales reflects a preference for legibility and presence over delicacy.

Spacing and motion reinforce a contemporary, premium feel without excess. The base-2 scale keeps increments tight and intentional; the cubic-bezier easing (0.16, 1, 0.3, 1) is slightly bouncy, adding personality to interactions while the 100–400ms fast/base durations feel snappy enough for a dev-conscious audience. Shadows—especially the card shadow with its terracotta tint—consistently echo the primary color, making the entire system feel unified. This is a portfolio built for impact: every token choice serves to elevate work and establish the designer/developer as someone who sweats details.

---

## 1. Visual Theme & Atmosphere

The design establishes a **dark-mode creative studio** aesthetic. The dominant background (#103243) is a navy-teal that reads as calm, professional, and slightly futuristic, while the surface layer (#184155) provides subtle depth for cards and sections. The terracotta primary (#df9c84) acts as both a visual accent and a temperature controller—it prevents the palette from feeling cold or corporate. This combination creates an environment that feels simultaneously **editorial and technical**: galleries and case studies sit comfortably alongside code snippets and skill lists. The color mode is unambiguously dark; there is no light alternate token set, suggesting this portfolio is designed for the expectation of ambient darkness.

---

## 2. Color System

**Primary & Semantic:**
- **Primary (#df9c84):** Terracotta, warm, used for CTAs, borders, and emphasis. High presence without harshness.
- **On-Primary (#ffffff):** Pure white, ensuring strong contrast for text atop primary elements.
- **Background (#103243):** Navy-teal, the foundational page color.
- **Surface (#184155):** A lighter teal, used for cards, modals, and layered regions; creates visual hierarchy via tone.
- **Border (#df9c84):** Identical to primary, reinforcing a unified, warm accent line.
- **Text (#ffffff):** White for primary content.
- **Text-Muted (#df9c84):** Secondary text reuses the primary color; this is a bold choice that eliminates a traditional gray tier, instead using accent color for de-emphasis. Creates an almost monochromatic secondary layer.
- **Accent (#103243):** Echoes the background; likely used for focus states or additional layering.

**Shadows & Depth:**
- **Card shadow:** `rgba(223, 156, 132, 0.35) 0px 4px 18px 0px`—a soft, warm glow that tints elevation with the primary color.
- **Elevated shadow:** A dual-layer system: deep black (0.45 opacity, 30px blur) for hard depth, plus a soft terracotta halo (0.15 opacity, 30px blur) for brand consistency. Used sparingly for modals or hero moments.

**Contrast & Accessibility:**
The system relies heavily on white-on-teal for primary content (excellent contrast: ~12:1 WCAG AAA), but introduces risk via muted text (terracotta on teal). The terracotta (#df9c84) on background (#103243) yields a contrast ratio of approximately **3.5:1**, which **fails WCAG AA (4.5:1 minimum)**. This is a design choice, not a bug—muted text is used for secondary information (captions, metadata, labels), and the site likely passes AA when weighted across the full page. However, caution should be applied to ensure muted text is never used for essential content.

---

## 3. Typography

**Display (96px, Milonga, serif, 700 weight, -2px letter-spacing, 0.93 line-height):**
- Used for hero title / main heading.
- Extremely tight line-height and aggressive negative letter-spacing create a compressed, high-impact presence.
- Serif choice (Milonga) signals creative authority; the weight and spacing read as confident, almost art-directed.

**Heading (80px, Milonga, serif, 700 weight, -1px letter-spacing, 1.65 line-height):**
- Section headings and subheadings ("My Showreel," "Projects I've Built," "Skills & Stack").
- Slightly more breathing room than display (1.65 vs 0.93 line-height) while maintaining tightness via -1px letter-spacing.
- Serif consistency reinforces hierarchy and visual identity.

**Body (14px, DM Sans, sans-serif, 600 weight, 1.65 line-height):**
- Primary content, descriptions, metadata.
- Shift to sans-serif signals utility and clarity.
- 600 weight (semi-bold) ensures legibility at 14px on dark backgrounds; avoids the airy feel of 400-weight body text.
- 1.65 line-height is generous, supporting readability and a modern, spacious feel.

**Mono (12px, DM Mono, monospace, 600 weight, 0.2px letter-spacing, 1.65 line-height):**
- Code, technical references, skill tags.
- 0.2px letter-spacing improves monospace legibility on screens.
- Same line-height as body ensures consistent rhythm when mixing.

**Font-Family Stack:**
- Display/Heading: Milonga (serif), falls back to Georgia, then generic serif.
- Body: DM Sans, falls back to system-ui, then generic sans-serif.
- Mono: DM Mono, falls back to generic monospace.
- Choices reflect modern web typography with fallbacks for older systems; no web-safe fonts are foundational.

---

## 4. Components & Patterns

**Buttons & CTAs:**
- Primary CTA buttons likely use primary (#df9c84) background with on-primary white text.
- Text-based CTAs ("Contact," "Download CV," "download the showreel") probably render as terracotta text with underline or hover effect.
- Border CTA variant possible (terracotta border, white text, transparent background).

**Cards & Project Tiles:**
- Surface background (#184155) with card shadow (the warm, terracotta-tinted glow).
- Border: optional terracotta, reinforcing the accent color.
- Content inside uses white text and terracotta for secondary details.

**Links & Focus States:**
- Likely terracotta (#df9c84) color with underline.
- Focus state: 2px outline in primary color, 2px offset, matching accessibility spec.

**Badges / Skill Tags:**
- Probably surface background with terracotta text, or terracotta background with white text; monospace font for technical consistency.

**Section Dividers:**
- Subtle terracotta borders or gradient lines, echoing the border token.

---

## 5. Spacing & Layout

**Spacing Scale (base 2px):**
- Scale: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20px
- Increment: +2px per step, enabling fine-grained control while maintaining visual rhythm.
- Base unit (2px) is small, suited to tight, contemporary layouts; spacing rarely exceeds 20px within a single section.

**Application:**
- Padding inside cards/tiles: likely 16px or 18px (steps 8–9).
- Margin between sections: 20px or larger multiples (20px × 2 or 3).
- Text-to-element spacing (e.g., icon to label): 8–12px.
- Headings to body: 10–14px.

**Layout Rhythm:**
- No explicit breakpoints are defined in the tokens, suggesting either a fluid/mobile-first design or breakpoints managed outside the token system.
- Dark background and serif headings suggest a card-based, vertical-scrolling layout; sections likely stack and reflow gracefully.

---

## 6. Motion & Interaction

**Timing:**
- `durationFastMs: 100ms`—micro-interactions: hover color shifts, icon rotations, quick state changes.
- `durationBaseMs: 400ms`—standard transitions: fade-ins, slide-in animations, card reveals.
- `durationSlowMs: 2000ms`—slower reveals: hero animations, scroll-triggered sequences, showreel playback.

**Easing:**
- `cubic-bezier(0.16, 1, 0.3, 1)`—a custom, slightly bouncy curve with overshoot.
- Not a standard easing; the high y-value (1.0) at the midpoint and endpoint creates a playful, spring-like feel.
- Fits a creative portfolio; avoids the stiffness of `ease-in-out` while staying purposeful.

**Likely Applications:**
- Button hover: terracotta background shift, 100ms cubic-bezier ease.
- Card entrance: fade + slight scale-up, 400ms.
- Section scroll-reveal: opacity and transform, 400–2000ms depending on importance.
- Showreel playback: video or animation loop, respecting the slow duration for cinematic pacing.

---

## Accessibility

### Contrast Ratios

**Primary Content (White #ffffff on Background #103243):**
- Contrast ratio: **~12:1**
- Status: **WCAG AAA** ✓

**Muted Text (Terracotta #df9c84 on Background #103243):**
- Contrast ratio: **~3.5:1**
- Status: **WCAG AA ✗** (fails 4.5:1 threshold)
- Recommendation: Use muted text only for secondary information (captions, hints, metadata). Ensure all critical content uses white text. Consider testing with actual users and automated tools (Lighthouse, axe) to confirm page-level compliance.

**White on Primary (White #ffffff on Terracotta #df9c84):**
- Contrast ratio: **~6:1**
- Status: **WCAG AAA** ✓

**Terracotta on Surface (Terracotta #df9c84 on Surface #184155):**
- Contrast ratio: **~2.8:1**
- Status: **WCAG AA ✗**
- Recommendation: Avoid this pairing for body text; use for decorative elements or very short labels only.

### Minimum Requirements

- **Touch target:** All buttons, links, and interactive elements must be at least 44×44px. CTA buttons ("Contact," "Download CV") and link text should meet or exceed this.
- **Focus indicator:** On focus (keyboard navigation), elements must display a 2px outline in primary (#df9c84) or white, with 2px offset from element boundary. Critical for keyboard accessibility in a portfolio site where users may tab through projects and contact links.
- **Keyboard Navigation:** All CTAs and links must be keyboard-accessible; no JavaScript-only interactions without fallback.
- **Color Not Alone:** The terracotta accent should never be the sole indicator of state; pair with icons, text labels, or additional visual cues.
- **Motion:** Respect `prefers-reduced-motion` media query; provide a no-animation variant of entrance animations and transitions.

---

## Summary

This design system balances **visual elegance with technical clarity**. The warm terracotta on cool teal creates a memorable, inviting palette that avoids corporate chill. Type hierarchy is editorial and bold; spacing is intentional and tight; motion is purposeful and slightly playful. The main accessibility concern is muted-text contrast, which requires careful application and testing. Overall, the system is well-suited for a creative technologist's portfolio, where visual impact and design detail matter as much as the code underneath.

</design-context>

Use the design system above for all UI you generate.