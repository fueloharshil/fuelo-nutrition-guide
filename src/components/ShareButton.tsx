import { useEffect, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { renderShareCard, type ShareCardInput } from "@/lib/shareCard";
import { buildDishShareUrl } from "@/lib/share";
import { ShareSheet } from "@/components/ShareSheet";

export function ShareButton({
  input,
  restaurantId,
  dishId,
}: {
  input: ShareCardInput;
  restaurantId: string;
  dishId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function handleClick() {
    setOpen(true);
    if (blob) return; // already generated for this dish
    setLoading(true);
    try {
      const generated = await renderShareCard(input);
      setBlob(generated);
      setImageUrl(URL.createObjectURL(generated));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Share this dish"
        className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent active:scale-[0.98]"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      </button>
      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        imageBlob={blob}
        imageUrl={imageUrl}
        shareUrl={buildDishShareUrl(restaurantId, dishId)}
        dishName={input.dishName}
        restaurantName={input.restaurantName}
      />
    </>
  );
}
