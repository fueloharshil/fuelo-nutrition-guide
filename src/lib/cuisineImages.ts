// Background photos for the "Trending near you" cuisine tiles. Each URL is a
// verified Unsplash photo (checked to resolve as a real image before being
// added here — see CLAUDE.md). Width/crop/quality are requested via Unsplash's
// imgix query params at render time, not baked into these base URLs.
//
// Cuisines not listed here simply have no photo — the tile component falls
// back to the on-brand green gradient. That's expected: this covers the most
// common tags, not the full 45-tag taxonomy.
export const CUISINE_IMAGES: Record<string, string> = {
  Turkish: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",
  "Middle Eastern": "https://images.unsplash.com/photo-1748540459503-19efc015143b",
  Brunch: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0",
  Breakfast: "https://images.unsplash.com/photo-1541329351076-600b0f9fdf28",
  Healthy: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  Vegan: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  Vegetarian: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  British: "https://images.unsplash.com/photo-1635897411141-7bd2b9c6ab16",
  "BBQ & Grill": "https://images.unsplash.com/photo-1508615263227-c5d58c1e5821",
  Persian: "https://images.unsplash.com/photo-1534939561126-855b8675edd7",
  Mediterranean: "https://images.unsplash.com/photo-1783455442171-16dbde079c53",
  Greek: "https://images.unsplash.com/photo-1783455442171-16dbde079c53",
  European: "https://images.unsplash.com/photo-1783455442171-16dbde079c53",
  Italian: "https://images.unsplash.com/photo-1498579150354-977475b7ea0b",
  Pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
  Japanese: "https://images.unsplash.com/photo-1553621042-f6e147245754",
  Indian: "https://images.unsplash.com/photo-1565557623262-b51c2513a641",
  Chinese: "https://images.unsplash.com/photo-1523905330026-b8bd1f5f320e",
  Mexican: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47",
  "Coffee & Café": "https://images.unsplash.com/photo-1760175445000-0e01e193d1cd",
  Bakery: "https://images.unsplash.com/photo-1608198093002-ad4e005484ec",
  Dessert: "https://images.unsplash.com/photo-1517427294546-5aa121f68e8a",
  Seafood: "https://images.unsplash.com/photo-1595579547936-c3a0e6c171fc",
  Burgers: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9",
  Chicken: "https://images.unsplash.com/photo-1742936401708-dd1b132f06db",
};

/** Build a sized/cropped Unsplash delivery URL for a tile. */
export function cuisineImageUrl(baseUrl: string, width: number, height: number): string {
  return `${baseUrl}?auto=format&fit=crop&w=${width}&h=${height}&q=60`;
}
