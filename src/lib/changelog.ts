import { appCodename, appDate, appVersion } from "@/lib/version";

export type ChangelogHighlight = {
  title: string;
  body: string;
};

export type ChangelogEntry = {
  version: string;
  codename?: string;
  date: string;
  summary: string;
  highlights: ChangelogHighlight[];
};

export const changelogEntries: ChangelogEntry[] = [
  {
    version: "7.8",
    codename: "Golden Arrow",
    date: "2026-08-27",
    summary:
      "Team controls, safer chats, and a tighter security loop around how you sign in and manage memory.",
    highlights: [
      {
        title: "Team settings and audit log",
        body: "Owners and admins can review billing and policy changes from a dedicated team dashboard.",
      },
      {
        title: "Safer outbound links",
        body: "External links in chat now ask before leaving Deni AI, so surprise redirects are harder to miss.",
      },
      {
        title: "Memory and 2FA hardening",
        body: "Automatic memory saves skip near-duplicates, and two-factor verification is stricter on sensitive account actions.",
      },
    ],
  },
  {
    version: "7.7.0",
    codename: "Stellar Shield",
    date: "2026-08-16",
    summary:
      "The Stellar Shield release: a calmer home, featured writing, and a more durable chat shell.",
    highlights: [
      {
        title: "Featured blog",
        body: "Editorial posts can be highlighted on the public blog so product notes are easier to find.",
      },
      {
        title: "Chat reliability",
        body: "Generation recovery, usage refresh, and composer flow were tightened so long replies fail less often.",
      },
    ],
  },
  {
    version: "7.5.0",
    codename: "Crystal Tiger",
    date: "2026-06-20",
    summary: "Teams, Max Mode policy, and a clearer free-tier boost for people who verify a card.",
    highlights: [
      {
        title: "Team Max Mode policies",
        body: "Organizations can set default Max Mode limits per member instead of sharing one global cap.",
      },
      {
        title: "Card verification boost",
        body: "Free accounts can verify a card for extra capacity. Disposable email signups are blocked.",
      },
      {
        title: "Deep dark themes",
        body: "Appearance presets gained deeper dark options without changing the rest of the workspace.",
      },
    ],
  },
];
