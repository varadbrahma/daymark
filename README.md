# Daymark

**A thoughtful planner for study, focus and everyday life.**

Daymark combines a flexible daily planner and diary with goals, projects, wellbeing routines, habit reviews, and a gentle Pomodoro study timer. It is designed for different routines and life stages without assuming a particular job, school, location, identity, or ambition.

## Try it

- **Run it locally:** serve this folder from a local web server and open its URL. For example, `python -m http.server 8765` from this folder, then visit `http://127.0.0.1:8765/`.
- **Publish it:** GitHub Pages can serve the static files directly; no build step or package manager is required.
- **Install it:** serve the app over HTTPS or localhost, open it in a supported browser, and choose **Install app** when offered. For local PWA testing, use localhost rather than `file://`.

Without backend configuration Daymark works in local-only mode: planner data stays in this browser's IndexedDB, backups can be exported or restored, and the focus timer works without an account. There are no ads, trackers, or device-control permissions.

## Features

- Responsive daily, weekly, and monthly planning; a personal diary; goals and roadmap; projects and tasks; wellbeing routines; and flexible habit reviews.
- Accessible Pomodoro timer with selectable focus lengths, pause/resume/end controls, a five-minute break, optional fixed-choice before/after check-ins, and a local-only focus-task prompt.
- Focus history saved with planner data; task text from the focus prompt is never saved or synced.
- Automatic IndexedDB saving, backward-compatible migration from the earlier local-storage version, and JSON backup export/restore.
- Optional account sync to a user-configured Supabase project. Sync uses account-owned records and row-level access policies; simultaneous edits are surfaced for an explicit choice.
- Light and dark themes, installable PWA shell, offline app files, and print-friendly A4 layouts.

## Optional account sync setup

This copy is configured with the supplied Supabase project URL and publishable key in `config.js`. The publishable key is intended for browser use; never put a `service_role` or secret key in the app. Database row-level security must remain enabled.

1. In the Supabase dashboard for this project, apply `supabase/migrations/20261101000000_daymark_sync.sql` using the SQL editor or Supabase CLI.
2. Set the Supabase Authentication **Site URL** and allowed redirect URLs to the deployed Daymark origin. Add localhost URLs for local testing if needed; configure email confirmation as appropriate for the audience.
3. If you rotate the project's public credentials, update `config.js` with the project URL and the **publishable key** (or legacy `anon` key) from **Project Settings → API Keys**. This file is public static configuration, not a place for secrets; never use a `service_role` or secret key here.
4. Publish/reload the app. In **Preferences → Optional account sync**, create an account or sign in, review and check the disclosure, then sync. Users must explicitly accept the disclosure before any planner data is sent.

The database migration enables row-level security and allows an authenticated user to read or change only records whose `user_id` matches `auth.uid()`. It grants no access to anonymous users and does not grant record deletion; deletions are retained as per-account tombstones so they can sync safely. Run the ownership regression test with `supabase test db` in a configured Supabase CLI project. The app code never contains or asks for a service-role secret.

The first successful sync binds that browser's local planner to one account. **Turn off sync** withdraws consent and stops scheduling new uploads; **Sign out** also withdraws consent and preserves local records. A request already sent may finish. Signing out does not remove the account binding, and signing into a different account in that browser is blocked to prevent one person's local diary from being uploaded to another person's account. Use a separate browser profile or device for another account. To start over, export a backup before clearing Daymark's site data. Sync baselines and auth state are kept in the current browser profile; protect access to that profile and sign out on shared devices.

Account sync uploads all saved planner values, including diary text and personal notes, over HTTPS to the configured Supabase project and stores them under the signed-in account. Sync is not end-to-end encrypted. Do not enable it unless you trust the project owner and their hosting/security practices. Conflicting edits to the same planner item are not silently replaced: Daymark asks whether to keep the current device or account version. Other-device records and unrelated local edits are merged. Export backups regularly even when sync is enabled.

The Pomodoro timer runs in the browser and cannot block other apps or websites. It does not request operating-system/device-control permissions. Use your device's built-in focus tools separately if you want app blocking.

## Publish with GitHub Pages

1. Add the project files to a repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder, then save.
5. Open the Pages URL GitHub provides.

If enabling sync, complete the setup above before deployment and configure the Supabase redirect URLs for the exact published origin.

## Privacy and backups

In local-only mode, planner records are saved in IndexedDB in the browser profile where Daymark is open. The app does not send planner content anywhere. Once the user opts in to account sync and signs in, saved planner and diary records are sent to the configured Supabase backend; static site hosting alone never receives those records. The public Supabase URL/key identifies the configured backend but is not a secret. The browser also keeps account tokens and sync conflict baselines locally.

Anyone with access to the browser profile may be able to access local records. The app does not encrypt browser storage. Browser settings, private browsing, storage pressure, profile removal, or device loss can remove local records; use **Export backup** regularly and keep private copies somewhere safe. **Import backup** replaces this browser's planner data after confirmation; if sync is enabled, those changes are then reconciled with the account.

## Development and validation

No package manager or build step is needed. Run the timer and merge tests with `node --test tests\daymark-core.test.cjs`. The Supabase account-isolation test lives at `supabase\tests\daymark_sync_rls.test.sql` and runs with `supabase test db` in a configured Supabase CLI project.

## Accessibility and print

The app uses labelled controls, keyboard-accessible buttons, visible focus states, and a responsive layout. Print the current section with **Print / Save PDF**; select A4 paper and “Save as PDF” in the browser print dialog.

## License

Released under the [MIT License](LICENSE).
