# Design Structure

# Exotic Push Engine — Dashboard UI

---

## Logo

### Concept

The mark is a **notification in flight** — a push notification toast (pill shape, rounded left, arrowhead right) moving at speed through a dark field. Two pairs of gradient speed-trail bands above and below give it kinetic energy: transparent far left, brightening as they approach the arrow, as if the notification is tearing through space toward the recipient.

Inside the arrow: two white lines — a bold title bar and a shorter body preview — the actual anatomy of a push notification, abstracted to two strokes.

The container is a dark charcoal circle (`#1C1917`), not an orange square. The orange lives inside it, which is more sophisticated and gives maximum contrast for the white elements.

```
    ╭─────────────────────────╮
    │                         │
    │  ≡≡≡ ≡                  │
    │  ≡≡ ≡ ≡   ━━━━━━━━►    │   ━ = notification arrow (orange)
    │  ≡≡≡ ≡                  │   ≡ = speed trail bands (white, fading)
    │                         │   ━━ = content lines (white)
    ╰─────────────────────────╯
```

### Files

| File | Use |
|---|---|
| `public/logo-icon.svg` | Favicon, app icon, avatar, any square context |
| `public/logo.svg` | Light backgrounds — page header, docs, login |
| `public/logo-dark.svg` | Dark backgrounds — sidebar rail, splash, dark mode |

### Anatomy

```
 ╭──────────────────────────────────────────────────────────╮
 │                                                          │
 │  ╭──────────╮    exotic                                  │
 │  │  ━━━━━━► │    PUSH ENGINE                             │
 │  ╰──────────╯                                            │
 │                                                          │
 ╰──────────────────────────────────────────────────────────╯

   Icon circle     Wordmark
   64×64           "exotic"      — Montserrat 700, 23px, tight tracking
   r=30            "PUSH ENGINE" — Montserrat 500, 11px, #A8A29E, ls=3.2
```

### Mark construction (SVG)

The notification arrow is a single closed path:

```
M 16,25  A 7,7 0 0,0 16,39  L 44,39  L 55,32  L 44,25  Z
```

- `M 16,25` — top of the left pill
- `A 7,7 0 0,0 16,39` — CCW semicircle (r=7) down the left side through (9,32)
- `L 44,39` — bottom edge of the rectangular body
- `L 55,32` — arrowhead tip (center right)
- `L 44,25` — top edge back
- `Z` — close

The shape is exactly centered in the 64×64 icon canvas: horizontal center at x=32, vertical center at y=32.

### Color Versions

| Version | Circle bg | Arrow | "exotic" | "PUSH ENGINE" |
|---|---|---|---|---|
| Light (`logo.svg`) | `#1C1917` | `#EA580C` | `#1C1917` | `#A8A29E` |
| Dark (`logo-dark.svg`) | `#1C1917` (blends into bg) | `#EA580C` | `#FFFFFF` | `#78716C` |
| Icon only (`logo-icon.svg`) | `#1C1917` | `#EA580C` | — | — |

The dark version places the logo directly on the `#1C1917` sidebar — the circle background is invisible, so the orange arrow and white trails float on the surface.

### Usage Rules

- Minimum height: 24px icon-only · 40px full wordmark
- The arrow is always `#EA580C` — never tint or recolor it
- The dark circle background is always `#1C1917` — never swap for another color
- Clear space: equal to half the icon diameter on all sides
- Sidebar: use `logo-dark.svg` at 36px height, left-aligned with 20px left padding

---

## Typography

**Primary Font:** Montserrat (Google Fonts)

Import via `layout.tsx`:

```tsx
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});
```

| Weight | Use |
|---|---|
| 400 Regular | Body text, table cells, descriptions |
| 500 Medium | Form labels, secondary nav, badges |
| 600 SemiBold | Section headings, sidebar nav items, card titles |
| 700 Bold | KPI numbers, page titles, primary CTAs |

---

## Color Palette

The palette is built around a warm charcoal sidebar, an amber-orange primary, and warm off-white surfaces. Cold blue-grays are avoided throughout — this is not a generic SaaS tool.

### Brand Colors

| Token | Hex | Use |
|---|---|---|
| `primary` | `#EA580C` | Primary buttons, active nav, links, chart fill |
| `primary-hover` | `#C2410C` | Button hover state |
| `primary-light` | `#FED7AA` | Soft badge backgrounds, highlight rings |
| `primary-foreground` | `#FFFFFF` | Text on primary buttons |

### Surface Colors

