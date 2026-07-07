# design-system.md — HuntFlow UI/UX Specification

> **Purpose:** Feed this to your AI before it generates any UI. Prevents arbitrary color choices, inconsistent spacing, and ugly components.

---

## Design Principles

1. **Dark First:** Default theme is dark. Hunters work at night. Light mode is secondary.
2. **High Contrast:** Text must be readable in direct sunlight (mobile testing outdoors).
3. **Information Density:** Show what matters, hide what doesn't. No wasted space.
4. **Touch Targets:** Minimum 44x44px for all interactive elements (mobile-first).
5. **Instant Feedback:** Every tap/click gets immediate visual response.

---

## Color Palette

### Primary Colors (Green — "Go/Hunt")
```
primary-50:   #f0fdf4   (lightest bg)
primary-100:  #dcfce7
primary-200:  #bbf7d0
primary-300:  #86efac
primary-400:  #4ade80
primary-500:  #22c55e   (main action color)
primary-600:  #16a34a   (hover state)
primary-700:  #15803d
primary-800:  #166534
primary-900:  #14532d   (darkest)
```

### Neutral Colors (Slate — "Professional/Technical")
```
slate-50:    #f8fafc
slate-100:   #f1f5f9
slate-200:   #e2e8f0
slate-300:   #cbd5e1
slate-400:   #94a3b8   (secondary text)
slate-500:   #64748b
slate-600:   #475569
slate-700:   #334155
slate-800:   #1e293b   (card backgrounds)
slate-850:   #172033   (custom — between 800 and 900)
slate-900:   #0f172a   (page backgrounds)
slate-950:   #020617   (deepest bg)
```

### Semantic Colors
```
Success:   #22c55e  (primary-500)
Warning:   #f59e0b  (amber-500)
Danger:    #ef4444  (red-500)
Info:      #3b82f6  (blue-500)
Neutral:   #64748b  (slate-500)
```

### Priority Colors
```
P0 (Critical): #ef4444  (red-500)  + pulse animation
P1 (High):     #f97316  (orange-500)
P2 (Medium):   #eab308  (yellow-500)
P3 (Low):      #64748b  (slate-500)
```

### Status Colors
```
Recon:     #3b82f6  (blue-500)
Testing:   #f59e0b  (amber-500)
Reported:  #8b5cf6  (violet-500)
Paid:      #22c55e  (green-500)
Closed:    #64748b  (slate-500)
Archived:  #475569  (slate-600)
```

### Severity Colors
```
Critical:  #dc2626  (red-600)
High:      #ea580c  (orange-600)
Medium:    #ca8a04  (yellow-600)
Low:       #525252  (neutral-600)
Info:      #2563eb  (blue-600)
```

### Dark Mode (Default)
| Element | Background | Text | Border |
|---------|-----------|------|--------|
| Page | slate-900 | slate-100 | slate-800 |
| Card | slate-800 | slate-100 | slate-700 |
| Input | slate-850 | slate-100 | slate-600 |
| Input Focus | slate-850 | slate-100 | primary-500 |
| Button Primary | primary-600 | white | none |
| Button Secondary | slate-700 | slate-100 | slate-600 |
| Button Danger | red-600 | white | none |
| Nav | slate-950 | slate-300 | slate-800 |
| Overlay | slate-950/80 | — | — |

### Light Mode (Secondary)
| Element | Background | Text | Border |
|---------|-----------|------|--------|
| Page | slate-50 | slate-900 | slate-200 |
| Card | white | slate-900 | slate-200 |
| Input | white | slate-900 | slate-300 |
| Button Primary | primary-500 | white | none |
| Nav | white | slate-700 | slate-200 |

---

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;
```

### Monospace (Code Blocks, Payloads)
```css
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 
             'Cascadia Code', monospace;
