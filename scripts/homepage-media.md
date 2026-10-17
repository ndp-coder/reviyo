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

Run `node scripts/create-homepage-visuals.mjs` to regenerate the three SVG screen
illustrations, counter QR and the local QR matrix used by the film. The example
business is fictional. The QR resolves to the Reviyo homepage, not a customer's
review page. Screens describe the flow rather than reproducing Google's UI.

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
