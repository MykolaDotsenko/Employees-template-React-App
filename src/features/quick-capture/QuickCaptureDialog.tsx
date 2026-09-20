import {
  useId,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

interface QuickCaptureDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onCapture: (title: string) => void;
}

export function QuickCaptureDialog({
  dialogRef,
  onCapture,
}: QuickCaptureDialogProps) {
  const titleId = useId();
  const [title, setTitle] = useState("");

  function closeDialog() {
    dialogRef.current?.close();
  }

  function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onCapture(trimmedTitle);
    setTitle("");
    closeDialog();
  }

  return (
    <dialog
      ref={dialogRef}
      className="quick-capture-dialog"
      aria-labelledby={titleId}
      onClose={() => setTitle("")}
    >
      <form className="quick-capture-form" onSubmit={submitCapture}>
        <div className="capture-heading">
          <div>
            <p className="eyebrow">Quick Capture</p>
            <h2 id={titleId}>What’s on your mind?</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close quick capture"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>

        <label className="capture-field">
          <span className="sr-only">Capture item</span>
          <textarea
            data-capture-input
            rows={1}
            value={title}
            enterKeyHint="done"
            onChange={(event) => setTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              ) {
                return;
              }

              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            placeholder="Write it down and get back to work…"
            maxLength={280}
          />
        </label>

        <div className="capture-footer">
          <p>Saved to Inbox · local only</p>
          <button
            className="capture-submit"
            type="submit"
            disabled={!title.trim()}
          >
            Capture
            <span aria-hidden="true">↵</span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
