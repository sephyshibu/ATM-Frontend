import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import "./index.css"

import { AppLayout, Home } from "@/components/shell/app-layout"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SessionProvider } from "@/lib/session"
import { initThemeMode } from "@/lib/theme"
import { BookPage } from "@/pages/booking/book-page"
import { ManageBookingPage } from "@/pages/booking/manage-page"
import { InvitePage } from "@/pages/invite"
import { LeadsPage } from "@/pages/leads"
import { LoginPage } from "@/pages/login"
import { MeetingsPage } from "@/pages/meetings"
import { NoAccessPage } from "@/pages/no-access"
import { RecordsPage } from "@/pages/records"
import { BrandPage } from "@/pages/records/brand-page"
import { OrganisationPage } from "@/pages/records/organisation-page"
import { SettingsPage } from "@/pages/settings"

initThemeMode()

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/invite/:token", element: <InvitePage /> },
  // Public booking pages: no sign-in.
  { path: "/book/:handle", element: <BookPage /> },
  { path: "/booking/:token", element: <ManageBookingPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/leads", element: <LeadsPage /> },
      { path: "/records", element: <RecordsPage /> },
      { path: "/records/brands/:id", element: <BrandPage /> },
      { path: "/records/organisations/:id", element: <OrganisationPage /> },
      { path: "/meetings", element: <MeetingsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/no-access", element: <NoAccessPage /> },
      { path: "*", element: <Home /> },
    ],
  },
])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>
  </StrictMode>,
)
