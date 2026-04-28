# LLM Council — Pulse Production Hub

**Convened:** 2026-04-27 · 22:06 CDT
**Convened by:** Christian
**Subject:** Analyze the dashboard built so far, the benefits it brings to Pulse, and how to do it better — including automations and additions to make it the central command for Pulse content production.

---

## Step 1 — Framed Question

**Pulse Community Agency** (Bentonville, AR; ~2–3 person team) has built a Next.js + Supabase content production hub. It currently handles:

- Multi-client monthly content planning (ONSC, El Pueblito, plus Pulse-as-its-own-client).
- Shoot bundles with capacity-aware coverage gaps.
- Interactive capture checklist with Required + Extras lanes (floor, not ceiling).
- 6-stage post pipeline: Planned → Captured → Edited → Approved → Scheduled → Posted.
- Per-shoot Drive-link asset tracking; asset URL on each post auto-flips status to Edited.
- "Field Schedule" surface that detects co-located shoots and surfaces ride-along opportunities across clients.
- Piggyback shoots so Pulse house content gets captured during client outings.
- Deployed to Vercel.

**The question:** Now that the planning surface is in place, how does this become the **operational backbone** of the agency rather than another well-built tool the team forgets to open? What automations and additions actually close the gap from "great planning" to "central nervous system"?

**Stakes:** Get this right and the dashboard runs the agency. Get it wrong and Trey keeps using Drive folders + group chat, and the dashboard becomes a polished artifact that gets opened on demo days only.

---

## Step 2 — Five Advisors

### The Contrarian

The fatal flaw isn't what's missing — it's what the dashboard *doesn't eliminate*. Look at your team's actual day: Trey is on the road shooting, Christian is writing strategy, you're stitching it together. Before this app, they used Google Drive + group chat. After this app, they use Google Drive + group chat **plus** the app. You added a system without removing one. That's homework.

The pipeline (Planned → Captured → Edited → Approved → Scheduled → Posted) is going to be 90% Planned, 5% Captured, and 0% past that — because every status change is a manual click by someone who'd rather just do the work. The "Field Schedule" is operationally smart but, with two clients producing ~50 posts/month total, the optimization upside is roughly one half-day saved per month. Beautiful in principle, marginal in practice.

The hub is designed for a 6-person, 8-client agency. You have 2–3 people and 2 clients. The features (co-location detection, ride-along radar) presume problems you don't yet have at the scale where those features pay off. Meanwhile, the actual bottleneck — the gap between shoot day and posted content — has zero automation in your system.

The diagnostic question isn't "what should we add?" It's: **What human task did the dashboard kill this week?** If the answer is "none," the rest of this conversation is decoration.

### The First Principles Thinker

What are we actually solving?

A marketing agency exists to deliver agreed content on a schedule. The first-principle units are: (1) a contract that promises X pieces, (2) a person who shoots, (3) a person who edits, (4) a person who approves, (5) a destination. Everything else is workflow scaffolding around those five.

What the dashboard genuinely optimizes:
- **Visibility** of state across those units — high value
- **Coordination** between them — high value
- **Reducing duplicate field work** (piggyback) — small absolute number now, valuable at scale

What it does *not* yet do, and should:
- **Generate the plan.** You still type 44 post ideas every month. Pillar mix, quotas, and holiday alignment are all in the system. Plan generation is a solver problem, not a creative one. Christian's job should be to *edit* a draft, not author one.
- **Reflect reality.** When Trey shoots, the system should know without him typing. Drop a file in `Shoot 2 - photos`, the system ingests, links, advances status. Asset URL is the right pattern; the next step is automated reconciliation.
- **Close the loop.** Pipeline ends at Posted. Engagement data never returns. So strategy is improvised every month from intuition.

The wrong question: "What automations should we add?" The right question: **"What human work in the loop is lowest-leverage and most automatable?"** Answer in priority order: status updates (asset reconciliation), plan generation, performance feedback. Build those three. Ignore everything else.

### The Expansionist

