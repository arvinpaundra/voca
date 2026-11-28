import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Modal } from "../../components/Modal";
import { deleteAccount, emailMatches } from "../../lib/account";

const LOSSES = [
  "Your decks and their words are deleted, including the ones you published to Community.",
  "Copies other learners forked from your decks stay theirs.",
  "Your name, email and photo are removed from Voca.",
  "You’re signed out on every device.",
  "Signing in with this Google account again starts a new, empty account.",
];

const FAILURE = "Couldn’t delete your account. Nothing was deleted. Try again.";

export function DangerZoneSection({ email }: { email: string }) {
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="danger-card" aria-labelledby={headingId}>
      <div className="card-head">
        <h2 id={headingId} className="h2">
          Danger zone
        </h2>
      </div>

      <div className="danger-row">
        <div className="lbl">
          <b>Delete account</b>
          <span>Deletes your decks and signs you out everywhere. This can’t be undone.</span>
        </div>

        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      </div>

      {confirming && <DeleteAccountDialog email={email} onClose={() => setConfirming(false)} />}
    </Card>
  );
}

function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const matches = emailMatches(typed, email);

  const confirm = async () => {
    if (!matches || busy) return;

    setBusy(true);
    setFailed(false);

    const deleted = await deleteAccount();

    if (deleted) return;

    setBusy(false);
    setFailed(true);
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    void confirm();
  };

  return (
    <Modal
      open
      title="Delete your account?"
      description="This can’t be undone."
      onClose={onClose}
      busy={busy}
      closeOnBackdrop
      stackFooter
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep account
          </Button>
          <Button variant="danger" busy={busy} disabled={!matches} onClick={() => void confirm()}>
            {busy ? "Deleting…" : "Delete account"}
          </Button>
        </>
      }
    >
      <ul className="losses">
        {LOSSES.map((loss) => (
          <li key={loss}>{loss}</li>
        ))}
      </ul>

      <div className="field">
        <label htmlFor={inputId}>
          Type <code>{email}</code> to confirm
        </label>
        <input
          id={inputId}
          className="input"
          type="email"
          autoComplete="off"
          placeholder={email}
          value={typed}
          disabled={busy}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={submitOnEnter}
        />
      </div>

      {failed && (
        <div role="alert" className="alert alert-bad">
          <span className="grow">{FAILURE}</span>
        </div>
      )}
    </Modal>
  );
}