| Token | Hex | Use |
|---|---|---|
| `background` | `#FAFAF9` | Page background (warm white, not cold) |
| `surface` | `#FFFFFF` | Cards, drawers, modals |
| `surface-raised` | `#F5F5F4` | Hover rows, input backgrounds |
| `sidebar-bg` | `#1C1917` | Sidebar background (warm near-black) |
| `sidebar-text` | `#D6D3D1` | Sidebar nav item text |
| `sidebar-active` | `#EA580C` | Active sidebar item indicator |
| `sidebar-hover` | `#292524` | Sidebar item hover background |

### Text Colors

| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#1C1917` | Main readable content |
| `text-secondary` | `#78716C` | Subtext, metadata, placeholders |
| `text-muted` | `#A8A29E` | Disabled, empty state text |
| `text-inverse` | `#FFFFFF` | Text on dark backgrounds |

### Border and Divider

| Token | Hex | Use |
|---|---|---|
| `border` | `#E7E5E4` | Card borders, table lines, input borders |
| `border-focus` | `#EA580C` | Input focus ring |
| `divider` | `#F5F5F4` | Section dividers, row separators |

### Semantic Colors

| Token | Hex | Use |
|---|---|---|
| `success` | `#16A34A` | Delivered status, active badges, success toasts |
| `success-bg` | `#F0FDF4` | Success badge background |
| `warning` | `#D97706` | Scheduled status, pending queue, warning toasts |
| `warning-bg` | `#FFFBEB` | Warning badge background |
| `error` | `#DC2626` | Failed delivery, error toasts, invalid states |
| `error-bg` | `#FEF2F2` | Error badge background |
| `info` | `#0284C7` | Informational toasts, link-style actions |
| `info-bg` | `#F0F9FF` | Info badge background |

### Chart Colors

Used in analytics and the overview dashboard. Ordered for accessible contrast when stacked.

| Role | Hex |
|---|---|
| Sent | `#EA580C` |
| Delivered | `#16A34A` |
| Clicked | `#0284C7` |
| Failed | `#DC2626` |
| Pending | `#D97706` |

### Tailwind CSS Config

```ts
// tailwind.config.ts
colors: {
  primary: {
    DEFAULT: '#EA580C',
    hover: '#C2410C',
    light: '#FED7AA',
    foreground: '#FFFFFF',
  },
  surface: {
    DEFAULT: '#FFFFFF',
    raised: '#F5F5F4',
  },
  sidebar: {
    bg: '#1C1917',
    text: '#D6D3D1',
    active: '#EA580C',
    hover: '#292524',
  },
  border: {
    DEFAULT: '#E7E5E4',
    focus: '#EA580C',
  },
  text: {
    primary: '#1C1917',
    secondary: '#78716C',
    muted: '#A8A29E',
    inverse: '#FFFFFF',
  },
}
```

---

## Global Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [EPE Logo]  [Site Switcher ▼]              [user] [notifs] [?] │  ← h-14, bg-white, border-b
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│   Sidebar    │   Main content area                              │
│   w-60       │   flex-1, overflow-y-auto, p-6                  │
│   fixed      │                                                  │
│   bg         │                                                  │
│   sidebar-bg │                                                  │
│              │                                                  │
│   Overview   │                                                  │
│   Sites      │                                                  │
│   Campaigns  │                                                  │
│   Subscribers│                                                  │
│   Segments   │                                                  │
│   Automations│                                                  │
│   Analytics  │                                                  │
│   ──────     │                                                  │
│   Settings   │                                                  │
│   [collapse] │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**Header:** `h-14 bg-white border-b border-border sticky top-0 z-40`

**Sidebar:** `w-60 bg-sidebar-bg fixed left-0 top-14 bottom-0 overflow-y-auto` — collapsible to `w-16` (icon-only mode), persisted in `localStorage`.

**Site Switcher:** Shadcn `Popover` + `Command` component, searchable. Supports "All Sites" as a global view plus any of the 110+ individual sites. Always visible in the header — it controls the data scope for every page.

**Main content:** `ml-60 pt-14 min-h-screen bg-background`. Padding collapses to `ml-16` when sidebar is collapsed.

---

## Page Structure

### Route Map

```
/                          Overview dashboard
/sites                     Site list
/sites/[id]                Site detail + settings
/campaigns                 Campaign list
/campaigns/new             Campaign builder
/campaigns/[id]            Campaign detail + stats
/subscribers               Subscriber table
/subscribers/[id]          Subscriber history (slide-out drawer)
/segments                  Segment list + builder
/automations               RSS feeds + workflow automations
/automations/rss           RSS feed manager
/automations/workflows     Workflow list + builder
/analytics                 Analytics dashboard
/settings                  Platform settings
/settings/credentials      VAPID + APNs + FCM credentials
/settings/users            User management + RBAC
/settings/audit            Audit log
```

