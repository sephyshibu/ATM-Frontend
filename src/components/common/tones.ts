// Status chip tints shared by every module: badge classes and a dot colour.

export type Tone = { badge: string; dot: string }

export const GREY: Tone = { badge: "bg-muted text-foreground border-border", dot: "bg-[#98a2b3]" }
export const AMBER: Tone = { badge: "bg-[#fffaeb] text-[#b54708] border-[#fedf89]", dot: "bg-[#f79009]" }
export const BLUE: Tone = { badge: "bg-[#eff8ff] text-[#175cd3] border-[#d1e9ff]", dot: "bg-[#2e90fa]" }
export const TEAL: Tone = { badge: "bg-[#f0fdf9] text-[#107569] border-[#99f6e0]", dot: "bg-[#15b79e]" }
export const GREEN: Tone = { badge: "bg-[#ecfdf3] text-[#067647] border-[#abefc6]", dot: "bg-[#17b26a]" }
export const VIOLET: Tone = { badge: "bg-[#f4f3ff] text-[#5925dc] border-[#d9d6fe]", dot: "bg-[#7a5af8]" }
export const RED: Tone = { badge: "bg-[#fef3f2] text-[#b42318] border-[#fecdca]", dot: "bg-[#f04438]" }
export const ROSE: Tone = { badge: "bg-[#fee4e2] text-[#b42318] border-[#fda29b] font-semibold", dot: "bg-[#d92d20]" }
export const MUTED: Tone = { badge: "bg-muted text-muted-foreground border-border", dot: "bg-[#d0d5dd]" }

export const TONES = { GREY, AMBER, BLUE, TEAL, GREEN, VIOLET, RED, ROSE, MUTED }