You're treating this like a tool. It's a category.

What you've built is a **content operations system** specialized for shoots-driven social production. There are 200+ marketing agencies in NWA alone — in-house brand teams, restaurant groups, regional retail — running this exact workflow in spreadsheets. Six months from now this is a SaaS. Twelve months from now, it's a moat.

But ignore the SaaS angle for a minute. Inside Pulse, here's the upside:

1. **Sales tool.** Live dashboard in pitches: "This is how we run your social." Nobody else in NWA does this. Closes deals against generic agencies.
2. **Productized client tier.** Sell a client seat (read-only) so they see their pipeline live. End monthly status meetings.
3. **AI strategy layer.** You have *structured* data — pillars, quotas, content type, captions, performance. Plug an LLM into "generate next month from last month + holidays + remaining quota gaps." Christian goes 10× throughput.
4. **Route optimization for Trey.** Dates + locations + shoot durations + travel times = an actual day planner. "Start ranch 7am, Tusk + Trotter 11am, OAK 2pm, knock out three shoots and capture Pulse BTS in two." This is gold for a small crew.
5. **Coverage marketplace.** When Pulse is in NWA for ONSC, offer "extra capture slots" to other Pulse clients on demand. Idle capacity becomes revenue.
6. **Deliverable invoicing.** The system already knows what was promised vs. delivered per month. Wire it to billing. The dashboard isn't just operations — it's the source of truth for what each client paid for.

Stop calling this a tool. It's the operating system of an agency that runs on data.

### The Outsider

I'm going to admit upfront I have no idea what most of this is. Five honest reactions from someone clicking through cold:

1. **"Pulse"** appears twice in the header — once as the app name, once as a client. Same thing? Different thing? Who is this for?
2. **"Shoot 1"** — what is that? A photoshoot, a video shoot, both? Why is the first one of the month called "Shoot 1" and not "ONSC Ranch Day, May 11"? The numbering reads like a database row, not a thing humans say.
3. **Six pipeline stages.** "Approved" by whom? "Scheduled" on what — a calendar, the social network, this app? When does "Edited" happen? I shouldn't have to guess.
4. **The hub homepage has five major sections** stacked vertically. Hero, pipeline, field schedule, Pulse house, attention, per-client. What am I supposed to look at first? What's the headline number that tells me the agency is winning today?
5. **Where does posting actually happen?** I see planning, I see capture, I never see "publish." Does this thing post to Instagram? Or do I copy-paste into Meta Business Suite? If yes — say so. If no — say that too.

Two roles need a clean answer to "what do I do today?" — Trey opens it on his phone in a parking lot; Christian opens it Monday morning. Neither has time to learn vocabulary. **The homepage should answer the role-specific "today" question in under three seconds.** Right now it answers "the state of everything," which is impressive and exhausting.

### The Executor

Stop building. Use what's there for one month. May 2026.

Monday morning move:

1. **Pick one adoption metric.** Mine: every May 2026 post must reach status ≥ Captured by 6pm Friday of its scheduled week. One number. Track it. Friday 6pm screenshot of the pipeline strip, drop it in Slack. If the number climbs above 80% by month-end, the dashboard works. If it doesn't, no new feature fixes that — the dashboard is wrong, not the world.
2. **Run one ride-along this month.** Schedule a real Pulse shoot piggybacked on a real ONSC shoot. See if anyone uses the picker on Planning. If they don't, the feature is theater and you delete it.
3. **Ship one automation, this week:** a Vercel cron / Supabase scheduled function that posts to Slack every weekday at 8am: "Today's shoots [list]. Today's posts going live [list]. Stuck items [list]. Open hub →." 200 lines of code. The dashboard is a pull surface. Slack is push. Push wins for adoption every time.

That's it. Three things. Don't add features for 30 days. Re-evaluate May 31. If status updates are happening, ship the second automation: a Drive folder watcher that auto-flips post status to Captured when files land. If status isn't happening, the dashboard is wrong about the team's actual workflow and you need to redesign, not extend.

