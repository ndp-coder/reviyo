# Homepage presentation

The homepage uses a white/navy palette, system sans-serif typography and a
restrained yellow accent. The QR card, customer input and editable draft are
built in HTML/CSS, so the product is visible without generated people photos,
remote image downloads or additional UI/animation libraries.

`HomeReviewDemo` is an interactive, local example with a fictional business and
prewritten text. Visitors can step through the flow and edit the sample. It
never requests an AI draft, records customer input or opens a Google posting
session. Its QR code explicitly opens reviyo.in rather than a business page.
The accompanying three illustrations explain the same customer flow.

The owner section describes available tools without inventing live account
statistics. Pricing uses `src/config/plans.ts`; trial length uses the legal
configuration. The FAQ remains shared with the search structured data.

## Existing media

Earlier illustrative café/owner photos remain in `public/images/home` for
history but are no longer rendered by the homepage. Their source prompts are
recorded in `homepage-process-image-prompts.json` and
`homepage-owner-image-prompt.json`. They are generated illustrations, not
customer photos or endorsements.

Run `node scripts/create-homepage-visuals.mjs` to regenerate the original SVG
illustrations, the counter QR and local QR matrix used by the film.

## Product film

Run `python scripts/render-home-film.py` after generating the illustrations.
Requires the existing local Pillow and ffmpeg installations and Windows
System.Speech. Narration uses the default installed English Windows voice.
No ElevenLabs, media plugins, external voice services or API keys are used.

The script generates the MP4, poster, timed English VTT captions and
`src/config/home-film.ts` transcript together. Word timings come from the voice
engine. Captions are burned into the film for silent viewing and supplied as
a native track. The complete text walkthrough remains available on the page.

The player uses `preload="none"` with playback on visitor request. The MP4 uses
H.264/AAC with metadata at the start for streaming.
