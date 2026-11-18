import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { ChoiceCard } from "./ChoiceCard";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Logo } from "./Logo";
import { Menu } from "./Menu";
import { Modal } from "./Modal";
import { PageHeader } from "./PageHeader";
import { SearchInput } from "./SearchInput";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { Skeleton } from "./Skeleton";
import { StatStrip } from "./StatStrip";
import { Tabs } from "./Tabs";

// The class names are the design's (fe/src/styles/console.css, generated from docs/design/ui-refinement.html):
// asserting them is what keeps the app's markup on the design.

type Filter = "all" | "due" | "new" | "hard";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "hard", label: "Hard" },
] as const;

function Filters({ onChange, full }: { onChange: (value: Filter) => void; full?: boolean }) {
  const [value, setValue] = useState<Filter>("all");

  return (
    <SegmentedControl
      label="Filter words"
      options={FILTERS}
      value={value}
      full={full ?? false}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const classes = (element: Element) => [...element.classList].sort();

describe("Button", () => {
  test("variants and sizes are the design's classes", () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="secondary" size="sm">Study</Button>
        <Button variant="ghost">Reset</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="accent">Start</Button>
      </>,
    );

    expect(classes(screen.getByRole("button", { name: "Save" }))).toEqual(["btn", "btn-primary"]);
    expect(classes(screen.getByRole("button", { name: "Study" }))).toEqual(["btn", "btn-secondary", "btn-sm"]);
    expect(classes(screen.getByRole("button", { name: "Reset" }))).toEqual(["btn", "btn-ghost"]);
    expect(classes(screen.getByRole("button", { name: "Delete" }))).toEqual(["btn", "btn-danger"]);
    expect(classes(screen.getByRole("button", { name: "Start" }))).toEqual(["btn", "btn-primary"]);
  });

  test("with href it is a link styled as a button", () => {
    render(<Button href="/app/decks">All decks</Button>);

    const link = screen.getByRole("link", { name: "All decks" });

    expect(link.getAttribute("href")).toBe("/app/decks");
    expect(classes(link)).toEqual(["btn", "btn-primary"]);
  });

  test("a busy button keeps its name, is disabled and shows the spinner class", () => {
    render(<Button busy>Save</Button>);

    const button = screen.getByRole("button", { name: "Save", busy: true });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.classList.contains("btn-busy")).toBe(true);
  });

  test("an icon button is named by its label", () => {
    render(<IconButton label="Close session"><svg aria-hidden="true" /></IconButton>);

    expect(classes(screen.getByRole("button", { name: "Close session" }))).toEqual(["btn-icon"]);
  });
});

describe("Badge and Avatar", () => {
  test("badge variants", () => {
    render(
      <>
        <Badge>New</Badge>
        <Badge variant="lime">Due</Badge>
        <Badge variant="navy" dot>Mature</Badge>
        <Badge variant="outline" lang>ja → en</Badge>
      </>,
    );

    expect(classes(screen.getByText("New"))).toEqual(["badge"]);
    expect(classes(screen.getByText("Due"))).toEqual(["badge", "badge-lime"]);
    expect(classes(screen.getByText("Mature"))).toEqual(["badge", "badge-dot", "badge-navy"]);
    expect(classes(screen.getByText("ja → en"))).toEqual(["badge", "badge-outline", "lang"]);
  });

  test("an avatar without a picture shows the initial", () => {
    render(<Avatar name="arvin Paundra" size="lg" tone="dark" />);

    const avatar = screen.getByText("A");

    expect(classes(avatar)).toEqual(["avatar", "dark", "lg"]);
  });
});

