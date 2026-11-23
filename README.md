# ATM CRM — Frontend

Vite + React 19 + Tailwind v4 + the shadcn/ui kit, with the look of the ATM CRM prototype (the clone). This slice has the sign-in, the invite page and Settings: Users & sign-in, Roles & permissions, Configuration, Lists and the Change log.

## Run it locally

Start the backend first (`../ATM Backend`, see its README), then:

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # type-check and lint
```

The backend's address is in `.env`:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

Copy `.env.example` to `.env` if it's missing, and restart `npm run dev` after changing it. The backend's `FRONTEND_URL` must be this app's address (`http://localhost:5173`), so the browser lets the two talk and the sign-in cookie is sent.

## Signing in

Click **Sign in with Google**. The browser goes to Google's sign-in page and comes back signed in. Only invited emails get in; the backend's `.env` needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` (its README explains how to get them).

## The invite flow

1. Settings → Users & sign-in → **Invite someone**: name, title, work email, roles.
2. The backend emails a link (`/invite/<token>`). When emails are only logged (`MAIL_TRANSPORT=log`), the app shows the link so you can copy it.
3. The person opens the link, sees who invited them and as what, and clicks Sign in with Google with that email. They're now active.
4. From the person's ⋯ menu: edit details and roles, send the invite again, cancel the invite, deactivate (signs them out everywhere), reactivate.

## Where things are

```
src/lib/api.ts            calls to the backend, useApi() hook
src/lib/session.tsx       the signed-in person and can("permission")
src/lib/google.ts         the Sign in with Google address
src/pages/login.tsx       sign-in
src/pages/invite.tsx      the invite link's page
src/pages/records/        organisations, brands, products, people, tags: lists, record pages, forms
src/pages/settings/       users, roles, config, lists, change-log
src/components/ui/        the shadcn kit (from the prototype)
src/components/common/    chips, menus, toolbar, toasts (from the prototype)
```

Screens hide what a person's roles don't allow, but the backend checks every request again; the screens are never the only check.
