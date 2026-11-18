export type NavItem = { readonly key: string; readonly label: string; readonly to: string; readonly exact: boolean };

/** The sidebar's items, in order. */
export const navItems = (): ReadonlyArray<NavItem> => {
  throw new Error("not implemented: F-0");
};
