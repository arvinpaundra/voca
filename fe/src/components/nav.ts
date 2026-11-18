export type NavItem = { readonly key: string; readonly label: string; readonly to: string; readonly exact: boolean };

/** The sidebar's items, in order. */
export const navItems = (): ReadonlyArray<NavItem> => {
  return [
    { key: "dashboard", label: "Dashboard", to: "/app", exact: true },
    { key: "decks", label: "Decks", to: "/app/decks", exact: false },
    { key: "hard", label: "Hard words", to: "/app/hard", exact: false },
    { key: "discover", label: "Discover", to: "/app/discover", exact: false },
    { key: "settings", label: "Settings", to: "/app/settings", exact: false },
  ];
};
