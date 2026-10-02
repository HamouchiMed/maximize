import { Star } from "lucide-react";

export function StarRating({
  rating,
  reviews,
  size = 14,
}: {
  rating: number;
  reviews?: number;
  size?: number;
}) {
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={
              i < full ? "fill-amber-400 text-amber-400" : "fill-transparent text-border"
            }
          />
        ))}
      </div>
      {reviews != null && (
        <span className="text-xs text-muted">({reviews.toLocaleString()})</span>
      )}
    </div>
  );
}
