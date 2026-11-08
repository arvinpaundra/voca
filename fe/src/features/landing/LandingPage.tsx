import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Section } from "../../components/Section";
import { Term } from "../../components/Term";
import { Wordmark } from "../../components/Wordmark";
import styles from "./landing.module.css";

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Scripts />
        <Progress />
        <Community />
      </main>
      <Footer />
    </>
  );
}

function Header() {
  return (
    <header className={styles.topbar}>
      <Container className={styles.topbarInner}>
        <a className={styles.brand} href="/">
          <Wordmark />
        </a>
        <Button variant="ghost" href="/login">
          Sign in
        </Button>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className={styles.heroSection}>
      <Container>
        <div className={styles.hero}>
          <div>
            <p className="label">Spaced repetition · Any language</p>
            <h1 className={styles.heroTitle}>Remember every word.</h1>
            <p className={styles.heroTagline}>
              Each word returns just before you'd forget it. Study in short, focused sessions, in
              any language from Japanese to Arabic.
            </p>
            <div className={styles.heroCtas}>
              <Button variant="primary" href="/login">
                Start learning
              </Button>
              <Button variant="ghost" href="#how-it-works">
                See how it works
              </Button>
            </div>
            <p className={`label ${styles.heroNote}`}>Sign in with Google</p>
          </div>
          <QuestionDemo />
        </div>
      </Container>
    </section>
  );
}

function QuestionDemo() {
  return (
    <div className={styles.qcard}>
      <p className="label">JLPT N5 · Word → Meaning</p>
      <Term term="箸" reading="はし" lang="ja" size="lg" className={styles.qterm} />
      <div className={styles.qoptions}>
        <span className={`${styles.opt} ${styles.optCorrect}`}>
          chopsticks <kbd>✓</kbd>
        </span>
        <span className={`${styles.opt} ${styles.optWrong}`}>
          bridge <kbd>✗</kbd>
        </span>
        <span className={styles.opt}>edge</span>
        <span className={styles.opt}>to eat</span>
      </div>
      <p className={styles.qfeedback}>箸 (はし) = chopsticks. Not 橋 (bridge), which also reads はし.</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <Section id="how-it-works" title="Words that return on time." eyebrow="Spaced repetition">
      <p className={styles.lead}>
        Voca uses FSRS-6, the same scheduling algorithm Anki uses, so every word reappears just
        before it slips. Fewer reviews, same retention. Words fall due at the start of your study
        day, whatever timezone you're in.
      </p>
      <div className={styles.statRow}>
        <span className={styles.stat}>
          <b>24</b>
          <span className="label">Due</span>
        </span>
        <span className={styles.stat}>
          <b>3</b>
          <span className="label">Overdue</span>
        </span>
        <span className={styles.stat}>
          <b>91.2%</b>
          <span className="label">Retention</span>
        </span>
      </div>
    </Section>
  );
}

function Scripts() {
  return (
    <Section title="Respect the script." eyebrow="Native scripts">
      <p className={styles.lead}>
        Japanese drilled with hiragana, Chinese with pinyin, Arabic flowing right to left. No forced
        romanization. Readings sit above the word, the way they're meant to.
      </p>
      <div className={styles.termRow}>
        <Term term="勉強" reading="べんきょう" lang="ja" />
        <Term term="学习" reading="xuéxí" lang="zh-Hans" />
        <Term term="اللغة" lang="ar" dir="auto" />
      </div>
    </Section>
  );
}

function Progress() {
  return (
    <Section title="Know every word." eyebrow="Analytics">
      <p className={styles.lead}>
        Every answer feeds your memory model. See how likely you are to recall each word, how
        stable it's become, and how well you actually know it.
      </p>
      <div className={styles.statRow}>
        <span className={styles.stat}>
          <b>87%</b>
          <span className="label">Recall now</span>
        </span>
        <span className={styles.stat}>
          <b>12.4d</b>
          <span className="label">Stability</span>
        </span>
        <span className={styles.stat}>
          <b>5.1</b>
          <span className="label">Difficulty</span>
        </span>
        <span className={styles.stat}>
          <b>78%</b>
          <span className="label">Accuracy</span>
        </span>
      </div>
    </Section>
  );
}

function Community() {
  return (
    <Section title="Bring words, or borrow them." eyebrow="Decks · Community">
      <p className={styles.lead}>
        Import a CSV and study your own list, or fork a public deck someone else made. Japanese
        verbs, HSK, whatever you're learning. Make it yours.
      </p>
      <p className={`label ${styles.closing}`}>Private by default</p>
    </Section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Wordmark />
            <p className={styles.footerTagline}>Vocabulary, remembered.</p>
          </div>
          <div className={styles.footerActions}>
            <Button variant="primary" href="/login">
              Start learning
            </Button>
            <Button variant="ghost" href="/login">
              Sign in
            </Button>
          </div>
        </div>
        <p className={styles.footerLegal}>© 2026 Voca · voca.arvinpaundra.dev</p>
      </Container>
    </footer>
  );
}