```

### Type Scale
```
Display:    2.25rem (36px)  font-bold   line-height: 1.2
H1:         1.875rem (30px) font-bold   line-height: 1.3
H2:         1.5rem (24px)   font-semibold line-height: 1.4
H3:         1.25rem (20px)  font-semibold line-height: 1.4
Body:       1rem (16px)     font-normal line-height: 1.5
Body Small: 0.875rem (14px) font-normal line-height: 1.5
Caption:    0.75rem (12px)  font-medium line-height: 1.4
Label:      0.75rem (12px)  font-semibold uppercase tracking-wide
```

### Text Colors
```
Primary text:    slate-100 (dark) / slate-900 (light)
Secondary text:  slate-400 (dark) / slate-500 (light)
Muted text:      slate-500 (dark) / slate-400 (light)
Link text:       primary-400 (dark) / primary-600 (light)
Error text:      red-400 (dark) / red-600 (light)
```

---

## Spacing Scale

Use Tailwind's default spacing (multiples of 4px):
```
1:  4px    (xs)
2:  8px    (sm)
3:  12px
4:  16px   (base)
5:  20px
6:  24px   (md)
8:  32px   (lg)
10: 40px
12: 48px   (xl)
16: 64px   (2xl)
20: 80px
24: 96px
```

### Layout Spacing
```
Page padding:     px-4 (16px) mobile, px-6 (24px) tablet, px-8 (32px) desktop
Card padding:     p-4 (16px)
Card gap:         gap-4 (16px)
Section gap:      gap-6 (24px)
Form field gap:   gap-4 (16px)
Button gap:       gap-2 (8px)
```

---

## Border Radius
```
Small:   rounded-md   (6px)   — buttons, inputs, badges
Medium:  rounded-lg   (8px)   — cards, modals
Large:   rounded-xl   (12px)  — feature cards, containers
Full:    rounded-full (9999px) — avatars, pills, circular buttons
```

---

## Shadows

### Dark Mode
```
sm:   shadow-sm   — 0 1px 2px rgba(0,0,0,0.3)
md:   shadow-md   — 0 4px 6px rgba(0,0,0,0.4)
lg:   shadow-lg   — 0 10px 15px rgba(0,0,0,0.5)
xl:   shadow-xl   — 0 20px 25px rgba(0,0,0,0.6)
```

### Light Mode
```
sm:   shadow-sm   — 0 1px 2px rgba(0,0,0,0.05)
md:   shadow-md   — 0 4px 6px rgba(0,0,0,0.1)
lg:   shadow-lg   — 0 10px 15px rgba(0,0,0,0.1)
```

---

## Component Specifications

### Button

**Primary Button**
```
Background:     primary-600
Text:           white
Padding:        px-4 py-2.5
Border Radius:  rounded-md
Font:           font-medium text-sm
Hover:          bg-primary-700
Active:         bg-primary-800 scale-[0.98]
Disabled:       bg-slate-700 text-slate-500 cursor-not-allowed
Shadow:         shadow-sm
```

**Secondary Button**
```
Background:     slate-700
Text:           slate-100
Border:         border border-slate-600
Padding:        px-4 py-2.5
Border Radius:  rounded-md
Font:           font-medium text-sm
Hover:          bg-slate-600
Active:         bg-slate-800
```

**Danger Button**
```
Background:     red-600
Text:           white
Padding:        px-4 py-2.5
Border Radius:  rounded-md
Hover:          bg-red-700
```

**Icon Button**
```
Size:           40x40px (min touch target)
Background:     transparent
Text:           slate-400
Hover:          bg-slate-800 text-slate-100
Border Radius:  rounded-lg
```

**Button Sizes**
```
Small:   px-3 py-1.5 text-xs
Medium:  px-4 py-2.5 text-sm  (default)
Large:   px-6 py-3 text-base
```

### Input

**Text Input**
```
Background:     slate-850
Text:           slate-100
Placeholder:    slate-500
Border:         border border-slate-600
Border Radius:  rounded-md
Padding:        px-3 py-2.5
Font:           text-sm
Focus:          border-primary-500 ring-1 ring-primary-500/50
Error:          border-red-500 ring-1 ring-red-500/50
Disabled:       bg-slate-800 text-slate-500
```

**Textarea**
```
Same as Text Input
Min Height:     100px
Resize:         vertical only
```

**Select/Dropdown**
```
Same as Text Input
Arrow:          ChevronDown icon, slate-400
Dropdown bg:    slate-800
Dropdown border: slate-700
Option hover:   bg-slate-700
```

### Card

**Standard Card**
```
Background:     slate-800
Border:         border border-slate-700
Border Radius:  rounded-lg
Padding:        p-4
Shadow:         shadow-sm
Hover:          border-slate-600 (subtle)
```

**Interactive Card** (clickable)
```
Same as Standard
Hover:          border-primary-500/50 bg-slate-750
Active:         scale-[0.99]
Cursor:         cursor-pointer
```

**Feature Card** (highlighted)
```
Background:     slate-800
Border:         border border-primary-500/30
Border Radius:  rounded-xl
Padding:        p-6
Shadow:         shadow-md
```

### Badge

```
Padding:        px-2 py-0.5
Border Radius:  rounded-full
Font:           text-xs font-medium
```

**Variants:**
```
Default:   bg-slate-700 text-slate-300
Success:   bg-green-500/20 text-green-400 border border-green-500/30
Warning:   bg-amber-500/20 text-amber-400 border border-amber-500/30
Danger:    bg-red-500/20 text-red-400 border border-red-500/30
Info:      bg-blue-500/20 text-blue-400 border border-blue-500/30
Primary:   bg-primary-500/20 text-primary-400 border border-primary-500/30
```

### Modal/Dialog

```
Overlay:        bg-slate-950/80 backdrop-blur-sm
Container:      bg-slate-800 rounded-xl shadow-xl
Max Width:      max-w-md (mobile), max-w-lg (tablet), max-w-xl (desktop)
Padding:        p-6
Animation:      fade in 150ms, scale from 95% to 100%
Close:          X icon top-right, also close on overlay click
```

### Toast/Notification

```
Position:       bottom-4 right-4 (desktop), top-4 center (mobile)
Background:     slate-800
Border:         border-l-4 (color by type)
Border Radius:  rounded-lg
Padding:        px-4 py-3
Shadow:         shadow-lg
Animation:      slide in from bottom 200ms
Auto-dismiss:   4 seconds
```

**Toast Types:**
```
Success: border-l-green-500
Error:   border-l-red-500
Warning: border-l-amber-500
Info:    border-l-blue-500
```

---

## Navigation

### Bottom Tab Bar (Mobile Primary)
```
Position:       fixed bottom-0
Background:     slate-950 border-t border-slate-800
Height:         64px
Items:          5 tabs max
Active:         text-primary-400
Inactive:       text-slate-500
Icon Size:      24px
Label:          text-xs mt-1
```

**Tabs:**
1. Dashboard (Home icon)
2. Timer (Target/Crosshair icon)
3. Targets (Flag icon)
4. Notes (FileText icon)
5. Settings (Settings icon)

### Side Navigation (Desktop)
```
Position:       fixed left-0
Width:          64px (collapsed), 240px (expanded)
Background:     slate-950 border-r border-slate-800
Height:         100vh
Item Height:    48px
Active:         bg-slate-800 text-primary-400 border-r-2 border-primary-500
Inactive:       text-slate-400 hover:bg-slate-900
```

---

## Timer UI Specification

### Timer Ring
```
Size:           240px (mobile), 280px (desktop)
Stroke Width:   8px
Background:     slate-700 (track)
Progress:       primary-500 (fill)
Transition:     stroke-dashoffset 1s linear
```

### Timer States
```
Idle:      Ring empty, text slate-400, "Start Hunting" button
Running:   Ring filling, text white, Pause + Abandon buttons
Paused:    Ring static, text amber-400, Resume + Abandon buttons
Completed: Ring full, text primary-400, "Session Complete!" modal
```

### Timer Text
```
Time Display:   font-mono text-5xl font-bold
Target Label:   text-sm text-slate-400 mt-2
Template Label: text-xs text-primary-400 mt-1
Session Count:  text-xs text-slate-500 mt-4
```

---

## Note Editor UI

### Editor Layout
```
Top Bar:        Title input + Template selector + Target selector
Body:           Markdown textarea (main area)
Bottom Bar:     Tags input + Save button + Character count
Preview Toggle: Tab switch between Write / Preview
```

### Markdown Preview Styling
```
Headings:       font-bold text-slate-100 border-b border-slate-700 pb-1
Code Inline:    bg-slate-900 text-primary-300 px-1.5 py-0.5 rounded text-sm font-mono
Code Block:     bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto font-mono text-sm
Lists:          list-disc pl-5 space-y-1
Links:          text-primary-400 underline
Blockquote:     border-l-4 border-slate-600 pl-4 italic text-slate-400
```

---

## Stats Dashboard UI

### Streak Calendar (GitHub-style)
```
Grid:           7 columns (Mon-Sun), 12-16 rows
Cell Size:      12px x 12px (mobile), 16px x 16px (desktop)
Cell Gap:       3px
Cell Radius:    rounded-sm
Empty:          bg-slate-800
Level 1:        bg-primary-900/50
Level 2:        bg-primary-800
Level 3:        bg-primary-600
Level 4:        bg-primary-400
Level 5:        bg-primary-300
```

### Stat Cards
```
Layout:         Grid 2 cols (mobile), 3-4 cols (desktop)
Card:           Standard Card
Icon:           24px, colored by stat type
Value:          text-2xl font-bold
Label:          text-sm text-slate-400
Trend:          text-xs with arrow (up/down)
```

---

## Animations

### Allowed Animations (CSS only)
```
Fade In:        opacity 0 → 1, 150ms ease-out
Slide Up:       translateY(8px) → 0, 200ms ease-out
Scale In:       scale(0.95) → 1, 150ms ease-out
Pulse:          scale(1) → scale(1.05) → scale(1), 2s infinite (P0 priority only)
Ring Progress:  stroke-dashoffset, 1s linear (timer only)
```

### Forbidden Animations
- ❌ Parallax scrolling
- ❌ Complex page transitions
- ❌ Blur animations (performance)
- ❌ 3D transforms
- ❌ Particle effects
- ❌ Skeleton loaders with shimmer (use simple pulse instead)

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Responsive Breakpoints

```
Mobile:     < 640px   (default, single column)
Tablet:     640px+    (sm:)
Desktop:    1024px+   (lg:)
Wide:       1280px+   (xl:)
```

### Layout Rules
```
Mobile:     Bottom nav, full-width cards, stacked layouts
Tablet:     Side nav (collapsed), 2-col grids
Desktop:    Side nav (expanded), 3-4 col grids, larger typography
```

---

## Iconography

### Source: Lucide Icons (lucide-svelte)
### Size Rules
```
Inline:       16px
Button:       20px
Nav:          24px
Feature:      32px
Empty State:  48px
```

### Icon Color Rules
```
Default:      slate-400
Active/Primary: primary-400
Danger:       red-400
Success:      green-400
Warning:      amber-400
```

### Key Icons by Feature
```
Dashboard:    LayoutDashboard
Timer:        Crosshair, Play, Pause, Square, RotateCcw
Targets:      Flag, Globe, Link, ExternalLink
Notes:        FileText, StickyNote, Save, Trash2, Edit3
Stats:        BarChart3, TrendingUp, Flame, Trophy, Clock
Settings:     Settings, Moon, Sun, Download, Upload, Trash
Vuln Types:   Shield (generic), Unlock (auth), Database (sqli), 
              Code (xss), Globe (ssrf), Eye (idor), FileWarning (info)
