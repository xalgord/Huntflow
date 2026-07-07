# HuntFlow MVP Manual Testing Checklist

Use this checklist before each MVP release. Record browser, device, viewport, app version, and tester name at the top of the test run.

Test run:
- Date:
- Tester:
- App version:
- Browser/device:
- Build/commit:

## 1. Pre-Flight Checks

### PF-01 Build Production App
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run `npm install` if dependencies are not installed.
  2. Run `npm run build`.
  3. Review terminal output.
- Expected result:
  - Build completes successfully.
  - No fatal Vite, SvelteKit, PWA, or TypeScript errors.
  - Static output is written to `build/`.

### PF-02 Type Check
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run `npm run check`.
  2. Review `svelte-check` diagnostics.
- Expected result:
  - `svelte-check` reports 0 errors and 0 warnings.

### PF-03 Lint Check
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run `npm run lint`.
  2. Review output.
- Expected result:
  - Lint command completes successfully.
  - No blocking diagnostics are reported.

### PF-04 Unit Tests
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run `npm test -- --run`.
  2. Review test output.
- Expected result:
  - All Vitest suites pass.
  - No skipped or failing tests unless explicitly documented for the release.

### PF-05 Release Smoke Startup
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run `npm run build`.
  2. Run `npm run preview`.
  3. Open the preview URL in Chrome.
  4. Open DevTools Console.
- Expected result:
  - App loads the dashboard.
  - No console errors appear on first load.
  - Main navigation is visible and usable.

## 2. Timer Tests

### T-01 Create Default Session
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create a target if none exists.
  2. Open Timer or tap the dashboard start session action.
  3. Select a target.
  4. Leave duration at 25 minutes.
  5. Start the session.
- Expected result:
  - Session starts immediately.
  - Countdown displays `25:00` or begins at the correct remaining time.
  - Target name is visible.
  - Pause, Abandon, and Complete Early controls are available.

### T-02 Custom Duration Session
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a new session.
  2. Select Custom duration.
  3. Enter a valid custom duration.
  4. Start the session.
- Expected result:
  - Timer starts with the custom duration.
  - Planned duration is persisted on the session.

### T-03 Template Selection
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a new session.
  2. Select a vulnerability template such as SSRF or XSS.
  3. Start and complete the session early.
  4. Check the session history and stats grouping.
- Expected result:
  - Selected template is shown during the timer.
  - Completed session is associated with the selected template.
  - Vulnerability stats include the selected template.

### T-04 Pause and Resume
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a session.
  2. Let it run for at least 5 seconds.
  3. Tap Pause.
  4. Wait 10 seconds.
  5. Tap Resume.
- Expected result:
  - Timer freezes while paused.
  - Resume continues from the paused remaining time.
  - Session status returns to running.

### T-05 Complete Early
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a session.
  2. Tap Complete Early.
  3. Fill an optional quick note.
  4. Select one or more tags.
  5. Save session.
- Expected result:
  - Completion modal appears.
  - Saved session status is completed.
  - Dashboard stats update after saving.
  - Quick note and tags are visible in session history/details.

### T-06 Natural Completion
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a short custom session suitable for manual testing.
  2. Leave the timer running until it reaches zero.
  3. Observe the completion flow.
- Expected result:
  - Timer reaches zero without going negative.
  - Completion modal opens automatically.
  - Saved session is counted in completed sessions and streak stats.

### T-07 Abandon Before 50 Percent
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a session.
  2. Abandon before half the planned duration has elapsed.
  3. Confirm the abandon action if prompted.
  4. Review session history and stats.
- Expected result:
  - Session status is abandoned.
  - Session appears in history with abandoned status.
  - Session does not count toward completed stats, streak, or testing time.

### T-08 Abandon After 50 Percent Guard
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a short custom session.
  2. Wait until more than half the planned duration has elapsed.
  3. Try to abandon the session.
- Expected result:
  - App prevents invalid abandoned state or handles it as a completion/early completion path.
  - No invalid session is saved.
  - No console errors occur.

### T-09 Background Timer
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a short session.
  2. Background the browser tab or switch apps for at least 60 seconds.
  3. Return to HuntFlow.
- Expected result:
  - Timer reflects elapsed wall-clock time.
  - Timer does not simply pause because the tab was backgrounded.
  - If duration elapsed while backgrounded, completion flow appears.

