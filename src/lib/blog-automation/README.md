# Blog automation

Every 3 days a Vercel Cron picks the next pending entry from the content calendar, asks Claude to write a 1,400–1,800-word draft, picks a cover image from the Traverse Google Drive folder, opens a PR on GitHub, and emails Nadim an approval link from `marketing@traversehospitality.com`. One click in the email merges the PR and publishes the post. Replying to the email with edit notes triggers a revision pass.

> **Source of truth for brand voice / strategy:** [`docs/blog-automation/websiteblog.md`](../../../docs/blog-automation/websiteblog.md). The text the cron actually feeds to Claude is a distilled subset in `brand.ts`. If you change `websiteblog.md`, mirror the relevant changes into `brand.ts`.

## How it fits together

```
vercel.json                         (cron: 0 15 */3 * *)
        │
        ▼
src/app/api/cron/blog-publish/route.ts       (Bearer CRON_SECRET)
        │
        ├─► calendar.ts        pickNextDue → entry
        ├─► generate.ts        Claude + validator, ≤2 attempts
        ├─► image-picker.ts    Drive → market subfolder → Claude picks file → base64
        ├─► github.ts          branch + content.ts + image binary + posts.ts row + PR
        └─► email.ts           Composio Gmail send to BLOG_REVIEWER_EMAIL
                ▲                       │
                │                       └── [Approve & Publish] (signed link)
                │                                  │
                │                                  ▼
                │                       src/app/api/blog/approve/route.ts
                │                                  │
                │                                  └── github.ts mergePullRequest()
                │                                         → Vercel redeploys → live
                │
                └── Reply with edits  (subject still has "[Draft] <slug>")
                                │
                                ▼
                vercel.json    (cron: */5 * * * *)
                                │
                                ▼
            src/app/api/cron/blog-edit-replies/route.ts
                                │
                                ├─► composio.ts        GMAIL_FETCH_EMAILS query
                                ├─► generate.ts        revisePost(currentHtml, edits)
                                ├─► github.ts          updateDraftContent (force-push)
                                └─► email.ts           re-send draft email (v2)
```

## Required env vars (Vercel production)

| Var | Purpose | Status |
|---|---|---|
| `CRON_SECRET` | Bearer auth for cron endpoints | ✅ already set |
| `ANTHROPIC_API_KEY` | Claude generation + image picking + revisions | ⚠️ add before first run |
| `GITHUB_TOKEN` | Fine-grained PAT, Contents+Pull-Requests **write** on `lebcwby/traverse-booking` | ❌ add |
| `GITHUB_OWNER` | `lebcwby` | ❌ add |
| `GITHUB_REPO` | `traverse-booking` | ❌ add |
| `GITHUB_BASE_BRANCH` | Optional, defaults to `main` | optional |
| `COMPOSIO_API_KEY` | Drive + Gmail OAuth via Composio | ❌ add |
| `BLOG_APPROVAL_SECRET` | HMAC secret for signed approve-link tokens. **Min 32 chars.** | ❌ add |
| `BLOG_REVIEWER_EMAIL` | Recipient of draft emails. Defaults to `ngtannous@gmail.com` | optional |
| `DRIVE_BLOG_IMAGES_FOLDER_ID` | Drive root folder ID. Defaults to the known Traverse folder. | optional |
| `RESEND_API_KEY` | Fallback alert email when Gmail send fails | optional but recommended |

GitHub PAT: generate at https://github.com/settings/personal-access-tokens — scoped to `lebcwby/traverse-booking`, permissions **Contents: Read & write**, **Pull requests: Read & write**, **Metadata: Read**.

`BLOG_APPROVAL_SECRET`: generate locally with `openssl rand -hex 32`.

## One-time Composio setup

The image-picker and email modules talk to Drive and Gmail through Composio. You need to link each account once.

```bash
# 1. Install the Composio CLI globally
npm install -g composio-core

# 2. Authenticate the CLI with your Composio account
composio login        # opens browser, uses your COMPOSIO_API_KEY

# 3. Link Gmail for marketing@traversehospitality.com
composio add gmail
# → browser opens — sign in as marketing@traversehospitality.com

# 4. Link Google Drive
composio add googledrive
# → browser opens — sign in as whichever Google account owns folder
#   1NYFL4yN1t_BtoYi8Sh7VGxMdG_AqmmjM (the Traverse blog-images folder)
```

Both connections are scoped to `userId="default"` (the Composio CLI default), which is what `src/lib/blog-automation/composio.ts` uses.

To verify the connection works locally:

```bash
# Dry-run shows what the cron would generate, including the picked image.
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/blog-publish?slug=what-to-pack-colorado-mountain-trip&dryRun=1"
```

## Adding a post to the calendar

Edit `src/lib/blog-automation/calendar.ts`:

