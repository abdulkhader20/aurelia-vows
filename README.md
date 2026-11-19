# Aurelia Vows

Premium digital wedding invitation collection. The site includes the original Bindu & Balu invitation demo.

## Local preview

Requires Node.js 18+. Run `npm start` and open http://localhost:3000. Or open `outputs/index.html` for a static preview (the review API is then unavailable).

## Vercel reviews setup

The review function uses an Upstash Redis database because Vercel functions do not have persistent local disk. Add an Upstash Redis store through the Vercel Marketplace. Confirm the project receives `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Set `REVIEW_ADMIN_KEY` to a private, long random value. Pending reviews remain hidden from the public list until approved.

Review administration: `GET /api/reviews?status=pending` with `Authorization: Bearer <REVIEW_ADMIN_KEY>`, then `POST /api/reviews/<id>/approve` or `/reject` with the same header. Never commit secrets. Submissions require customer publishing permission; no testimonials are seeded.

## Deploy

Connect the GitHub repository to Vercel with the project root as the root directory. No build step or output directory is needed; Vercel serves `index.html` and the `/api/reviews` function.

Bindu & Balu’s demo is adapted from the existing wedding-invitation project; its background music is streamed from that project’s public GitHub asset.