### T-10 Timer Drift
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a 25-minute session.
  2. Start an external stopwatch at the same time.
  3. Let the session run to completion without pausing.
  4. Compare HuntFlow elapsed time to the stopwatch.
- Expected result:
  - Drift is not noticeable for user workflow.
  - Completion occurs within a small tolerance of real wall-clock time.
  - UI updates about once per second without jank.

### T-11 One Minute Remaining Notification/Sound
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Enable sound notifications in Settings.
  2. Start a short session that can reach the one-minute remaining point.
  3. Keep browser audio permissions enabled.
  4. Wait until one minute remains.
- Expected result:
  - User receives the configured one-minute warning if supported.
  - Sound respects the Settings toggle.
  - No repeated or overlapping sounds occur.

### T-12 Session History Filters and Delete
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create completed and abandoned sessions across available dates.
  2. Open session history.
  3. Apply Today, This Week, This Month, and All Time filters.
  4. Delete one session and confirm.
- Expected result:
  - Sessions are newest first.
  - Filters show the correct session sets.
  - Deleted session is removed from history and stats.

## 3. Target Tests

### TG-01 Create Target
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open Targets.
  2. Tap the add target action.
  3. Enter name, platform, program URL, scope, notes, and priority.
  4. Save.
- Expected result:
  - Target is saved to IndexedDB.
  - Target appears in the list.
  - Default status is Recon.
  - No required field is missing.

### TG-02 Target Validation
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Try saving a target with an empty name.
  2. Try saving a target with an invalid program URL.
  3. Try entering very long scope or notes content.
- Expected result:
  - Invalid data is rejected or clearly indicated.
  - Valid existing data is not corrupted.
  - No console errors occur.

### TG-03 Edit Target Inline
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open an existing target detail page.
  2. Edit name, scope, notes, priority, and platform.
  3. Navigate away and return.
- Expected result:
  - Edits persist.
  - `updatedAt` behavior is reflected by last activity/order where visible.
  - Target detail and list show consistent data.

### TG-04 Delete Target
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create a disposable target.
  2. Delete it.
  3. Confirm the action.
  4. Refresh the page.
- Expected result:
  - Target is removed.
  - Deleted target does not reappear after refresh.
  - Linked disposable data is handled consistently.

### TG-05 Target Search
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create targets with distinct names.
  2. Search by exact name.
  3. Search by partial lowercase and uppercase terms.
  4. Clear search.
- Expected result:
  - Matching targets appear.
  - Non-matching targets are hidden.
  - Search is case-insensitive.
  - Clearing search restores the full list.

### TG-06 Target Filters
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create targets across multiple platforms, priorities, and statuses.
  2. Apply each filter individually.
  3. Combine filters if supported.
  4. Clear filters.
- Expected result:
  - Filter results match the selected platform, priority, and status.
  - Empty states are understandable.
  - Clearing filters restores the list.

### TG-07 Sorting
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create targets with different priorities.
  2. Add sessions to some targets.
  3. Return to the target list.
- Expected result:
  - List is ordered by priority and last activity as specified.
  - Session count and last session date are correct.

### TG-08 Status Pipeline
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create a new target and confirm Recon status.
  2. Start and save a completed session for that target.
  3. Manually move status through Testing, Reported, Paid, and Closed.
  4. Archive the target.
- Expected result:
  - Status can follow Recon -> Testing -> Reported -> Paid -> Closed.
  - First session sets or allows Testing behavior as specified.
  - Archived target is hidden from the main list and visible in Archived if available.

### TG-09 Start Session From Target
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open a target detail page.
  2. Use Start Session.
  3. Start the timer.
- Expected result:
  - Timer is pre-filled with the target.
  - Completed session links back to that target.
  - Target session count and last session date update.

## 4. Note Tests

### N-01 Create Blank Note
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open Notes.
  2. Create a new blank note.
  3. Select a required target.
  4. Enter title and markdown content.
  5. Save.
- Expected result:
  - Note is saved.
  - Note appears newest first in the note list.
  - Target link is persisted.

### N-02 Built-In Templates
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create a new note.
  2. Open the template selector.
  3. Check all built-in templates: Subdomain Takeover, IDOR, SSRF, SQL Injection, XSS, Authentication Bypass, Information Disclosure, Business Logic Flaw.
  4. Select each template in turn on a disposable note.
- Expected result:
  - All 8 templates are available.
  - Template content populates the editor.
  - Template badge/id is stored with the note where supported.

