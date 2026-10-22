# Setup

This repo is code only — a few accounts/keys only you can create are needed to actually run it.

## 1. Supabase project (database + auth + the extraction function)

1. Create a free project at https://supabase.com.
2. In **Project Settings → API**, copy the Project URL and anon public key.
3. Copy `frontend/.env.example` to `frontend/.env` and fill those two values in.
4. Install the Supabase CLI (`npm install -g supabase`), then from the repo root:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This creates the `categories` and `recipes` tables with row-level security.
5. In **Authentication → Providers**, email sign-up is on by default — that's all you need for the sign-up/sign-in screens. (For testing, you can turn off "Confirm email" under Authentication → Settings so new accounts don't need to click an email link.)

## 2. Supadata API key (free, for fetching the video's transcript)

YouTube blocks its own unofficial transcript endpoint for requests coming from cloud/server IPs (confirmed while building this — it's a real, current restriction, not a hypothetical one), so a hosted transcript API is used instead.

1. Create a free account at https://supadata.ai (100 transcript requests/month, renews monthly, no card required).
2. Copy your API key from the dashboard.
3. Set it as a secret on your Supabase project:
   ```bash
   supabase secrets set SUPADATA_API_KEY=your-key-here
   ```

## 3. Groq API key (free, for the transcript → recipe step)

1. Create a free key at https://console.groq.com/keys.
2. Set it as a secret on your Supabase project:
   ```bash
   supabase secrets set GROQ_API_KEY=your-key-here
   ```
3. Deploy the extraction function:
   ```bash
   supabase functions deploy extract-recipe
   ```
   (Groq's available free models change over time — the function currently uses `openai/gpt-oss-120b`. If it ever errors with "model not found," check `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"` for current options.)

## 4. Run it locally

```bash
cd frontend
npm install
npm run dev
```

The PWA share-target/install features only work over HTTPS on a real deployed URL (see below) — localhost is fine for everything else (sign up, add-from-URL, browsing).

## 5. Deploy the frontend (Vercel)

1. Push this repo to GitHub.
2. Import it into https://vercel.com, set the **root directory** to `frontend`.
3. Add the two `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` environment variables in Vercel's project settings.
4. Deploy. You'll get an HTTPS URL like `recetario.vercel.app`.

## 6. Install on Android and test the share flow

1. On an Android phone, open your deployed URL in Chrome.
2. Chrome should offer "Add to Home screen" / "Install app" — install it.
3. Open the YouTube app, open a recipe video, tap **Share**, and your app ("Recetario") should now appear in the share sheet.
4. Tapping it opens the app straight to the review screen with the extracted recipe.

## Known limitations

- Videos with no captions/transcript can't be converted (you'll see an error) — there's no audio-transcription fallback in this build. (Supadata can also AI-generate a transcript from audio for videos with no captions, at a higher credit cost — not enabled here by default since `mode=auto` already tries that as a fallback.)
- The free Supadata tier is capped at 100 transcript requests/month. Fine for personal use, but if you hit the cap you'll see save attempts fail with a transcript error until it resets.
- Groq's lineup of free models changes over time; `openai/gpt-oss-120b` is what's wired up today.
- **Recipe websites**: the app first looks for the site's own schema.org "Recipe" structured data (which almost all recipe blogs/sites embed for Google search), falling back to scraping the page's visible text through the same AI step as videos if that's missing. Some sites block automated requests outright (confirmed during testing — one popular recipe blog returned an HTTP 403) and there's no workaround for that short of a paid scraping-proxy service; you'll see a clear error for those rather than a bad result.
- **Cooking Mode** uses the standard Wake Lock API, supported on Android Chrome and modern desktop browsers, not supported on older browsers (the toggle just disables itself there) — it couldn't be tested against a real device in this build process, only verified as implemented correctly.
- Scaling only multiplies ingredient quantities; step instructions (e.g. "cook in batches," pan sizes) aren't rewritten for the new batch size.