The trap is to keep building. The win is to *use it*, find what's actually broken (not what's theoretically missing), and fix that. Repeat.

---

## Step 3 — Peer Review

**Anonymization map** (random):
- **A** = Executor
- **B** = Contrarian
- **C** = First Principles Thinker
- **D** = Outsider
- **E** = Expansionist

### Reviewer 1
1. **Strongest: A.** Only response with a falsifiable test in 30 days. Everything else is opinion shaped as advice; A is a plan with a measurable cutoff date.
2. **Biggest blind spot: E.** Assumes a market exists for an NWA agency to ship SaaS. Building software is one thing — productizing, supporting, and selling to other agencies is an entirely different company. "Sitting on a moat" without examining whether anyone's actually buying is wishful.
3. **What ALL missed:** the *client* doesn't appear anywhere in the dashboard. The whole system is internal-facing. There's no client-status email, no portal showing "here's what Pulse delivered against your contract this month." The agency's deliverable is invisible to the people who pay the bills.

### Reviewer 2
1. **Strongest: C.** Reframing "what automations" → "what human work is lowest-leverage" is the move that unblocks roadmap thinking. Without that reframe, you build features by intuition.
2. **Biggest blind spot: B.** Dismisses the dashboard's value too quickly. "You only have 2 clients" cuts both ways: yes the optimization is small now, but the *cost* of not having a system when the agency grows from 2 to 5 clients is the moment when spreadsheets collapse and chaos lands. The dashboard is insurance.
3. **What ALL missed:** the people problem. Trey's adoption is the actual variable. None of the responses discussed change management — how do you get a small team to use a new tool when their current workflow (Drive + group chat) is already in muscle memory?

### Reviewer 3
1. **Strongest: D.** The outsider's questions are the actual UX issues. If a new hire can't orient in 5 minutes, the system fails the moment the team grows. "Pulse vs Pulse" being ambiguous is a real, unfixed problem.
2. **Biggest blind spot: A.** Tracking "≥ Captured by Friday" is fine but it's a behavioral nudge, not a fix. If the underlying friction is structural — hard to update on mobile, requires too many clicks — no amount of Friday screenshots solves it.
3. **What ALL missed:** cost. Vercel + Supabase are free at this scale; every automation, AI feature, and integration adds operational cost in money *and* attention. None of the advisors quantified ROI for any proposed feature.

### Reviewer 4
1. **Strongest: E.** The route optimizer for Trey is concrete AND uniquely possible because the system already has dates, locations, and durations. Most expansionist advice is hand-wavy; this one ships with what's already in the database.
2. **Biggest blind spot: D.** "Pulse vs Pulse" confusion is real but conflates audiences. Internal team knows. New hires don't. Fix is documentation, not redesign — D inflates a small problem.
3. **What ALL missed:** feedback loops. Pipeline ends at Posted. Nothing returns from "the post got 3,200 likes" into "do more of this pillar." Without performance data, every month's strategy is improvised. Bigger than any single feature on the table.

### Reviewer 5
1. **Strongest: B.** The Contrarian's question — *"what does this eliminate?"* — is the most useful diagnostic in the room. Every other advisor talks about adding; only B asks about subtracting.
2. **Biggest blind spot: C.** Intellectually clean but lacks urgency. "Automate status updates, plan generation, asset reconciliation in that order" is correct and unactionable without dates, capacity, and ROI sizing.
3. **What ALL missed:** the brand-as-product angle. Pulse Community Agency is now literally on its own dashboard. That's not a quirk — it's an opportunity. Pulse's house content probably feeds the agency's own marketing site, sales material, social. The dashboard could be the operating system for Pulse-as-marketing-engine, not just for client work. Nobody named this.

---

## Step 4 — Chairman Synthesis

### Where the Council Agrees

