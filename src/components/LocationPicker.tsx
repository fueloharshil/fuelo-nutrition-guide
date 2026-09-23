import { useEffect, useState } from "react";
import { X, MapPin, LocateFixed, Loader2, Search } from "lucide-react";
import { searchPlaces, type GeocodeResult } from "@/lib/geocoding";

// Lets Discover be browsed from anywhere, not just wherever the device's GPS
// says it is — search an address/place and it becomes the origin for the
// map, "near you" centering, and the travel-time filter, same as real GPS
// would. See effectiveLocation in routes/index.tsx.
export function LocationPicker({
  open,
  onClose,
  onSelect,
  onUseCurrentLocation,
  hasGps,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (result: GeocodeResult) => void;
  onUseCurrentLocation: () => void;
  hasGps: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setError(null);
  }, [open]);

  // Debounced search-as-you-type — waits for a pause in typing rather than
  // firing a Mapbox request on every keystroke.
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const found = await searchPlaces(query);
      setLoading(false);
      if (found === null) {
        setError("Couldn't search right now. Try again.");
        setResults([]);
      } else {
        setError(null);
        setResults(found);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div className="relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-sm sm:rounded-3xl">
        <div className="border-b border-border bg-background px-5 pb-3 pt-4">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
              <MapPin className="h-4 w-4 text-primary" /> Set location
            </h2>
            <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {hasGps && (
            <button
              onClick={() => {
                onUseCurrentLocation();
                onClose();
              }}
              className="mb-3 inline-flex h-11 w-full items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              <LocateFixed className="h-4 w-4" /> Use my current location
            </button>
          )}

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city, area, or address"
              className="w-full h-12 rounded-2xl bg-secondary pl-11 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-3">
            {loading && (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!loading && error && <p className="py-3 text-sm text-destructive">{error}</p>}
            {!loading && !error && query.trim().length >= 3 && results.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">No places found.</p>
            )}
            {!loading && results.length > 0 && (
              <ul className="grid gap-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        onSelect(r);
                        onClose();
                      }}
                      className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent transition"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
                      <span>{r.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