### N-03 Markdown Toolbar
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open a note editor.
  2. Use toolbar actions for bold, italic, inline code, code block, link, bullet list, and numbered list.
  3. Save and reopen the note.
- Expected result:
  - Toolbar inserts valid markdown.
  - Content persists after save and reopen.
  - Editor remains focused and usable after toolbar actions.

### N-04 Markdown Preview
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Enter headings, lists, links, code blocks, and inline code in a note.
  2. Toggle markdown preview.
  3. Toggle back to edit mode.
- Expected result:
  - Preview renders markdown correctly.
  - Edit content is unchanged when toggling.
  - Links and code are visually distinct.

### N-05 Auto-Save
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open a saved note.
  2. Make a visible edit.
  3. Wait at least 3 seconds.
  4. Refresh the page.
- Expected result:
  - Edit survives refresh.
  - No duplicate note is created.
  - Last edited timestamp updates if shown.

### N-06 Explicit Save
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open a note.
  2. Make an edit.
  3. Click Save.
  4. Navigate away and return.
- Expected result:
  - Explicit save commits the latest content immediately.
  - No data is lost after navigation.

### N-07 Tags
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Add comma-separated tags to a note.
  2. Save the note.
  3. Filter the note list by one of the tags.
  4. Try invalid or very long tag values.
- Expected result:
  - Valid tags persist and display on the note card.
  - Tag filter returns matching notes.
  - Invalid tags are rejected or normalized consistently.

### N-08 Note Search and Filters
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create notes with unique title and body text.
  2. Search by title.
  3. Search by body text.
  4. Filter by target, template, and tag.
- Expected result:
  - Full-text search returns relevant notes.
  - Filters return only matching notes.
  - Clearing search and filters restores the full note list.

### N-09 Session-Linked Note
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Complete a timer session.
  2. Create or save a note from the completion flow if available.
  3. Open session details.
  4. Open the note detail.
- Expected result:
  - Note is linked to the completed session.
  - Session detail shows linked notes.
  - Note detail shows linked session.

### N-10 Large Note Stability
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Paste a large markdown note with code blocks and lists.
  2. Save.
  3. Toggle preview.
  4. Refresh and reopen.
- Expected result:
  - Editor remains responsive.
  - Content persists without truncation within model limits.
  - Preview does not crash or freeze.

## 5. Stats Tests

### S-01 Today's Summary
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Complete one or more sessions today.
  2. Open dashboard/stats.
  3. Compare displayed testing time and completed count to session history.
- Expected result:
  - Today's testing time equals completed session duration total.
  - Completed session count is correct.
  - Abandoned sessions are excluded from completed totals.

### S-02 Current Streak
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Seed or create completed sessions on consecutive days including today.
  2. Open stats.
  3. Add a gap day scenario if test data tools are available.
- Expected result:
  - Current streak counts consecutive days with at least one completed session.
  - Streak stops at the first missing day.
  - Abandoned/running/paused sessions do not count.

### S-03 Best Streak
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Seed or create sessions that form at least two completed streaks of different lengths.
  2. Open stats.
  3. Compare displayed best streak to expected longest run.
- Expected result:
  - Best streak shows the longest all-time consecutive completed-day run.
  - Multiple sessions on one day count as one streak day.

### S-04 Weekly Activity Calendar
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create completed sessions with varying durations across the last 7 days.
  2. Open stats/dashboard.
  3. Inspect the activity calendar.
  4. Tap a day if day drill-down is supported.
- Expected result:
  - Each day appears in the correct weekday position.
  - Color intensity matches testing minutes: 0, 1-15, 16-45, 46-90, 90+.
  - Day drill-down shows that day's sessions.

### S-05 Total Time Cards
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create completed sessions this week, this month, and all time.
  2. Open stats.
  3. Compare total testing time cards against manual sums.
- Expected result:
  - All-time, monthly, and weekly totals are correct.
  - Durations are formatted clearly as hours/minutes.

### S-06 Vulnerability Type Chart
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Complete sessions with different templates.
  2. Complete one session without a template.
  3. Open the vulnerability type chart.
- Expected result:
  - Chart groups sessions by template.
  - Untemplated sessions are grouped as uncategorized or equivalent.
  - Counts match session history.

### S-07 Target Progress Chart
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create targets in active, completed/closed, and archived states.
  2. Open stats.
  3. Inspect target progress visualization.
- Expected result:
  - Active, completed/closed, and archived counts match target list data.
  - Chart remains readable with zero-count categories.