describe("form controls", () => {
  test("Input is a labelled field with its hint or error", () => {
    const { rerender } = render(<Input label="Title" hint="Shown on the deck page" defaultValue="" />);

    const input = screen.getByRole("textbox", { name: "Title" });
    expect(input.classList.contains("input")).toBe(true);
    expect(input.closest(".field")).not.toBeNull();
    expect(screen.getByText("Shown on the deck page").classList.contains("hint")).toBe(true);

    rerender(<Input label="Title" error="Give the deck a title." defaultValue="" />);

    const invalid = screen.getByRole("textbox", { name: "Title" });
    expect(invalid.getAttribute("aria-invalid")).toBe("true");
    expect(invalid.classList.contains("is-bad")).toBe(true);
    expect(screen.getByText("Give the deck a title.").classList.contains("err")).toBe(true);
  });

  test("Select is a labelled .select", async () => {
    const user = userEvent.setup();
    const onChange = mock((_value: string) => {});
    render(
      <Select
        label="Term language"
        value=""
        options={[
          { value: "", label: "All languages" },
          { value: "ja", label: "Japanese" },
        ]}
        onChange={onChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Term language" });
    expect(select.classList.contains("select")).toBe(true);

    await user.selectOptions(select, "ja");
    expect(onChange).toHaveBeenCalledWith("ja");
  });

  test("SearchInput is a labelled search box inside .search", async () => {
    const user = userEvent.setup();
    const onChange = mock((_value: string) => {});
    render(<SearchInput label="Search decks" placeholder="Search decks" value="" onChange={onChange} />);

    const box = screen.getByRole("searchbox", { name: "Search decks" });
    expect(box.classList.contains("input")).toBe(true);
    expect(box.closest(".search")).not.toBeNull();

    await user.type(box, "k");
    expect(onChange).toHaveBeenCalledWith("k");
  });

  test("ChoiceCard is a checkbox row that shows when it is on", async () => {
    const user = userEvent.setup();
    const onChange = mock((_checked: boolean) => {});
    const { rerender } = render(<ChoiceCard label="Term → Meaning" meta="14 due · 10 new" checked={false} onChange={onChange} />);

    const box = screen.getByRole("checkbox", { name: /Term → Meaning/ });
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(box.closest(".choice")?.classList.contains("on")).toBe(false);
    expect(screen.getByText("14 due · 10 new").classList.contains("m")).toBe(true);

    await user.click(box);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<ChoiceCard label="Term → Meaning" meta="14 due · 10 new" checked onChange={onChange} />);
    expect(screen.getByRole("checkbox", { name: /Term → Meaning/ }).closest(".choice")?.classList.contains("on")).toBe(true);
  });
});

describe("SegmentedControl", () => {
  test("is a .seg radio group with the current option checked", () => {
    render(<Filters onChange={() => {}} full />);

    const group = screen.getByRole("radiogroup", { name: "Filter words" });

    expect(classes(group)).toEqual(["full", "seg"]);
    expect(within(group).getAllByRole("radio")).toHaveLength(4);
    expect(within(group).getByRole("radio", { name: "All", checked: true })).toBeDefined();
  });

  test("clicking an option selects it", async () => {
    const user = userEvent.setup();
    const onChange = mock((_value: Filter) => {});
    render(<Filters onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Due" }));

    expect(onChange).toHaveBeenCalledWith("due");
    expect(screen.getByRole("radio", { name: "Due", checked: true })).toBeDefined();
  });

  test("arrow keys move the selection and the focus", async () => {
    const user = userEvent.setup();
    const onChange = mock((_value: Filter) => {});
    render(<Filters onChange={onChange} />);

    screen.getByRole("radio", { name: "All" }).focus();
    await user.keyboard("{ArrowRight}");

    const due = screen.getByRole("radio", { name: "Due", checked: true });
    expect(document.activeElement).toBe(due);
    expect(onChange).toHaveBeenCalledWith("due");

    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("radio", { name: "All", checked: true })).toBeDefined();
  });
});

describe("Tabs", () => {
  test("a .tabs tablist with counts; choosing a tab selects it", async () => {
    const user = userEvent.setup();
    const onChange = mock((_value: Filter) => {});
    render(
      <Tabs
        label="Filter words"
        tabs={[
          { value: "all", label: "All", count: 248 },
          { value: "due", label: "Due", count: 20 },
          { value: "hard", label: "Hard" },
        ]}
        value="all"
        onChange={onChange}
      />,
    );

    const list = screen.getByRole("tablist", { name: "Filter words" });
    expect(classes(list)).toEqual(["tabs"]);

    const all = within(list).getByRole("tab", { name: "All 248", selected: true });
    expect(all.querySelector(".c")?.textContent).toBe("248");
    expect(within(list).getByRole("tab", { name: "Hard", selected: false })).toBeDefined();

    await user.click(within(list).getByRole("tab", { name: "Due 20" }));
    expect(onChange).toHaveBeenCalledWith("due");
  });
});

describe("Menu", () => {
  const items = (onRename: () => void, onDelete: () => void) => [
    { label: "Rename", onSelect: onRename },
    { label: "Delete", onSelect: onDelete, danger: true },
  ];

  test("the trigger opens a .menu of items; danger items are .bad", async () => {
    const user = userEvent.setup();
    render(<Menu label="Deck actions" items={items(() => {}, () => {})} />);

    const trigger = screen.getByRole("button", { name: "Deck actions", expanded: false });
    expect(classes(trigger)).toEqual(["btn-icon"]);
    await user.click(trigger);

    const menu = screen.getByRole("menu");
    expect(menu.classList.contains("menu")).toBe(true);
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Rename", "Delete"]);
    expect(within(menu).getByRole("menuitem", { name: "Delete" }).classList.contains("bad")).toBe(true);
    expect(screen.getByRole("button", { name: "Deck actions", expanded: true })).toBe(trigger);
  });

  test("a secondary trigger is a bordered button", () => {
    render(<Menu label="More actions" trigger="secondary" items={items(() => {}, () => {})} />);

    const trigger = screen.getByRole("button", { name: "More actions" });

    expect(trigger.classList.contains("btn")).toBe(true);
    expect(trigger.classList.contains("btn-secondary")).toBe(true);
  });

  test("choosing an item runs it and closes the menu", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    render(<Menu label="Deck actions" items={items(() => {}, onDelete)} />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("Escape closes the menu and gives focus back to the trigger", async () => {
    const user = userEvent.setup();
    render(<Menu label="Deck actions" items={items(() => {}, () => {})} />);

    const trigger = screen.getByRole("button", { name: "Deck actions" });
    await user.click(trigger);
    screen.getByRole("menu");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("Modal", () => {
  test("an open modal is a .modal dialog with head, body and foot", () => {
    render(
      <Modal
        open
        title="Delete deck"
        description="All 128 words go too."
        onClose={() => {}}
        footer={<Button variant="danger">Delete</Button>}
      >
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete deck" });
    const panel = dialog.querySelector(".modal");

    expect(panel).not.toBeNull();
    expect(panel?.querySelector(".modal-head")?.textContent).toContain("All 128 words go too.");
    expect(within(panel!.querySelector(".modal-body") as HTMLElement).getByText("Body")).toBeDefined();
    expect(within(panel!.querySelector(".modal-foot") as HTMLElement).getByRole("button", { name: "Delete" })).toBeDefined();
  });

  test("Escape and the close button both ask to close", async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(
      <Modal open title="Rename deck" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Rename deck" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("states", () => {
  test("Skeleton is a busy status of .skel bars", () => {
    render(<Skeleton label="Loading decks" rows={3} />);

    const status = screen.getByRole("status", { name: "Loading decks", busy: true });

    expect(status.querySelectorAll(".skel")).toHaveLength(3);
  });

  test("EmptyState is .empty with a title, a line of help and an action", () => {
    render(<EmptyState title="No decks yet" body="Create one to start." action={<Button>New deck</Button>} />);

    const title = screen.getByRole("heading", { name: "No decks yet" });

    expect(title.closest(".empty")).not.toBeNull();
    expect(screen.getByText("Create one to start.")).toBeDefined();
    expect(screen.getByRole("button", { name: "New deck" })).toBeDefined();
  });

  test("ErrorState is an .alert-bad alert with a retry", async () => {
    const user = userEvent.setup();
    const onRetry = mock(() => {});
    render(<ErrorState message="Couldn't load your decks." onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert.classList.contains("alert")).toBe(true);
    expect(alert.classList.contains("alert-bad")).toBe(true);
    expect(within(alert).getByText("Couldn't load your decks.")).toBeDefined();

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("page parts", () => {
  test("PageHeader: back link, eyebrow, one .h1, meta, description and actions", () => {
    render(
      <PageHeader
        back={{ href: "/app/decks", label: "Decks" }}
        eyebrow="Wednesday, 18 November"
        title="Japanese N5 verbs"
        meta={<span>14 forks</span>}
        description="Common verbs for the JLPT N5."
        actions={<Button>Study 20 due</Button>}
      />,
    );

    const back = screen.getByRole("link", { name: "Decks" });
    expect(back.getAttribute("href")).toBe("/app/decks");
    expect(back.classList.contains("back")).toBe(true);

    const title = screen.getByRole("heading", { level: 1, name: "Japanese N5 verbs" });
    expect(title.classList.contains("h1")).toBe(true);
    expect(title.closest(".page-head")).not.toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    expect(screen.getByText("Wednesday, 18 November").classList.contains("eyebrow")).toBe(true);
    expect(screen.getByText("14 forks").closest(".ph-meta")).not.toBeNull();
    expect(screen.getByText("Common verbs for the JLPT N5.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Study 20 due" }).closest(".ph-actions")).not.toBeNull();
  });

  test("StatStrip is a .kpis list pairing each label with its value", () => {
    render(
      <StatStrip
        stats={[
          { label: "due", value: "32", highlight: true },
          { label: "new", value: "10" },
        ]}
      />,
    );

    const terms = screen.getAllByRole("term");
    const values = screen.getAllByRole("definition");

    expect(terms.map((term) => term.textContent)).toEqual(["due", "new"]);
    expect(values.map((value) => value.textContent)).toEqual(["32", "10"]);
    expect(terms[0]?.classList.contains("l")).toBe(true);
    expect(values[0]?.classList.contains("v")).toBe(true);
    expect(terms[0]?.closest(".kpi")?.classList.contains("hl")).toBe(true);
    expect(terms[0]?.closest(".kpis")).not.toBeNull();
  });

  test("Card is a .card section, named when labelled", () => {
    render(<Card aria-label="Streak">12</Card>);

    expect(screen.getByRole("region", { name: "Streak" }).classList.contains("card")).toBe(true);
  });
});

describe("Logo", () => {
  test("the full logo is one image named Voca", () => {
    render(<Logo />);

    const logo = screen.getByRole("img", { name: "Voca" });

    expect(logo.textContent?.toLowerCase()).toContain("voca");
  });

  test("without the name it is still named Voca, but shows only the mark", () => {
    render(<Logo withName={false} tone="dark" />);

    const logo = screen.getByRole("img", { name: "Voca" });

    expect(logo.textContent?.toLowerCase() ?? "").not.toContain("voca");
  });
});
