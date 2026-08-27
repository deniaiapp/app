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
    version: "7.8.0",
    codename: "Golden Arrow",
    date: "2026-08-27",
    summary:
      "Team controls, safer chats, and a tighter security loop around how you sign in and manage memory.",
    highlights: [
      {
        title: "Chat & Memory Enhancements",
        body: "You can now have assistant messages read aloud and search through memory.",
      },
      {
        title: "Security Enhancements",
        body: "You can now view your sign-in and account action history, as well as log out of sessions even for accounts that have been logged in for several days.",
      },
      {
        title: "Project Enhancements",
        body: "You can now archive projects, configure default models, and share them with your team.",
      },
      {
        title: "Data Exporting",
        body: "You can now export your Deni AI data (e.g., chats, memory, projects, profile).",
      },
      {
        title: "Chat Importing",
        body: "You can migrate data from external sources and export data.",
      },
      {
        title: "Team Management",
        body: "Administrators and owners can now manage billing, share projects with their teams, review audit logs, and change user roles.",
      },
      {
        title: "Other changes",
        body: "PWA feature expansion, Max Mode bug fixes, and other bug fixes and UI updates.",
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