---

### `/` — Overview Dashboard

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 4.2M        │ │ 3 Active    │ │ 6.8% CTR   │ │ 98.1%       │
│ Subscribers │ │ Campaigns   │ │ (7-day avg) │ │ Delivery    │
│ ▲ +1.2% 7d  │ │             │ │             │ │ Rate        │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

┌──────────────────────────────┐ ┌──────────────────────────────┐
│  Subscriber Growth (30d)     │ │  Recent Campaigns            │
│  [area chart — primary fill] │ │  Name | CTR | Sent | Status  │
│                              │ │                              │
└──────────────────────────────┘ └──────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  System Health                                               │
│  Queue Depth: 142  ✓    Workers: 4/4 active  ✓             │
│  Last delivery: 2 min ago  ✓    Redis: OK  ✓  DB: OK  ✓   │
└──────────────────────────────────────────────────────────────┘
```

**KPI cards:** `bg-surface rounded-xl border border-border p-5`. Value in `text-3xl font-bold text-text-primary`. Trend badge uses `success` or `error` semantic color.

**System Health:** Polled every 15 seconds via React Query `refetchInterval`. Shows a red warning badge if any indicator fails. Critical for IT Admin at-a-glance monitoring without opening a separate ops tool.

---

### `/sites` — Site Management

**Toolbar:** Search input + "Add Site" button (primary, top-right).

**Table columns:** Site Name, URL, Subscribers, Country, Language, Status badge, Last Campaign, Actions.

**Inline row actions (hover):** Edit (drawer), Disable toggle, Copy SDK snippet, View Subscribers (navigates with site pre-filtered).

**Add Site Drawer:** Opens as a Shadcn `Sheet` from the right. After saving, auto-shows the SDK Install step (copy/paste JavaScript snippet + VAPID public key). This is the first-time setup path — making it part of the creation flow eliminates the most common support question.

---

### `/campaigns` — Campaign List

**Tabs:** All · Instant · Scheduled · Recurring · Drafts

Each tab shows a sortable table: Campaign Name, Type badge, Site, Sent, CTR, Status badge, Scheduled At, Actions.

**Status badges:**

| Status | Color |
|---|---|
| Draft | `text-muted bg-surface-raised` |
| Scheduled | `warning` |
| Sending | `primary` (pulsing dot) |
| Sent | `success` |
| Failed | `error` |
| Expired | `text-muted` |

**"Create Campaign" button** is always visible as a sticky element at the top-right of this page and in the sidebar. It is the highest-frequency action in the system.

---

### `/campaigns/new` — Campaign Builder

This is the hero page. Two-panel layout that never leaves the user without context.

```
[Step indicator: 1.Content → 2.Audience → 3.Schedule → 4.Review]

┌─────────────────────────────────┬───────────────────────────────┐
│  LEFT: Form                     │  RIGHT: Live Preview (sticky) │
│                                 │                               │
│  Channel:                       │  Platform:  [Chrome ▼]       │
│  [● Web Push]  [  Mobile Push]  │                               │
│                                 │  ┌───────────────────────┐   │
│  Title                          │  │ 🔔 exotic-africa.com  │   │
│  ┌──────────────────────────┐   │  │ Big Safari Sale       │   │
│  │                          │   │  │ 30% off — book now    │   │
│  └──────────────────────────┘   │  │ [View Deal] [Dismiss] │   │
│  0/65 characters                │  └───────────────────────┘   │
│                                 │                               │
│  Message                        │  Also preview on:            │
│  ┌──────────────────────────┐   │  [Firefox] [Android] [iOS]   │
│  │                          │   │                               │
│  └──────────────────────────┘   │  Character limits:           │
│  0/240 characters               │  Title: 65  Body: 240        │
│                                 │                               │
│  Icon URL   _______________     │                               │
│  Image URL  _______________     │                               │
│  Destination URL  __________    │                               │
│                                 │                               │
│  Action Buttons                 │                               │
│  [+ Add button] (max 2)         │                               │
│                                 │                               │
│  Expiry                         │                               │
│  [Date + Time picker]           │                               │
│                                 │                               │
│              [Save Draft]  [Next →]                            │
└─────────────────────────────────┴───────────────────────────────┘
```

**Step 2 — Audience:**

```
  Audience:  [● All Subscribers]  [  Segment]

  If Segment selected:
  ┌──────────────────────────────────────────┐
  │  Select segment:  [Tech-savvy mobile ▼]  │
  │  or [+ Create new segment]               │
  └──────────────────────────────────────────┘

  Estimated reach:  284,301 subscribers  ← live count, React Query
