# Usage: python3 scripts/console-css.py docs/design/ui-refinement.html fe/src/styles/console.css
"""Turn the design page's CSS into the app's console.css: Console tokens resolved, Paper/Studio rules dropped,
doc chrome dropped. Element rules go into @layer base, everything else into @layer components, so Tailwind
utilities can still override a component class (and the old unlayered-base bug cannot come back)."""
import re
import sys

src, out = sys.argv[1], sys.argv[2]
html = open(src, encoding="utf-8").read()
css = html.split("<style>", 1)[1].split("</style>", 1)[0]

# Drop the doc chrome block and the comparison-table/reference styles at the end.
css = re.sub(r"/\* -+ doc chrome.*?(?=/\* -+ COMPONENTS)", "", css, flags=re.S)
css = re.sub(r"\.cmp \{.*$", "", css, flags=re.S)
# The design-only discover grid and its own head row are kept (the app uses them).


def split_rules(text):
    """Top-level blocks: (prelude, body) with nested bodies kept raw (for @media / @keyframes)."""
    rules, i, n = [], 0, len(text)
    while i < n:
        j = text.find("{", i)
        if j == -1:
            break
        prelude = text[i:j].strip()
        depth, k = 1, j + 1
        while depth and k < n:
            if text[k] == "{":
                depth += 1
            elif text[k] == "}":
                depth -= 1
            k += 1
        body = text[j + 1:k - 1]
        prelude = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()
        rules.append((prelude, body))
        i = k
    return rules


OPT = re.compile(r'body\[data-opt="(paper|console|studio)"\]\s*')


def keep_selector(sel):
    """Return the selector for Console, or None when it only applies to another option."""
    m = OPT.search(sel)
    if not m:
        return sel
    if m.group(1) != "console":
        return None
    return OPT.sub("", sel).strip()


tokens = {}


def parse_decls(body):
    out = []
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    for decl in body.split(";"):
        decl = decl.strip()
        if decl:
            out.append(decl)
    return out


def emit(rules, base, comps, indent=""):
    for prelude, body in rules:
        if prelude.startswith("@keyframes"):
            comps.append(f"{indent}{prelude} {{{body}}}")
            continue
        if prelude.startswith("@media"):
            inner_base, inner_comps = [], []
            emit(split_rules(body), inner_base, inner_comps, indent + "  ")
            if inner_comps:
                comps.append(f"{indent}{prelude} {{\n" + "\n".join(inner_comps) + f"\n{indent}}}")
            if inner_base:
                base.append(f"{indent}{prelude} {{\n" + "\n".join(inner_base) + f"\n{indent}}}")
            continue
        if prelude == ":root" or OPT.fullmatch(prelude.strip() + " ") or re.fullmatch(r'body\[data-opt="\w+"\]', prelude):
            m = re.search(r'data-opt="(\w+)"', prelude)
            if prelude == ":root" or (m and m.group(1) == "console"):
                for decl in parse_decls(body):
                    name, _, value = decl.partition(":")
                    tokens[name.strip()] = value.strip()
            continue
        sels = [keep_selector(s.strip()) for s in prelude.split(",")]
        sels = [s for s in sels if s]
        if not sels:
            continue
        # The segmented control is a radiogroup in the app: style aria-checked like aria-pressed.
        extra = [s.replace('aria-pressed="true"', 'aria-checked="true"') for s in sels if 'aria-pressed="true"' in s]
        sels += extra
        # Tailwind generates its own `.ring` utility; the retention ring gets a name of its own.
        sels = [re.sub(r"\.ring\b", ".ring-meter", s) for s in sels]
        decls = "; ".join(parse_decls(body))
        rule = f"{indent}{', '.join(sels)} {{ {decls}; }}"
        is_element = all(re.fullmatch(r"[\w\s,*:>\-()\[\]=\"'.]+", s) and not re.search(r"\.[a-zA-Z]", s) for s in sels)
        (base if is_element else comps).append(rule)


base, comps = [], []
emit(split_rules(css), base, comps)

root = "\n".join(f"  {k}: {v};" for k, v in tokens.items())
result = f"""/* Generated from docs/design/ui-refinement.html (Console option). Do not edit by hand: change the design,
   then regenerate. Class names are the design's; components and pages render the design's markup. */

:root {{
{root}
}}

@layer base {{
{chr(10).join(base)}
}}

@layer components {{
{chr(10).join(comps)}

/* App adjustments: the design draws the shell inside a 640px frame; the app fills the window. */
.app {{ min-height: 100vh; }}
.side {{ position: sticky; top: 0; height: 100vh; }}
/* StatStrip is a <dl>: the label (dt) comes first in the markup, the value (dd) shows first. */
dl.kpis, dl.kpis dd, .deck-stats-strip dd, .deck-stats-strip dl {{ margin: 0; }}
.kpi > dd.v {{ order: -1; }}
/* ChoiceCard keeps a real checkbox for keyboard and screen readers, visually hidden. */
.choice input {{ position: absolute; opacity: 0; pointer-events: none; }}
}}
"""
open(out, "w", encoding="utf-8").write(result)
print(f"{len(tokens)} tokens, {len(base)} base rules, {len(comps)} component rules")
