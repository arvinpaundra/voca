import type { ReactNode } from "react";

export function Modal(_props: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return <p>not implemented: UI-K2</p>;
}