```

**Step 3 — Schedule:**

```
  Send:  [● Now]  [  Scheduled]  [  Recurring]

  If Scheduled:
  Date: [Date picker]   Time: [Time input]   Timezone: [TZ picker ▼]

  If Recurring:
  Repeat: [Daily ▼]   At: [09:00]   Until: [Date picker]
```

**Step 4 — Review:** Read-only summary of all steps + the push preview one more time. Final "Send Campaign" or "Schedule Campaign" CTA.

**Shadcn components:** `ResizablePanelGroup` for the two-panel split. Preview panel has `position: sticky; top: 1.5rem`. `useFormContext` (react-hook-form) across all steps.

---

### `/subscribers` — Subscriber Management

Virtualized table using `@tanstack/react-virtual` — required at 5M+ rows. Pagination is not acceptable at this scale.

**Filter panel** (collapsible, left side):

```
┌── Filters ──────────────┐
│ Site         [All ▼]    │
│ Country      [All ▼]    │
│ Browser      [All ▼]    │
│ Device       [All ▼]    │
│ Language     [All ▼]    │
│ Status       [Active ▼] │
│ Last seen    [Any ▼]    │
│                         │
│ [Clear filters]         │
└─────────────────────────┘
```

**Table columns:** Endpoint (truncated), Browser icon, Device icon, Country flag, Language, Last Seen (relative time), Status badge, Actions.

**Row click:** Opens a Shadcn `Sheet` drawer from the right showing the subscriber's delivery history — every notification sent, its status, and whether it was clicked. Keeps the table visible in the background.

**Export:** "Export CSV" button applies all active filters before exporting.

---

### `/segments` — Segments

**Segment rule builder:**

```
  Segment name: ______________________________

  Match  [ALL ▼]  of these rules:

  ┌─────────────────────────────────────────────────┐
  │  [Country ▼]     [is ▼]        [South Africa ▼]  [×] │
  │  [Device ▼]      [is ▼]        [Mobile ▼]        [×] │
  │  [Last Seen ▼]   [within ▼]    [30 days ▼]       [×] │
  └─────────────────────────────────────────────────┘

  [+ Add rule]

  ──────────────────────────────────────────────────
  Estimated subscribers:  284,301   ← debounced live count
  ──────────────────────────────────────────────────

  [Cancel]  [Save Segment]
```

Live subscriber count updates 300ms after the last filter change (debounced). This gives the team confidence about reach before attaching a segment to a campaign.

---

### `/automations` — Automations

**Two tabs: RSS Feeds · Workflows**

**RSS Feeds tab:**

Table: Feed URL, Name, Site, Last Checked, Status (active/paused), toggle. Clicking a row opens a drawer to set the campaign template (title pattern, message pattern, image field mapping) for campaigns auto-generated when the feed updates.

**Workflows tab:**

Step-chain builder (not a visual canvas — a simple ordered list is faster to build and easier to maintain):

```
  Workflow name: ______________________   Site: [All ▼]

  TRIGGER
  ┌──────────────────────────────────────┐
  │  Event:  [New Subscriber ▼]          │
  └──────────────────────────────────────┘

  ↓

  STEP 1
  ┌──────────────────────────────────────┐
  │  Action:  [Send Push ▼]              │
  │  Campaign:  [Welcome notification ▼] │
  │  Delay:  [Immediately ▼]             │
  └──────────────────────────────────────┘

  [+ Add step]

  [Save Workflow]   [Enable]
```

Trigger options: New Subscriber · Page Visit · Notification Click · RSS Update · API Event

Action options: Send Push · Add Tag · Remove Tag · Webhook

---

### `/analytics` — Analytics

```
[Date range: Last 30 days ▼]   [Site: All Sites ▼]   [Export ▼]

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  2.4M    │ │  2.35M   │ │  160K    │ │  6.8%    │ │  42K     │ │  18K     │
│  Sent    │ │ Delivered│ │  Clicks  │ │  CTR     │ │ New Subs │ │ Expired  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

┌───────────────────────────────────────────────────────┐
│  Sent vs Delivered vs Clicked — Daily (30d)           │
│  [Grouped bar chart, 3 series]                        │
└───────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌───────────────────────────┐
│  Deliveries by Country   │  │  Subscribers by Browser   │
│  [Horizontal bar chart]  │  │  [Donut chart]            │
└──────────────────────────┘  └───────────────────────────┘