- **The visibility and coordination layer is solid.** The dashboard is well-built for showing state across people and clients. Nobody disputed this.
- **The next leverage is automation, not features.** Status updates and asset reconciliation are the highest-ROI moves. Three advisors named this independently.
- **Adoption — specifically Trey's — is the actual constraint.** Three reviewers flagged that the underlying tech is sound but the human workflow is the variable.
- **Push beats pull for a small team.** The dashboard is excellent as a reference surface; it's not where the work *starts*. Slack/email/calendar entries that link back are.

### Where the Council Clashes

- **Build vs. use.** The Executor wants a 30-day moratorium on features. The Expansionist says the moat is closing and you should build aggressively. Real tension. Both have evidence: Executor points to adoption risk; Expansionist points to category opportunity.
- **Scope.** The Contrarian says you over-engineered for an agency you don't have. The Expansionist says you under-imagine what you've built. The truth is probably that *for today's agency* the Contrarian is right, but *for the agency you want in 12 months* the Expansionist is right.
- **Where to point the next month of effort.** Contrarian: question whether the system is adding value. First Principles: redirect engineering to automate the loop. Executor: ship a Slack push and use it. Outsider: stop building, fix the UX. Different first moves.

### Blind Spots the Council Caught (only via peer review)

- **No client-facing surface.** The entire system is internal. Clients have no view of "what did Pulse deliver this month vs. the contract." (Reviewer 1)
- **No performance feedback loop.** Pipeline dies at Posted. Engagement data never returns to inform strategy. (Reviewer 4)
- **No change-management plan for adoption.** Tool quality and team adoption are independent variables; nobody has a plan for the second one. (Reviewer 2)
- **No ROI sizing on proposed features.** Every advisor proposed work; nobody quantified payoff. (Reviewer 3)
- **Pulse-as-marketing-engine is bigger than acknowledged.** House content treatment is a strategic move, not a quirk. (Reviewer 5)

### The Recommendation

The Chairman sides with the **Executor** for the next 30 days, the **First Principles Thinker** for the 30–90 day horizon, and **rejects the Expansionist's SaaS pitch** — not because it's wrong, but because pursuing it would destroy focus on the agency you actually run.

Concretely:

- **Days 1–30: Use the system in earnest for May 2026.** Ship one automation only — a daily 8am Slack push of "today's shoots, today's posts going live, today's stuck items." Track one metric: % of May posts at status ≥ Captured by their scheduled week. Don't build anything else.
- **Day 30 review:** if status updates are happening, the dashboard is working — proceed to automation. If they aren't, the dashboard is wrong, not the world. Redesign the touch surface (mobile-first capture, fewer clicks) before adding features.
- **Days 31–90 (assuming adoption):** three automations in priority order:
  1. **Drive folder watcher** that auto-flips post status to Captured when files land in `Shoot N` folders. Eliminates the manual click that's killing the pipeline. *(First Principles' "reflect reality.")*
  2. **AI plan-draft generator** that writes 40–50 post ideas for next month from pillars + quotas + holidays + last month's gaps. Christian edits, doesn't author. *(First Principles' "generate the plan.")*
  3. **Performance ingestion** — manual at first, automated later — that pulls engagement back into the pipeline. Closes the loop. *(Reviewer 4's blind spot.)*
- **Days 91+:** add the client-facing read-only portal *(Reviewer 1's blind spot)*. One URL per client showing this-month-vs.-contract. Productizes the dashboard without leaving Pulse.

**Resist the SaaS path.** The moat is real but pursuing it now means hiring, support, sales — a different company. Stay an agency that happens to run on great software.

### The One Thing to Do First

**Ship the daily 8am Slack push this week. Nothing else.**

200 lines of code. A Vercel cron or Supabase scheduled function that pings Slack with three lists: today's shoots, today's posts going live, today's stuck items. Each item links into the hub.

This forces the dashboard into the team's existing workflow (Slack), not the other way around. Within 30 days you'll know whether this thing is being used — because if Slack messages stop getting opened, neither is the dashboard, and you've learned something more valuable than any feature you could have built instead.

---

*Pulse Community Agency · LLM Council · 2026-04-27 · Council convened by Christian*
