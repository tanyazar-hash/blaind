# BLΛIND development and deployment

- Work in the existing checkout. Public pages retain their static design; ARENA administration uses Node server functions and Supabase. Run `npm ci` and `npm run build`.
- Start locally with `npm run dev` (port 8020) for API support. Follow `ADMIN_SETUP.md` for Supabase Auth and RLS. Never bypass admin RLS with a service-role key; use the signed-in user JWT. Run `npm test`; never commit environment files or credentials.
- `index.html`, `design.css`, and `experience.js` define the page and continuous scroll choreography.
- `model.js` renders the original `shakhmatnaya-figura.glb` through locally vendored Three.js 0.170.0. Keep the GLB and third-party license intact. Never show a substitute CSS chip during loading. Show the club logo only if WebGL or model loading fails.
- Verify desktop and mobile rendering, actual GLB load, navigation, scroll through all sections, reduced motion, and WebGL failure logo fallback. Check browser page errors.
- The user wants completed website changes published to the existing Vercel site through GitHub main: https://blaind-tanyazar-hashs-projects.vercel.app/
- Fetch current main and preserve remote changes before publishing. Run relevant checks, commit, and push normally to main; never force-push. The Vercel Git integration must use this repository and main as its production branch.
- A successful Git push is not proof of a successful Vercel deployment. Check deployment status or the served files when access is available, and report verification limits plainly.
- Vercel authorization and network access are needed to change Vercel project settings; do not request tokens in chat.

- Use the Cyrillic name «Блаинд» and assets/club-logo.svg consistently. Keep the compact contact section, fixed chapter poses, and post-load fall from above. Respect reduced motion and restored scroll position.

- Chapter changes trigger smooth time-based transitions; never bind the chip transform directly to scroll progress or cursor movement. Keep it still once each transition settles.

- The user means fine monochrome film grain and a slightly aged texture when asking for «виньетка». Use assets/grain.svg; avoid radial pools of light and heavy edge darkening. Keep section spacing compact so fixed chip poses do not linger too long.

- Keep the grain layer below the 3D scene: texture belongs to the background; the chip and its logo must stay sharp and free of grain overlays.

- Public header/footer are generated from `shared/header.html` and `shared/footer.html` by `scripts/site-components.mjs` during `npm run build`. Change the templates, not each copy independently; include regenerated public-page HTML in the commit. `shared/site.css` and `shared/site.js` own common sizing, navigation, reveal motion and home accordions.
- ARENA hero is static/read-only. Admin has Players and Tournaments only. Keep legacy hero fields in stored documents; do not restore the hero write endpoint. The two public totals and schedule share `arena/tournaments.js` and the existing Supabase snapshot. Optional JSONB `status`/`endsAt` fields do not require changing Auth or RLS.
