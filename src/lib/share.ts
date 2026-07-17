// Small platform helpers for the Share feature — link building and feature
// detection for the Web Share API, kept separate from the canvas rendering
// in shareCard.ts.

/** The dish's shareable link: the restaurant page, deep-linked to the dish so
 *  the recipient lands scrolled to (and briefly highlighting) the right item.
 *  See restaurants.$id.tsx's validateSearch + scroll-to-dish effect. */
export function buildDishShareUrl(restaurantId: string, dishId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/restaurants/${restaurantId}?dish=${dishId}`;
}

export function canShareFiles(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare({ files: [file] })
  );
}

export function canShareText(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