### S-08 Average Session Length
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Complete sessions with known durations.
  2. Include an abandoned session.
  3. Open stats.
- Expected result:
  - Average uses completed session durations.
  - Abandoned sessions do not inflate average completed-session length.
  - Trend text is understandable.

### S-09 Most Active Time
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create completed sessions across morning, afternoon, evening, and night.
  2. Open stats.
  3. Compare the most active time insight/chart to the test data.
- Expected result:
  - Grouping by session start hour is correct.
  - Most active time matches the highest-count time bucket.

### S-10 Insights
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create data that should trigger streak, average session, specialization, and inactivity insights.
  2. Open stats/dashboard after each data setup.
- Expected result:
  - Insights match the current stats data.
  - Insights update after session completion or deletion.
  - No stale or contradictory insight remains visible.

## 6. Settings Tests

### ST-01 Timer Preferences
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open Settings.
  2. Change default duration, break duration, long-break interval, sound, and vibration settings.
  3. Refresh the app.
  4. Start a new session.
- Expected result:
  - Settings persist after refresh.
  - New session uses the configured defaults.
  - Sound and vibration toggles affect timer behavior.

### ST-02 Theme Modes
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Switch theme to Light.
  2. Switch theme to Dark.
  3. Switch theme to System.
  4. Refresh after each change.
- Expected result:
  - Theme changes apply immediately.
  - Theme persists across reloads.
  - System mode follows OS/browser preference.

### ST-03 Accent Color and Font Size
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Change accent color through all supported values.
  2. Change font size through Small, Medium, and Large.
  3. Visit dashboard, timer, targets, notes, and stats pages.
- Expected result:
  - Accent color applies consistently.
  - Font size changes remain readable and do not break layout.
  - Settings persist after refresh.

### ST-04 Export Data
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create at least one target, session, note, and modified setting.
  2. Open Settings.
  3. Click Export Data.
  4. Inspect the downloaded JSON file.
- Expected result:
  - File downloads successfully.
  - Filename follows `huntflow-export-YYYY-MM-DD.json`.
  - JSON includes sessions, notes, targets, and settings.
  - JSON parses without errors.

### ST-05 Import Data
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Export valid data.
  2. Clear or use a fresh browser profile.
  3. Import the exported JSON.
  4. Review targets, sessions, notes, stats, and settings.
- Expected result:
  - Import validates schema.
  - Data is restored and merged/replaced according to UI copy.
  - Stats recalculate from imported sessions.
  - No duplicate or corrupted records appear unexpectedly.

### ST-06 Invalid Import
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create a malformed JSON file.
  2. Create a JSON file with missing required fields.
  3. Try importing each file.
- Expected result:
  - Import fails gracefully with a clear error.
  - Existing data remains unchanged.
  - No console errors or unhandled promise rejections occur.

### ST-07 Clear Data
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create sample data.
  2. Open Settings.
  3. Click Clear All Data.
  4. Cancel once.
  5. Repeat and confirm.
- Expected result:
  - Cancel leaves data intact.
  - Confirm removes user data.
  - App returns to a clean state without crashing.

### ST-08 Storage Usage and About
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open Settings.
  2. Review storage usage indicator.
  3. Review About section.
- Expected result:
  - Storage usage is visible or clearly unavailable if unsupported.
  - App version, changelog/what's new, feedback link, and privacy information are present.

## 7. PWA Tests

### PWA-01 Manifest
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open DevTools Application panel.
  2. Inspect Manifest.
  3. Check app name, short name, icons, colors, display, and orientation.
- Expected result:
  - Name and short name are HuntFlow.
  - 192x192 and 512x512 icons are present.
  - Theme/background color is dark slate.
  - Display mode is standalone.
  - Orientation is portrait-primary.

### PWA-02 Service Worker Registration
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open DevTools Application > Service Workers.
  2. Load the production preview.
  3. Refresh once.
- Expected result:
  - Service worker is registered and activated.
  - No service worker errors appear.
  - App assets are precached.

### PWA-03 Offline Load
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Load the app online once.
  2. In DevTools Network, enable Offline.
  3. Refresh the app.
- Expected result:
  - App shell loads from cache.
  - Main navigation and previously stored data remain available.
  - Offline banner/indicator appears.

### PWA-04 Offline Data Changes
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Enable offline mode.
  2. Create or edit a target, note, and setting.
  3. Refresh while still offline.
  4. Return online.
- Expected result:
  - Local changes persist offline.
  - Online/offline indicator updates.
  - Back-online toast/sync messaging appears if implemented.

