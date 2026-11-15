import { ArrowRight, Check, GitFork, Lock, Upload } from "lucide-react";
import { Button } from "../../components/Button";
import { Term } from "../../components/Term";
import { cx } from "../../components/cx";
import { BrandMark } from "./BrandMark";

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <div className="rounded-t-[40px] bg-white shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
          <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-12 lg:py-20">
            <HowItWorks />
            <Scripts />
            <Progress />
            <Community />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-neutral-100/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 lg:h-20 lg:px-12">
        <a href="/" className="flex items-center no-underline">
          <BrandMark />
        </a>
        <nav aria-label="Page" className="hidden items-center gap-8 lg:flex">
          <a
            href="#how-it-works"
            className="font-montserrat text-sm font-medium text-stone-600 no-underline transition-colors hover:text-stone-900"
          >
            How it works
          </a>
          <a
            href="#scripts"
            className="font-montserrat text-sm font-medium text-stone-600 no-underline transition-colors hover:text-stone-900"
          >
            Scripts
          </a>
        </nav>
        <Button variant="accent" href="/login">
          Sign in
        </Button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid min-h-[75vh] max-w-[1600px] grid-cols-1 items-center gap-8 px-6 pt-8 pb-12 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pt-16 lg:pb-16">
      <div className="lg:col-span-7">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
          <span className="size-2 rounded-full bg-lime" aria-hidden="true" />
          Spaced repetition · Any language
        </span>
        <h1 className="mb-6 text-5xl leading-[0.95] font-medium tracking-tighter lg:text-7xl xl:text-8xl">
          Remember every word.
        </h1>
        <p className="mb-8 max-w-2xl font-montserrat text-lg leading-relaxed text-stone-500 lg:text-xl">
          Each word returns just before you'd forget it. Study in short, focused sessions, in any
          language from Japanese to Arabic.
        </p>
        <div className="flex flex-col gap-4 pt-2 sm:flex-row">
          <Button variant="primary" size="md" href="/login">
            Start learning
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" href="#how-it-works">
            See how it works
          </Button>
        </div>
        <p className="mt-4 text-xs text-stone-400">Sign in with Google. No password to remember.</p>
      </div>
      <div className="relative lg:col-span-5">
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime opacity-20 blur-[100px]"
          aria-hidden="true"
        />
        <QuestionDemo />
      </div>
    </section>
  );
}

function QuestionDemo() {
  return (
    <div className="relative rounded-card border border-stone-200 bg-white p-6 shadow-lg">
      <p className="mb-4 text-xs font-medium tracking-wide text-stone-500 uppercase">
        JLPT N5 · Word → Meaning
      </p>
      <Term term="箸" reading="はし" lang="ja" size="lg" />
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Option label="chopsticks" correct />
        <Option label="bridge" wrong />
        <Option label="edge" />
        <Option label="to eat" />
      </div>
      <p className="mt-5 text-sm text-stone-600">
        箸 (はし) = chopsticks. Not 橋 (bridge), which also reads はし.
      </p>
    </div>
  );
}

function Option({ label, correct = false, wrong = false }: { label: string; correct?: boolean; wrong?: boolean }) {
  return (
    <span
      className={cx(
        "flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium",
        correct && "border-lime bg-lime/20 text-stone-900",
        wrong && "border-red-200 bg-red-50 text-red-700",
        !correct && !wrong && "border-stone-200 text-stone-700",
      )}
    >
      {label}
      {correct && <Check className="size-4 text-stone-900" aria-label="Correct" />}
    </span>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-xs font-medium tracking-wide text-stone-500 uppercase">{eyebrow}</p>
      <h2 className="text-4xl font-medium tracking-tighter lg:text-5xl">{title}</h2>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-neutral-50 px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-b border-stone-100 pb-16 lg:pb-20">
      <SectionHeading eyebrow="Spaced repetition" title="Words that return on time." />
      <p className="mb-8 max-w-3xl text-lg leading-relaxed text-stone-600">
        Voca uses FSRS-6, the same scheduling algorithm Anki uses, so every word reappears just
        before it slips. Fewer reviews, same retention. Words fall due at the start of your study
        day, whatever timezone you're in.
      </p>
      <div className="grid max-w-xl grid-cols-3 gap-3">
        <StatTile value="24" label="Due" />
        <StatTile value="3" label="Overdue" />
        <StatTile value="91.2%" label="Retention" />
      </div>
    </section>
  );
}

function Scripts() {
  return (
    <section id="scripts" className="scroll-mt-24 border-b border-stone-100 py-16 lg:py-20">
      <SectionHeading eyebrow="Native scripts" title="Respect the script." />
      <p className="mb-8 max-w-3xl text-lg leading-relaxed text-stone-600">
        Japanese drilled with hiragana, Chinese with pinyin, Arabic flowing right to left. No forced
        romanization. Readings sit above the word, the way they're meant to.
      </p>
      <div className="flex flex-wrap items-end gap-10">
        <Term term="勉強" reading="べんきょう" lang="ja" />
        <Term term="学习" reading="xuéxí" lang="zh-Hans" />
        <Term term="اللغة" lang="ar" dir="auto" />
      </div>
    </section>
  );
}

function Progress() {
  return (
    <section className="border-b border-stone-100 py-16 lg:py-20">
      <SectionHeading eyebrow="Analytics" title="Know every word." />
      <p className="mb-8 max-w-3xl text-lg leading-relaxed text-stone-600">
        Every answer feeds your memory model. See how likely you are to recall each word, how stable
        it's become, and how well you actually know it.
      </p>
      <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value="87%" label="Recall now" />
        <StatTile value="12.4d" label="Stability" />
        <StatTile value="5.1" label="Difficulty" />
        <StatTile value="78%" label="Accuracy" />
      </div>
    </section>
  );
}

function Community() {
  return (
    <section className="py-16 lg:py-20">
      <SectionHeading eyebrow="Decks · Community" title="Bring words, or borrow them." />
      <p className="mb-8 max-w-3xl text-lg leading-relaxed text-stone-600">
        Import a CSV and study your own list, or fork a public deck someone else made. Japanese verbs,
        HSK, whatever you're learning. Make it yours.
      </p>
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700">
          <Upload className="size-4" aria-hidden="true" />
          Import CSV
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700">
          <GitFork className="size-4" aria-hidden="true" />
          Fork public decks
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700">
          <Lock className="size-4" aria-hidden="true" />
          Private by default
        </span>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-12">
        <div>
          <BrandMark dark />
          <p className="mt-2 text-sm text-stone-400">Vocabulary, remembered.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" href="/login">
            Start learning
          </Button>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-stone-700 px-5 py-2.5 text-sm font-semibold text-stone-200 no-underline transition-colors hover:bg-stone-800"
          >
            Sign in
          </a>
        </div>
      </div>
      <p className="mx-auto max-w-[1600px] px-6 pb-10 text-xs text-stone-500 lg:px-12">
        © 2026 Voca · voca.arvinpaundra.dev
      </p>
    </footer>
  );
}