┌──────────────────────────┐  ┌───────────────────────────┐
│  Growth by Site          │  │  Growth by Country         │
│  [Vertical bar chart]    │  │  [Vertical bar chart]      │
└──────────────────────────┘  └───────────────────────────┘

┌───────────────────────────────────────────────────────┐
│  Time Performance                                     │
│  Best hour | Best day | Best site hour | CTR by hour  │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│  Content Performance                                  │
│  Type | Sent | Clicks | CTR | Best country | Best site│
└───────────────────────────────────────────────────────┘

Content type selection in campaign forms should surface the default UTM template for the notification URL and allow controlled overrides when the user has permission.

┌───────────────────────────────────────────────────────┐
│  Campaign Performance                                  │
│  Name | Site | Sent | Delivered | Clicks | CTR | Date │
│  (sortable, paginated at 50 rows)                     │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│  Individual Push Reports                               │
│  Title | Site | Country | Scheduled | Sent | CTR | ... │
│  (sortable, paginated at 50 rows)                     │
└───────────────────────────────────────────────────────┘
```

Charts: Use [Recharts](https://recharts.org) — already compatible with React and Shadcn, no extra dependency needed.

---

### `/settings` — Settings

**Sub-nav tabs:** General · Push Credentials · Mobile Credentials · Users & Roles · Audit Log

**General:** Platform name, default timezone, notification icon fallback.

**Push Credentials:** Per-site VAPID public + private key display (masked). Regenerate button requires confirmation modal.

**Mobile Credentials:** APNs p8 key upload + key ID + team ID per site. FCM service account JSON upload per site. Stored encrypted, never displayed in full after upload.

**Users & Roles tab:**

Table of users with role badges. Roles: `Admin`, `Marketing`, `SEO`, `Viewer`. Add/remove users. Edit role inline.

**Audit Log tab:**

Append-only table: Timestamp · User · Action · Entity · IP Address. Filterable by user and action type. No delete or edit controls — read-only.

---

## Component Conventions

### Shadcn Components Used

| Component | Where |
|---|---|
| `Sidebar` | Global navigation |
| `Sheet` | Subscriber detail, site edit, SDK install |
| `Dialog` | Confirmations (delete, disable, regenerate key) |
| `Popover` + `Command` | Site switcher, segment selector |
| `ResizablePanelGroup` | Campaign builder two-panel layout |
| `Tabs` | Campaign list, automations, settings |
| `Badge` | Status indicators throughout |
| `DataTable` | All list views (built on TanStack Table) |
| `Calendar` + `DatePicker` | Campaign scheduler |
| `Toast` (Sonner) | Action feedback |
| `Skeleton` | Loading states on all data-fetching pages |

### Status Badge Colors

All status badges use the semantic color tokens defined above.

```tsx
const statusVariants = {
  active:    'bg-success-bg text-success',
  scheduled: 'bg-warning-bg text-warning',
  sending:   'bg-primary-light text-primary',
  sent:      'bg-success-bg text-success',
  failed:    'bg-error-bg text-error',
  draft:     'bg-surface-raised text-text-muted',
  expired:   'bg-surface-raised text-text-muted',
  paused:    'bg-warning-bg text-warning',
};
```

### Empty States

Every list page needs a meaningful empty state — not a blank table. Structure:

```
[Illustration or icon]
Heading: No campaigns yet
Subtext: Create your first campaign to start engaging subscribers.
[Primary CTA button]
```

Empty states are the onboarding path. They should tell the user exactly what to do next.

### Confirmation Dialogs

Destructive actions (delete, disable, regenerate credentials) always require a `Dialog` with:
- Clear description of what will happen
- A text input confirmation for high-impact actions (e.g., type the site name to delete)
- "Cancel" as default focused button

---

## Responsive Behavior

The dashboard targets desktop-first (internal tool, used by teams at desks). Minimum supported width is 1280px. Below 1280px the sidebar collapses to icon-only automatically. Mobile viewports (< 768px) show a warning that the dashboard is optimized for desktop.

---

## Data Fetching Conventions

All data fetching uses React Query (`@tanstack/react-query`).

| Scenario | Convention |
|---|---|
| List pages | `useQuery` with `staleTime: 60_000` |
| System health widget | `useQuery` with `refetchInterval: 15_000` |
| Live segment count | `useQuery` with `enabled` and 300ms debounce on filters |
| Mutations (create/update/delete) | `useMutation` + `invalidateQueries` on success |
| Optimistic updates | Enabled for status toggles (enable/disable site, enable/disable workflow) |
| Errors | Caught globally by a React Query `onError` handler that fires a Sonner toast |
