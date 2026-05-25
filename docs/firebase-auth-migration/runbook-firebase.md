# Runbook — Firebase Project Provisioning

Operator-facing checklist for provisioning the Firebase project that backs HuntFlow's
Auth surface. This runbook is the source of truth for the four `VITE_FIREBASE_*`
client env vars and the Convex-side `FIREBASE_PROJECT_ID`.

It is executed once per environment (dev project + prod project), before any
of the cutover steps in `runbook-cutover.md`.

Reference: `design.md` → "Firebase Project Setup Checklist".

---

## Prerequisites

- [ ] Operator has owner-level access to a Google account that will own the
      Firebase project.
- [ ] Operator has admin access to the GitHub OAuth Apps page at
      <https://github.com/settings/developers> (needed for the GitHub provider).
- [ ] DNS for `huntflow.xalgorix.com` is already pointed at Vercel.

---

## Step 1 — Create the Firebase project

1. Open <https://console.firebase.google.com/>.
2. Click **Add project**.
3. Name it `huntflow-prod` (or `huntflow-dev` for the development project).
4. Disable Google Analytics unless the operator explicitly wants it. Analytics
   adds no value for the auth-only use case here.
5. Click **Create project** and wait for provisioning to finish.
6. Record the **Project ID** shown on the project home page. This becomes both
   `VITE_FIREBASE_PROJECT_ID` (client) and `FIREBASE_PROJECT_ID` (Convex).

---

## Step 2 — Enable sign-in methods

Console screen: **Build → Authentication → Sign-in method**.

If the Authentication product hasn't been initialised yet, click **Get started**
once before continuing.

### 2a. Email / Password

1. Click the **Email/Password** row.
2. Toggle **Email/Password** to **Enabled**.
3. Leave **Email link (passwordless sign-in)** **Disabled** — HuntFlow uses
   password-based email sign-in only (Requirement 1.6).
4. Click **Save**.

### 2b. Google

1. Click the **Google** row.
2. Toggle **Google** to **Enabled**.
3. Set **Project support email** to the operator's email (required by Google).
4. Click **Save**.

### 2c. GitHub

1. In a separate tab, open <https://github.com/settings/developers> →
   **OAuth Apps** → **New OAuth App**.
   - Application name: `HuntFlow`.
   - Homepage URL: `https://huntflow.xalgorix.com`.
   - Authorization callback URL: `https://<projectId>.firebaseapp.com/__/auth/handler`
     (replace `<projectId>` with the Firebase Project ID from Step 1).
2. Register the app and copy the **Client ID** and **Client Secret**.
3. Back in the Firebase Console, click the **GitHub** row.
4. Toggle **GitHub** to **Enabled**.
5. Paste the **Client ID** and **Client Secret**.
6. Click **Save**.

---

## Step 3 — Authorized domains

Console screen: **Build → Authentication → Settings → Authorized domains**.

1. Click **Add domain** and add `huntflow.xalgorix.com`.
2. Verify `localhost` is already present (Firebase ships it by default for dev).
3. Remove any unused defaults, but keep `<projectId>.firebaseapp.com` — it is
   the OAuth handler domain Firebase needs.

---

## Step 4 — Password policy

Console screen: **Build → Authentication → Settings → Password policy**.

This resolves Open Question 2 from `design.md` with the documented default:

- [ ] **Minimum password length**: `8`.
- [ ] **Require lowercase character**: **off** (no class requirement).
- [ ] **Require uppercase character**: **off**.
- [ ] **Require numeric character**: **on**.
- [ ] **Require non-alphanumeric character**: **off**.
- [ ] **Enforcement mode**: **Enforce on sign-up and sign-in**.

Net result: passwords must be at least 8 characters and contain at least one
letter and one digit. No uppercase, lowercase split, or special-character
requirements. Property 1 in `design.md` is implemented against this exact
policy.

Click **Save**.

---

## Step 5 — Email templates