```ts
{
  slug: "your-post-slug",
  publishDate: "2026-06-12",
  title: "Your Post Title",
  primaryKeyword: "your primary keyword",
  secondaryKeywords: ["secondary one", "secondary two"],
  pillar: "destination",
  market: "crested-butte",
  category: "Crested Butte",
  brief: "One paragraph telling Claude what the post should cover, key facts to include, what to avoid.",
  status: "pending",
}
```

The cron always picks the **earliest pending entry whose `publishDate` is on or before today**. Slip a publishDate to push a post to a later cycle.

## The approval flow

1. Cron runs → opens PR → emails you. The email has three buttons:
   - **Approve & Publish** — signed link to `/api/blog/approve?token=…`. One click merges the PR. Token is HMAC-signed and expires in 30 days.
   - **Request edits** — a `mailto:` link that opens a reply pre-filled to `marketing@traversehospitality.com` with `Re: [Draft] <slug>` in the subject.
   - **View PR** — link to the GitHub PR if you want to inspect the diff manually.
2. If you reply with edits, the `*/5 * * * *` reply-watcher cron picks up the unread message, asks Claude to revise the draft using your edits, force-pushes to the same PR branch, and emails you v2 with fresh approve/edit buttons.
3. If you approve, the route merges the PR (squash), sends a "Published" confirmation email, and Vercel redeploys.

**Important:** to keep the reply-watcher working, **keep the `[Draft]` tag and slug in the subject line when you reply.** That's how the watcher knows which post to revise. The `mailto:` link pre-fills this for you; if you reply manually from your phone, hit "Reply" rather than starting a new thread.

## Marking a post done

The cron infers status from PR state — once a PR for a slug is merged, the calendar entry is effectively done. The `status: "pending"` field still controls what's eligible to draft, so for safety, flip it to `"done"` once the post is live to remove it from future picks.

## Testing locally

```bash
# Dry-run the full pipeline including image picker + email rendering, no PR.
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/blog-publish?slug=what-to-pack-colorado-mountain-trip&dryRun=1"

# Full run on a specific calendar entry — opens a real PR + sends a real email:
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/blog-publish?slug=what-to-pack-colorado-mountain-trip"

# Dry-run the reply watcher — shows which unread Gmail messages it would process.
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/blog-edit-replies?dryRun=1"

# Actually process replies:
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/blog-edit-replies"
```

## Manually seeding an existing .md file

`scripts/seed-blog-post.ts` converts a hand-written .md file into the file-based blog format without going through Claude. Useful for migrating draft .md files written elsewhere.

```bash
npx tsx scripts/seed-blog-post.ts ~/Downloads/your-post.md
```

The .md frontmatter must include `slug:` matching a calendar entry. The wildflower post was seeded this way.

## What the validator catches

After Claude returns a draft, `validateDraft` (in `brand.ts`) checks:

- Banned words present (the 25 banned words from the handoff doc)
- Banned openers in the first 200 chars
- Primary keyword present somewhere in the body
- Word count outside 1,300–2,000
- Missing FAQ section

If any issue is found, Claude is given one retry with the issues as feedback. If the second attempt still fails, the PR is opened anyway but the issues are listed in the email + PR body so the reviewer can decide.

## Image picking

`image-picker.ts` walks the Drive folder set by `DRIVE_BLOG_IMAGES_FOLDER_ID` (default: the Traverse folder). The folder is organized by market and property nickname. The picker:

1. Lists subfolders in the root.
2. Asks Claude (Haiku — cheap + fast) which subfolder name best matches the post's market + brief.
3. Lists images in that subfolder. If the subfolder itself contains sub-subfolders (per-property), recurses one level deeper.
4. Asks Claude which file name is the best cover candidate.
5. Downloads the file via Composio Drive and returns it base64-encoded.

The file is committed into the PR at `public/blog/<slug>.<ext>` and the new row in `posts.ts` references `/blog/<slug>.<ext>`. If anything fails (folder unreachable, no images, Claude pick fails), the PR is still opened but with an empty `image: ""` and the email surfaces a warning that you should pick one manually.

## Things this does NOT do

- **Web research** — The cron runs without web search. Facts come from `brand.ts` (long-lived) and the per-post `brief` field. For research-heavy posts (best restaurants, current events), put verified facts in the brief.
- **Image alt text** — Cover images use a generic alt. Update inline if needed.
- **Automatic publish without approval** — All posts require a human click on the Approve link.
- **Auto-detect when you've already seen a draft email** — replying to a draft email triggers a revision unconditionally; the `Approve & Publish` link is the only way to "accept as-is."

## Cron schedule

| Cron | Schedule | Frequency |
|---|---|---|
| `/api/cron/blog-publish` | `0 15 */3 * *` | Every 3 days at 15:00 UTC (8:00 AM MT) |
| `/api/cron/blog-edit-replies` | `*/5 * * * *` | Every 5 minutes |

Vercel Cron only fires on production deployments — staging won't run them.
