import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import "./index.css"

import { AppLayout, Home } from "@/components/shell/app-layout"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SessionProvider } from "@/lib/session"
import { initThemeMode } from "@/lib/theme"
import { InvitePage } from "@/pages/invite"
import { LoginPage } from "@/pages/login"
import { NoAccessPage } from "@/pages/no-access"
import { SettingsPage } from "@/pages/settings"

initThemeMode()

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/invite/:token", element: <InvitePage /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
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