Console screen: **Build → Authentication → Templates**.

This resolves Open Question 3 from `design.md`. Firebase's default templates
already render correctly; the only operator action is to apply HuntFlow
branding to subject lines, set the action URL, and remove any "Powered by
Firebase" footer text that the default body includes.

Firebase supports the following placeholders inside template bodies:

| Placeholder | Meaning |
| --- | --- |
| `%DISPLAY_NAME%` | The user's `displayName` (empty string if unset). |
| `%EMAIL%` | The recipient email address. |
| `%LINK%` | The email-action link (verification or reset). |
| `%APP_NAME%` | The Firebase project's public name. |
| `%NEW_EMAIL%` | The new email address (recover-email template only). |

### 5a. Email address verification

1. Click the **Email address verification** template, then **Edit** (pencil
   icon).
2. **Subject**: `Verify your email for HuntFlow`.
3. **Body**: keep the default Firebase body, with these edits:
   - Replace any `%APP_NAME%` reference with `HuntFlow`.
   - Remove any "Thanks, your %APP_NAME% team" line that mentions Firebase.
   - Keep the `%LINK%` placeholder where the verify link appears.
4. **Action URL** (the link the email points to): set to
   `https://huntflow.xalgorix.com/reset-password`.
   - The `/reset-password` route is the single dispatcher for all Firebase
     email actions; the `mode` query param distinguishes verify-email from
     password-reset.
5. **Reply-to** / **Sender name**: leave Firebase defaults unless the operator
   wants a branded sender. (Custom sender requires SPF setup; out of scope.)
6. Click **Save**.

### 5b. Password reset

1. Click the **Password reset** template, then **Edit**.
2. **Subject**: `Reset your HuntFlow password`.
3. **Body**: same edits as 5a — strip `%APP_NAME%` references that mention
   Firebase, replace with `HuntFlow`, keep `%LINK%`.
4. **Action URL**: `https://huntflow.xalgorix.com/reset-password`.
5. Click **Save**.

### 5c. Email address change (optional)

HuntFlow does not currently expose an in-app email-change UI, so the
**Email address change** template is not exercised. Leave it at Firebase
defaults; if a future iteration adds the UI, revisit this section.

---

## Step 6 — Web app config

Console screen: **Project settings → General → Your apps**.

1. Click the **Web** icon (`</>`) to add a Web app.
2. App nickname: `huntflow-web`.
3. Skip Firebase Hosting (HuntFlow ships through Vercel).
4. Click **Register app**.
5. Firebase displays a config object that looks like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "<projectId>.firebaseapp.com",
     projectId: "<projectId>",
     storageBucket: "<projectId>.appspot.com",
     messagingSenderId: "...",
     appId: "1:...:web:..."
   };
   ```

6. Copy the four fields HuntFlow consumes: `apiKey`, `authDomain`,
   `projectId`, `appId`. The other fields (`storageBucket`,
   `messagingSenderId`) are not used by this migration.

---

## Step 7 — Service accounts

**Skip this section.** HuntFlow does not use `firebase-admin`. The Convex
HTTP action verifies Dodo webhook signatures itself; the client uses only
the Firebase Web SDK. No service-account JSON is provisioned.

---

## Captured values

After completing the steps above, the operator has the following values
ready to paste into Vercel and Convex environment configuration:

| Variable | Source | Surface |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Step 6 → `apiKey` | Vercel client env |
| `VITE_FIREBASE_AUTH_DOMAIN` | Step 6 → `authDomain` | Vercel client env |
| `VITE_FIREBASE_PROJECT_ID` | Step 6 → `projectId` | Vercel client env |
| `VITE_FIREBASE_APP_ID` | Step 6 → `appId` | Vercel client env |
| `FIREBASE_PROJECT_ID` | Step 1 → Project ID (same string as `projectId`) | Convex server env |

Next runbook in the sequence: `runbook-dodo.md`.
