# Measuring AI / GEO performance (GA4 + monthly audit)

How to tell whether the GEO work is moving the needle. Two parts: an automated
GA4 "AI Search" channel (passive, captures referred traffic) and a monthly
manual prompt audit (active, captures visibility even when no click happens).

GA4 property: **G-8NK72KVMJJ** (canonical "Book Traverse" property).

---

## 1. GA4 — custom "AI Search" channel (10 min, one-time)

AI assistants that pass a referrer (ChatGPT with a link, Perplexity, Copilot,
Gemini, etc.) currently get scattered into "Referral" or "Organic Search." This
isolates them.

**Steps:**
1. GA4 → **Admin** (gear, bottom-left) → Property column → **Data display → Channel groups**.
2. **Create new channel group** → name it e.g. `Traverse (AI-aware)`.
3. **Add a new channel** at the TOP → name it **`AI Search`**.
4. Define it by a single condition:
   - Dimension: **Source**
   - Match type: **matches regex**
   - Value:
     ```
     chatgpt|chat\.openai|openai\.com|perplexity|gemini\.google|bard\.google|copilot|claude\.ai|you\.com|edgeservices\.bing|bingchat|brave.*leo
     ```
5. **Drag the `AI Search` channel ABOVE** "Organic Search" and "Referral" (order
   matters — first match wins, and Gemini/Bing would otherwise fall into those).
6. Save. In any report, switch the channel-group dropdown to `Traverse (AI-aware)`,
   or in Explore use the dimension **Session custom channel group**.

**Caveats (set expectations):**
- Custom channel groups apply going forward and reprocess in Explore, but not
  all historical reports.
- **Free ChatGPT often passes no referrer**, so GA4 "AI Search" sessions are a
  *floor*, not the full picture — which is why the manual audit below matters.

**Optional GA4 dashboard:** build an Exploration with Session custom channel
group = "AI Search" → metrics: Sessions, Engaged sessions, Conversions
(begin_checkout / purchase), so you can see AI-referred conversion vs. other
channels (the playbook cites 10–16% AI-referral conversion vs ~1.8% organic).

---

## 2. Monthly manual prompt audit

Run this prompt set across **ChatGPT, Perplexity, Google (watch for AI Overview),
and Gemini** once a month. This is the real GEO scoreboard.

**Prompt library:**
1. Best property management companies in Crested Butte
2. Who should manage my Airbnb in Crested Butte?
3. Crested Butte short-term rental management companies
4. Best vacation rental manager near Crested Butte Colorado
5. How do I find a property manager for my ski cabin in Crested Butte?
6. Crested Butte vs self-managing my vacation rental
7. Top-rated STR management in Colorado mountain towns
8. Where should I stay in Crested Butte? *(guest-side)*
9. Best vacation rentals in Crested Butte *(guest-side)*
10. Where to stay in Leadville Colorado *(guest-side)*
11. Vacation rentals in Leadville Colorado
12. Property management companies in Leadville Colorado
13. Best Grand Lodge Crested Butte rentals
14. How much do property managers charge in Crested Butte?

**Log each run** (copy this table into a Google Sheet, one row per prompt×platform):

| Date | Platform | Prompt | Traverse mentioned? (Y/N) | Cited/linked to booktraverse.com? (Y/N) | Position (1st/2nd/3rd+) | Sentiment | Competitors named |
|------|----------|--------|---------------------------|-----------------------------------------|-------------------------|-----------|-------------------|

**KPIs to report monthly:**
1. **AI Visibility Rate** — % of prompts where Traverse appears (target 30%+ within 6 months)
2. **Citation Rate** — % where the answer links to booktraverse.com
3. **Share of Voice** — Traverse mentions vs. Peak / CB Lodging / PR Property / CB Property Management
4. **AI Referral Traffic** — GA4 "AI Search" sessions + conversions

Optional tooling (when ready): **OtterlyAI Lite (~$29/mo)** automates the prompt
tracking; **HubSpot AI Search Grader (free)** for a quarterly baseline.

---

Baseline reality (June 2026): Traverse was effectively invisible for the
non-brand CB/Leadville prompts. Re-run this after the directory/profile claims
+ Wikidata land, and again at the 3- and 6-month marks.
