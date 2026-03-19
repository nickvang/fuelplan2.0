# Testing checklist before publishing

Use this to verify all scenarios and the new UI before you publish.

---

## 1. Build & lint (quick sanity check)

```bash
npm run build
npm run lint
```

- Fix any build or lint errors before continuing.

---

## 2. Automated logic & QA pages

These run in the browser. Start the app with `npm run dev`, then open the URLs.

| Page | URL | What it does |
|------|-----|--------------|
| **QA Test** | http://localhost:5173/qa-test | Runs many calculator scenarios (disciplines, durations, sweat, race day, etc.) and shows OK / WARNING / ERROR. Re-run after any calculator changes. |
| **Logic verification** | http://localhost:5173/logic-check | Checks a few fixed scenarios (marathon, half, Ironman, 10K, bike, 2.5h run) against expected sachet/water logic. |
| **QA Analysis** | http://localhost:5173/qa-analysis | Analysis view of QA results (if you use it). |

**Before publish:**  
- Open `/qa-test` and run tests; aim for no unexpected ERRORs.  
- Open `/logic-check` and confirm all scenarios pass (green).

---

## 3. Manual flows on the main app

Base URL: http://localhost:5173/

### 3.1 Quick (simple) path

1. Step 0: Choose **Quick**, accept consent, click **Start**.
2. Step 1: Pick **Run** (or Swim/Bike/Triathlon), then terrain.
3. Enter duration (e.g. 2 hours).
4. Complete to see plan.
5. **Check:** Guide card shows “— • 2:00:00” (or distance if you entered one). “Your protocol” shows Pre / During / Post with When + Tip. No Race Day section (no race).

### 3.2 Pro path – full questionnaire

1. Step 0: Choose **Pro**, accept consent, **Start**.
2. Go through all steps (Activity, Body, Environment, Sweat, Nutrition).
3. **Check:** Plan shows; “Your profile analysis” accordion loads (spinner then content or basic fallback).

### 3.3 Dev bypass buttons (Step 0, Developer Tools)

Only visible in dev. Use them to jump straight to a full plan and test UI.

| Button | Scenario | What to check |
|--------|----------|----------------|
| **Bypass to Marathon Results** | Running, Marathon, 4h, race | Guide card “42.2 km • 4:00:00”. Your protocol: Pre/During/Post. **Race Day Protocol** section present with Day Before, Race Morning, During, Recovery and quick-jump nav. |
| **Bypass to Triathlon Ironman** | Triathlon, Ironman, long duration | Triathlon-specific logic; during sachets for bike/run only; no during card for “Swimming” race. |
| **Bypass to Swim 2km** | Swimming, 2km | Swimming-specific plan; if race, no “During” in Race Day (swim-only). |
| **Bypass to Bike 100km** | Cycling, 100km | Bike plan; full During card. |

---

## 4. Scenarios to test explicitly

### 4.1 Guide card (above “Your protocol”)

- **With race:** Shows “42.2 km • 4:00:00” and “Running · Marathon” (or correct discipline/race).
- **No race:** Shows “— • H:MM:SS”.
- **Look:** Dark card, bold white numbers, clear “This guide is for” label.

### 4.2 Your protocol (merged Pre / During / Post)

- **PRE:** Water ml + sachets (green), “When: …”, “Tip: …” with lightning icon.
- **DURING:** Dark inverted card; total water, sachets per hour or total; “Water: …” and “Sachets: …”; Tip.
- **POST:** Same structure; “When: …”, “Tip: …”.
- **Footer:** “Est. fluid loss X.X L · H:MM:SS session”.
- **Swimming + race:** During card is hidden in “Your protocol” (only Pre and Post).

### 4.3 Race Day Protocol (only if “training for a race”)

- **Header:** “Race Day Protocol” and pill nav (Day Before, Race Morning, During, Recovery).
- **Sections:** Day Before, Race Morning, During Race (dark card, readable text), Recovery.
- **Each block:** “When: …” and “Tip: …” at bottom.
- **Quick-jump:** Clicking a pill scrolls to that section.
- **Swimming race:** “During” pill and “During Race” section hidden.

### 4.4 Profile Analysis (Pro only)

- **Loading:** Spinner in header; “Analyzing…” / “Fetching AI insights…”; content area shows skeleton + “AI is generating personalized insights…”.
- **Loaded:** Accordion opens to show profile analysis content (or graceful fallback if API fails).

### 4.5 Language (Danish)

- Switch language to Danish on step 0 (or where the switcher is).
- **Check:** Questionnaire steps, labels, placeholders, and “Your protocol” / Race Day copy use Danish where you added translations (no raw English in those strings).

### 4.6 Mobile vs desktop

- **Narrow width:** Guide card and “Your protocol” stack vertically; Race Day sections stack; text remains readable (no tiny grey text).
- **During Race card:** Stays dark with good contrast (no unreadable labels).

---

## 5. Short pre-publish checklist

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `/qa-test`: run tests; no new ERRORs.
- [ ] `/logic-check`: all scenarios pass.
- [ ] Quick path: complete flow and see plan + guide card.
- [ ] Pro path: complete flow; Profile Analysis loads (or shows loading then fallback).
- [ ] Bypass **Marathon**: guide card, Your protocol, Race Day with nav and When/Tip everywhere.
- [ ] Bypass **Triathlon Ironman**: triathlon logic and Race Day (no During for swim).
- [ ] Bypass **Swim 2km** and **Bike 100km**: correct discipline and layout.
- [ ] Danish: key UI translated.
- [ ] Mobile: layout stacks; During Race card readable.
- [ ] Logo: SUPPLME(r)hvid.svg shows where expected.

When all of the above pass, you’re in a good state to publish the update.
