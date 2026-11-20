/** What a page can read while its data is in flight, has failed, or has arrived. */
export type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly value: T };