### PWA-05 Install Prompt
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Use a clean browser profile.
  2. Visit the app once, close it, and visit again.
  3. Observe the install banner.
  4. Dismiss the banner and reload.
- Expected result:
  - Custom install prompt appears on second visit when eligible.
  - Prompt is dismissible.
  - Dismiss choice is remembered.

### PWA-06 Android Standalone
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open the app in Chrome Android.
  2. Install to home screen.
  3. Launch from the home screen icon.
  4. Navigate through the app.
- Expected result:
  - App opens without browser chrome.
  - Status bar matches theme.
  - Splash screen and icon are correct.
  - Back button navigates back and exits from root.

### PWA-07 iOS Home Screen
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open the app in Safari iOS.
  2. Add to Home Screen.
  3. Launch from the home screen icon.
  4. Check safe areas on a notched device.
- Expected result:
  - App uses Apple touch icon.
  - App launches in web-app capable mode where supported.
  - Content does not overlap notch, status bar, or home indicator.

### PWA-08 Service Worker Update
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Load one production build.
  2. Deploy or preview a new build.
  3. Refresh the app.
  4. Inspect Service Worker state.
- Expected result:
  - New service worker installs and activates without breaking the app.
  - Old caches are cleaned up.
  - User data remains intact.

## 8. Performance Tests

### PERF-01 Lighthouse Scores
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run Lighthouse against production preview.
  2. Test mobile mode.
  3. Record Performance, Accessibility, Best Practices, and PWA scores.
- Expected result:
  - Each score is 90 or higher.
  - No high-severity Lighthouse diagnostics remain unresolved.

### PERF-02 3G Startup Budget
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open Chrome DevTools Network.
  2. Enable Fast 3G or comparable throttling.
  3. Hard reload the app.
  4. Record first paint and time to interactive.
- Expected result:
  - First paint is under 1.5 seconds.
  - Time to interactive is under 3 seconds.
  - App remains usable during startup.

### PERF-03 Bundle Size Budgets
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run `npm run build`.
  2. Review generated chunk sizes.
  3. Compare route chunks to tech-spec budgets.
- Expected result:
  - Initial app + layout <= 80KB.
  - Timer page <= 30KB.
  - Notes page <= 25KB.
  - Stats page with Chart.js <= 50KB.
  - Settings page <= 15KB.

### PERF-04 Timer Jank
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Start a timer.
  2. Open Performance panel and record 30 seconds.
  3. Interact with pause/resume during the recording.
- Expected result:
  - Timer UI updates once per second.
  - No long repeated main-thread stalls affect usability.
  - Controls respond promptly.

### PERF-05 Notes List Scrolling
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Create or seed more than 100 notes.
  2. Open Notes.
  3. Scroll from top to bottom and back.
  4. Record performance if needed.
- Expected result:
  - Scrolling is smooth near 60fps.
  - List virtualization or equivalent mitigation is used if needed.
  - No visible layout thrashing or freezes occur.

### PERF-06 Memory Stability
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open Chrome DevTools Memory/Performance Monitor.
  2. Navigate repeatedly among dashboard, timer, targets, notes, stats, and settings for 5 minutes.
  3. Start and complete a session.
  4. Edit and preview a large note.
- Expected result:
  - Memory usage stabilizes after navigation.
  - No obvious memory leak appears.
  - App remains responsive.

### PERF-07 Offline Startup Speed
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Load app once online.
  2. Enable offline mode.
  3. Hard reload.
  4. Observe startup time.
- Expected result:
  - Cached app shell loads quickly.
  - Offline startup does not hang on network requests.

## 9. Accessibility Tests

### A11Y-01 Keyboard Navigation
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Reload the app.
  2. Use only Tab, Shift+Tab, Enter, Space, Escape, and arrow keys.
  3. Navigate every main page and major modal.
- Expected result:
  - All interactive controls are reachable.
  - Focus order is logical.
  - Modals trap focus and close correctly.
  - No keyboard trap exists.

### A11Y-02 Visible Focus
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Navigate with keyboard through buttons, links, form fields, tabs, filters, and cards.
  2. Test light and dark themes.
- Expected result:
  - Focus indicator is visible in all themes.
  - Focus is not hidden behind fixed nav or modals.

### A11Y-03 Screen Reader Labels
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Enable NVDA, VoiceOver, or browser accessibility inspection.
  2. Navigate icon-only buttons and form controls.
  3. Open timer, note editor, target form, settings, and modals.
