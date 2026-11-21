import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check, GitFork, Lock } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Logo } from "../../components/Logo";
import { StatStrip } from "../../components/StatStrip";
import { Term } from "../../components/Term";

// The hero and the sections below it share one content width, so their edges line up on wide screens.
const contentStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
};

// The sections below the hero share the nav's side padding and the app's content width.
const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  ...contentStyle,
  padding: "56px clamp(16px, 4vw, 40px)",
  borderTop: "1px solid var(--line)",
  scrollMarginTop: 16,
};

const linkStyle: CSSProperties = { textDecoration: "none" };

export function LandingPage({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="landing">
      <Nav signedIn={signedIn} />

      <main>
        <Hero signedIn={signedIn} />
        <HowItWorks />
        <Scripts />
        <Progress />
        <Community />
      </main>

      <Footer signedIn={signedIn} />
    </div>
  );
}

// A signed-in Learner goes straight to the Dashboard; a Visitor is sent to sign in first.
const startHref = (signedIn: boolean): string => (signedIn ? "/app" : "/login");

function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="l-nav">
      <Logo />

      <nav aria-label="Page">
        <a href="#how-it-works" style={linkStyle}>
          How it works
        </a>
        <a href="#scripts" style={linkStyle}>
          Scripts
        </a>
        <a href="/app/discover" style={linkStyle}>
          Discover
        </a>
      </nav>

      {signedIn ? (
        <Button variant="secondary" size="sm" href="/app">
          Open app
        </Button>
      ) : (
        <Button variant="secondary" size="sm" href="/login">
          Sign in
        </Button>
      )}
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="l-hero" style={contentStyle}>
      <div>
        <span className="pill">
          <i></i>Spaced repetition · any language
        </span>

        <h1>Remember every word.</h1>

        <p>
          Each word returns just before you’d forget it. Short, focused sessions in any script: kanji, hanzi, Arabic,
          Cyrillic.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button variant="primary" href={startHref(signedIn)}>
            Start learning
            <ArrowRight className="i" aria-hidden="true" />
          </Button>

          <Button variant="ghost" href="#how-it-works">
            See how it works
          </Button>
        </div>
      </div>

      <section className="prompt" style={{ padding: "32px 20px", gap: 20 }}>
        <span className="drill">Term → Meaning</span>

        <p className="term" lang="ja" style={{ fontSize: 56 }}>
          <ruby>
            勉強<rt>べんきょう</rt>
          </ruby>
        </p>

        <div className="options" style={{ maxWidth: 360 }}>
          <div className="opt right">
            <kbd>1</kbd>
            <span className="grow">study</span>
            <Check className="i" aria-hidden="true" />
          </div>

          <div className="opt dim">
            <kbd>2</kbd>
            <span className="grow">school</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Feature({ id, eyebrow, title, body, children }: { id?: string; eyebrow: string; title: string; body: string; children: ReactNode }) {
  return (
    <section id={id} style={sectionStyle}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="h1">{title}</h2>
      <p className="sub" style={{ maxWidth: 640, fontSize: 16 }}>
        {body}
      </p>
      {children}
    </section>
  );
}

function HowItWorks() {
  return (
    <Feature
      id="how-it-works"
      eyebrow="Spaced repetition"
      title="Words that return on time."
      body="Voca uses FSRS-6, the same scheduling algorithm Anki uses, so every word reappears just before it slips. Fewer reviews, same retention. Words fall due at the start of your study day, whatever timezone you're in."
    >
      <div style={{ maxWidth: 480 }}>
        <StatStrip
          stats={[
            { label: "Due", value: "24" },
            { label: "Overdue", value: "3" },
            { label: "Retention", value: "91.2%" },
          ]}
        />
      </div>
    </Feature>
  );
}

function Scripts() {
  return (
    <Feature
      id="scripts"
      eyebrow="Native scripts"
      title="Respect the script."
      body="Japanese drilled with hiragana, Chinese with pinyin, Arabic flowing right to left. No forced romanization. Readings sit above the word, the way they're meant to."
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 40 }}>
        <Term term="勉強" reading="べんきょう" lang="ja" />
        <Term term="学习" reading="xuéxí" lang="zh-Hans" />
        <Term term="اللغة" lang="ar" dir="auto" />
      </div>
    </Feature>
  );
}

function Progress() {
  return (
    <Feature
      eyebrow="Analytics"
      title="Know every word."
      body="Every answer feeds your memory model. See how likely you are to recall each word, how stable it's become, and how well you actually know it."
    >
      <div style={{ maxWidth: 560 }}>
        <StatStrip
          stats={[
            { label: "Recall now", value: "87%" },
            { label: "Stability", value: "12.4d" },
            { label: "Difficulty", value: "5.1" },
            { label: "Accuracy", value: "78%" },
          ]}
        />
      </div>
    </Feature>
  );
}

function Community() {
  return (
    <Feature
      eyebrow="Decks · Community"
      title="Bring words, or borrow them."
      body="Build your own deck, or fork a public deck someone else made. Japanese verbs, HSK, whatever you're learning. Make it yours."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Badge variant="outline">
          <GitFork className="i" aria-hidden="true" />
          Fork public decks
        </Badge>

        <Badge variant="outline">
          <Lock className="i" aria-hidden="true" />
          Private by default
        </Badge>
      </div>
    </Feature>
  );
}

function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer style={{ ...sectionStyle, gridAutoFlow: "column", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <Logo />
        <span className="muted" style={{ fontSize: 13 }}>
          Vocabulary, remembered.
        </span>
      </div>

      <Button variant="primary" href={startHref(signedIn)}>
        Start learning
      </Button>
    </footer>
  );
}
