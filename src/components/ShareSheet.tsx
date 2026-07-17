import { useState } from "react";
import { X, Share2, Copy, Download, Check, Loader2 } from "lucide-react";
import { downloadBlob, copyText, canShareFiles, canShareText } from "@/lib/share";

export function ShareSheet({
  open,
  onClose,
  imageBlob,
  imageUrl,
  shareUrl,
  dishName,
  restaurantName,
}: {
  open: boolean;
  onClose: () => void;
  imageBlob: Blob | null;
  imageUrl: string | null;
  shareUrl: string;
  dishName: string;
  restaurantName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!open) return null;

  const fileName = `${dishName}.png`.replace(/[^\w.\-]+/g, "-");

  async function handleShare() {
    setShareError(null);
    setSharing(true);
    try {
      if (imageBlob) {
        const file = new File([imageBlob], fileName, { type: "image/png" });
        if (canShareFiles(file)) {
          await navigator.share({
            files: [file],
            title: `${dishName} — ${restaurantName}`,
            text: `${dishName} at ${restaurantName}, via Fuelo`,
          });
          setSharing(false);
          return;
        }
      }
      if (canShareText()) {
        await navigator.share({
          title: `${dishName} — ${restaurantName}`,
          text: `${dishName} at ${restaurantName}, via Fuelo`,
          url: shareUrl,
        });
        setSharing(false);
        return;
      }
      const ok = await copyText(shareUrl);
      setCopied(ok);
      if (!ok) setShareError("Couldn't share — try Copy link or Download instead.");
    } catch (err) {
      // AbortError = the user closed the native share sheet — not an error.
      if ((err as Error)?.name !== "AbortError") {
        setShareError("Couldn't share — try Copy link or Download instead.");
      }
    }
    setSharing(false);
  }

  async function handleCopy() {
    const ok = await copyText(shareUrl);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (imageBlob) downloadBlob(imageBlob, fileName);
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close share"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-sm sm:rounded-3xl">
        <div className="border-b border-border bg-background px-5 pb-3 pt-4">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Share this dish</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto px-5 py-4">
          <div className="overflow-hidden rounded-2xl shadow-[var(--shadow-card)]">
            {imageUrl ? (
              <img src={imageUrl} alt={`${dishName} share card`} className="block w-full" />
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center bg-secondary">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2">
            <button
              onClick={handleShare}
              disabled={sharing || !imageBlob}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              Share
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-medium text-secondary-foreground transition hover:bg-accent"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                onClick={handleDownload}
                disabled={!imageBlob}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-medium text-secondary-foreground transition hover:bg-accent disabled:opacity-60"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
            {shareError && <p className="text-center text-xs text-destructive">{shareError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
