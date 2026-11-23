// The shadcn overlays (dialogs, popovers…) ask for a portal container; this app has no phone frame, so it's always the page.
export const usePortalContainer = (): HTMLElement | undefined => undefined