```

---

## Empty States

### Pattern
```
Icon:           48px, slate-600
Title:          text-lg font-semibold text-slate-300
Description:    text-sm text-slate-500
Action:         Primary button (if applicable)
```

### Examples
```
No Sessions:    "No testing sessions yet" + "Start your first session" button
No Targets:     "No targets tracked" + "Add your first target" button
No Notes:       "No notes yet" + "Write your first note" button
No Stats:       "Hunt for 7 days to see your streak" + subtle illustration
```

---

## Form Validation UI

### Error State
```
Input Border:   border-red-500
Input Ring:     ring-1 ring-red-500/50
Error Text:     text-xs text-red-400 mt-1
Error Icon:     AlertCircle, 16px, red-400, inline before text
```

### Success State
```
Input Border:   border-green-500
Check Icon:     CheckCircle, 16px, green-400
```

---

## Loading States

### Button Loading
```
Spinner:        Loader2 icon, 16px, animate-spin
Text:           "Saving..." or "Loading..."
Disabled:       opacity-70 cursor-wait
```

### Page Loading
```
Skeleton:       bg-slate-800 rounded-lg animate-pulse
Height:         Match expected content height
Count:          3-5 skeleton items
```

### Inline Loading
```
Spinner:        Loader2, 20px, animate-spin, centered
Text:           Optional "Loading..." below spinner
```

---

*Give this to your AI before it writes any Svelte components. It will generate consistent, professional UI that feels like a native app.*

*Last updated: 2026-04-24*
