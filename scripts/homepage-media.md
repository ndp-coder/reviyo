# Homepage media

The hero is an illustrative café scene, not a customer photo or endorsement.
It was generated with the built-in image generator and converted to self-hosted
WebP assets at `public/images/home/cafe-counter.webp` and
`public/images/home/cafe-counter-900.webp`. No remote images load on the page.

## Hero image prompt

Use case: photorealistic-natural. Asset type: website editorial hero photograph
for Reviyo, a customer review QR product for local businesses in India. Premium
realistic candid photograph, landscape 3:2. Sunlit independent Indian café
counter, warm espresso wood, brushed stainless coffee equipment, muted teal
ceramics and unobtrusive foliage. An adult Indian café owner in a muted teal
apron welcomes a customer holding a smartphone. Plain blank tabletop display
card, no text, QR, logos, UI, stars or watermarks. Natural window light, everyday
materials, editorial photography. No corporate handshake or glossy 3D styling.

## Product illustrations

The “How it works” section now uses three matching, illustrative café photos:
`process-scan`, `process-draft` and `process-share`, each exported at 720px and
1080px wide as WebP. They show scanning the counter QR, entering real input and
reading an editable draft before opening Google. They are generated scenes,
not real customers, published reviews or exact product screenshots. The images
load lazily and use responsive sources. Prompt details are in
`scripts/homepage-process-image-prompts.json`.

Run `node scripts/create-homepage-visuals.mjs` to regenerate the original SVG
illustrations, the counter QR and the local QR matrix used by the film. The example
business is fictional. The QR resolves to the Reviyo homepage, not a customer's
review page. Screens describe the flow rather than reproducing Google's UI.

## Owner setup photo

The features section uses an illustrative owner setting up the counter card,
exported as `owner-setup-800.webp` and `owner-setup-1200.webp` in the same home
image directory. Its caption labels it as an illustrative scene. The source
prompt is recorded in `scripts/homepage-owner-image-prompt.json`. It is a
generated scene rather than a customer endorsement or a product screenshot.

## Product film

Run `python scripts/render-home-film.py` after generating the illustrations.
Requires the existing local Pillow and ffmpeg installations and Windows
System.Speech. Narration uses the default installed English Windows voice.
No ElevenLabs, media plugins, external voice services or API keys are used.

The script generates the MP4, poster, timed English VTT captions and
`src/config/home-film.ts` transcript together. Word timings come from the voice
engine. Captions are burned into the film for silent viewing as well as supplied
as a native track. Keep the complete text walkthrough available on the page.

The player uses `preload="none"`, no autoplay and a small poster. Playback is a
visitor action. The MP4 uses H.264/AAC with metadata at the start for streaming.
Prices and trial length on the page still come from the app's shared config.