- Expected result:
  - Icon-only buttons have useful names.
  - Form fields have labels.
  - Timer state and modal titles are announced clearly.

### A11Y-04 Contrast
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Run Lighthouse or axe contrast checks.
  2. Manually inspect badges, charts, disabled buttons, and secondary text.
  3. Test all accent colors in light and dark themes.
- Expected result:
  - Text and interactive controls meet WCAG AA contrast.
  - Chart colors remain distinguishable.
  - Status badges are not color-only.

### A11Y-05 Reduced Motion
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Enable reduced motion at OS/browser level.
  2. Reload the app.
  3. Navigate pages and start timer.
- Expected result:
  - Motion is reduced where appropriate.
  - Timer remains understandable.
  - No essential information depends on animation only.

### A11Y-06 Form Errors
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Submit invalid target, note, import, and settings forms.
  2. Navigate errors with keyboard and screen reader.
- Expected result:
  - Error messages are clear and associated with fields.
  - Focus moves to or near the problem when appropriate.
  - User can correct and resubmit without losing data.

### A11Y-07 Mobile Touch Targets
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Use responsive mode at 375px width.
  2. Test bottom navigation, toolbar icons, filters, and timer controls.
- Expected result:
  - Touch targets are easy to tap.
  - Controls do not overlap.
  - Text remains readable at all supported font sizes.

## 10. Cross-Browser Tests

### CB-01 Chrome 90+
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open production preview in Chrome.
  2. Run a smoke test: create target, start/complete session, create note, view stats, export data.
- Expected result:
  - Full functionality works.
  - PWA install and service worker features work.
  - No browser-specific console errors appear.

### CB-02 Firefox 90+
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open production preview in Firefox.
  2. Run the same smoke test as CB-01.
  3. Test offline reload after first online load.
- Expected result:
  - Full core functionality works.
  - IndexedDB persistence works.
  - Offline app shell loads after caching.

### CB-03 Safari 14+ Desktop
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open production preview in Safari.
  2. Run the same smoke test as CB-01.
  3. Test theme, note editor, IndexedDB persistence, and export/import.
- Expected result:
  - Full core functionality works.
  - No Safari-specific layout, storage, or download issues block MVP use.

### CB-04 iOS Safari 14+
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open the app on iPhone Safari.
  2. Test dashboard, timer, target create/edit, note edit/preview, settings, and offline reload.
  3. Add to Home Screen and launch.
- Expected result:
  - Layout works at mobile width.
  - Keyboard input does not obscure important fields.
  - Home screen launch works within iOS PWA limits.

### CB-05 Android Chrome
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open the app on Android Chrome.
  2. Install the PWA.
  3. Start a session, background the app, and return.
  4. Test offline mode and export.
- Expected result:
  - App is installable.
  - Background timer remains accurate.
  - Offline data remains available.

### CB-06 Edge 90+
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open production preview in Edge.
  2. Run the same smoke test as CB-01.
  3. Test install prompt if available.
- Expected result:
  - Full core functionality works.
  - PWA install path behaves correctly.

### CB-07 Samsung Internet
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open the app in Samsung Internet.
  2. Run a reduced smoke test: dashboard, timer, target, note, stats, settings.
  3. Test add-to-home-screen if available.
- Expected result:
  - Best-effort support is acceptable.
  - Core data workflows function.
  - Any browser limitation is documented.

### CB-08 Opera
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Open the app in Opera.
  2. Run a reduced smoke test: dashboard, timer, target, note, stats, settings.
  3. Check console for browser-specific errors.
- Expected result:
  - Best-effort support is acceptable.
  - Core data workflows function.
  - Any browser limitation is documented.

### CB-09 Responsive Widths
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Test at 320px, 375px, 768px, 1024px, and desktop widths.
  2. Visit every main route.
  3. Open forms, modals, filters, charts, and note preview.
- Expected result:
  - No horizontal overflow appears.
  - Text does not overlap controls.
  - Navigation adapts correctly between mobile and desktop.

### CB-10 Long-Run Reliability
- Pass/Fail: [ ] Pass [ ] Fail
- Steps:
  1. Leave the app closed for at least one day after creating data.
  2. Reopen the app.
  3. Start a session and edit an existing note.
- Expected result:
  - Existing data is restored.
  - Stores and IndexedDB initialize correctly.
  - App remains usable without manual cache clearing.
