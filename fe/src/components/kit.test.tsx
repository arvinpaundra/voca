import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Logo } from "./Logo";
import { Menu } from "./Menu";
import { Modal } from "./Modal";
import { PageHeader } from "./PageHeader";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import { StatStrip } from "./StatStrip";

type Filter = "all" | "due" | "new" | "hard";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "hard", label: "Hard" },
] as const;

function Filters({ onChange }: { onChange: (value: Filter) => void }) {
  const [value, setValue] = useState<Filter>("all");

  return (
    <SegmentedControl
      label="Filter words"
      options={FILTERS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("Button", () => {
  test("a busy button keeps its name, is disabled and says it is busy", () => {
    render(<Button busy>Save</Button>);

    const button = screen.getByRole("button", { name: "Save", busy: true });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SegmentedControl", () => {
  test("is a radio group with the current option checked", () => {
    render(<Filters onChange={() => {}} />);

    const group = screen.getByRole("radiogroup", { name: "Filter words" });

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

describe("Menu", () => {
  const items = (onRename: () => void, onDelete: () => void) => [
    { label: "Rename", onSelect: onRename },
    { label: "Delete", onSelect: onDelete, danger: true },
  ];

  test("the trigger opens a menu of items", async () => {
    const user = userEvent.setup();
    render(<Menu label="Deck actions" items={items(() => {}, () => {})} />);

    const trigger = screen.getByRole("button", { name: "Deck actions", expanded: false });
    await user.click(trigger);

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Rename", "Delete"]);
    expect(screen.getByRole("button", { name: "Deck actions", expanded: true })).toBe(trigger);
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
  test("an open modal is a dialog named by its title, with its body and footer", () => {
    render(
      <Modal open title="Delete deck" onClose={() => {}} footer={<Button>Delete</Button>}>
        <p>All 128 words go too.</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete deck" });

    expect(within(dialog).getByText("All 128 words go too.")).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDefined();
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
  test("Skeleton is a busy status with a name", () => {
    render(<Skeleton label="Loading decks" rows={3} />);

    expect(screen.getByRole("status", { name: "Loading decks", busy: true })).toBeDefined();
  });

  test("EmptyState has a heading, a line of help and an action", () => {
    render(<EmptyState title="No decks yet" body="Create one to start." action={<Button>New deck</Button>} />);

    expect(screen.getByRole("heading", { name: "No decks yet" })).toBeDefined();
    expect(screen.getByText("Create one to start.")).toBeDefined();
    expect(screen.getByRole("button", { name: "New deck" })).toBeDefined();
  });

  test("ErrorState is an alert with a retry", async () => {
    const user = userEvent.setup();
    const onRetry = mock(() => {});
    render(<ErrorState message="Couldn't load your decks." onRetry={onRetry} />);

    expect(within(screen.getByRole("alert")).getByText("Couldn't load your decks.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("page parts", () => {
  test("PageHeader is the page's only h1, with its description and actions", () => {
    render(<PageHeader title="Decks" description="6 decks · 18 due today" actions={<Button>New deck</Button>} />);

    expect(screen.getByRole("heading", { level: 1, name: "Decks" })).toBeDefined();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("6 decks · 18 due today")).toBeDefined();
    expect(screen.getByRole("button", { name: "New deck" })).toBeDefined();
  });

  test("StatStrip pairs each label with its value", () => {
    render(
      <StatStrip
        stats={[
          { label: "Words", value: "128" },
          { label: "Due", value: "12" },
        ]}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["Words", "Due"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["128", "12"]);
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
