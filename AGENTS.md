# BLΛIND development and deployment

- Work in the existing checkout. This is a static site; no npm install or build is required.
- Start locally with `python3 -m http.server 8010 --directory .`.
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
