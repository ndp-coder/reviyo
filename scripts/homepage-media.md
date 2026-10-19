# Homepage presentation

The homepage opens on a deep navy canvas (`#0c2545`) with white text and a
mint action colour (`#68e1cb`). White sections, ink (`#10284b`), muted body text
(`#52647b`) and pale blue surfaces (`#f3f7fa`) complete the palette. Typography
uses the existing self-hosted Poppins family; no additional font or UI library
is loaded.

The centred opening leads into one wide product canvas: a QR stand beside an
editable customer review. On phones, the stand is available in the Scan step
and the editable review occupies the full panel width. The locally built scene
is labelled as an example and never submits a review or requests an AI draft.
The QR explicitly opens reviyo.in. Edits survive step changes and can be reset.

The customer process is explained once, followed by the Telugu walkthrough,
the counter-card preview, pricing, setup help and FAQs. Industry and guide
links are grouped into a compact resource section. No customer endorsements,
review statistics or live dashboard figures are invented.

`HomeCounterCardPreview` renders the same `ReviewCounterCard` used by the owner
dashboard, with the print-only class excluded. Pricing and business details
remain sourced from their shared configuration. FAQ content stays shared with
the search structured data. Existing setup assistance and signup disclosures
remain available.

The QR stand has one brief scan sweep that stops after two passes.
All controls remain keyboard accessible, focus is visible, motion is disabled
for reduced-motion preferences, and the product film loads only on request.

## Existing media

Earlier illustrative café/owner photos remain in `public/images/home` for
history but are no longer rendered by the homepage. Their source prompts are
recorded in `homepage-process-image-prompts.json` and
`homepage-owner-image-prompt.json`. They are generated illustrations, not
customer photos or endorsements.

Run `node scripts/create-homepage-visuals.mjs` to regenerate the original SVG
illustrations, the counter QR and local QR matrix used by the film.

## Product film

The current website walkthrough uses the Telugu MP3 supplied by the user,
saved as `public/media/reviyo-product-narration-te.mp3`. It replaces the desktop
English voice in the published walkthrough. No ElevenLabs API or media plugin
is called by the build.

Rebuild with `python scripts/render-home-film.py --telugu` after running
`node scripts/create-homepage-visuals.mjs` if the local QR matrix is absent.
The renderer uses the existing local Pillow and ffmpeg installations.

`scripts/home-film-telugu.json` aligns sentence captions and six scene changes
with pauses in the supplied recording. The renderer checks that cues are
ordered, within the correct scene and within the recording. The original
voice speed and complete audio duration are preserved. Example drafts keep
the same facts as the sample customer input.

The Telugu MP4, poster and English/Telugu WebVTT tracks have separate filenames
so cached English video files cannot replace the new narration. English
captions are selected initially; visitors can select Telugu or turn captions
off in native video controls. This version does not burn text into the video,
so captions are not displayed twice. Both language transcripts are available
below the player. Duration and media paths come from the generated
`src/config/home-film.ts`.

The player uses `preload="none"` with playback on visitor request. The MP4 uses
H.264/AAC with metadata at the start for streaming.

Running the renderer without `--telugu` still builds the original local Windows
English voice version. It overwrites the active film configuration, so use the
Telugu command for the current production website.
## Demo and setup journey

The customer example opens on the editable draft, including its source note,
so visitors see the product's writing assistance immediately. Edits survive
step changes; Reset sample restores the original text. Nothing is posted or
sent from the example.

`HomeCounterCardPreview` renders `ReviewCounterCard`, the same component used
by QR Management in the authenticated dashboard. The public example excludes
the dashboard's print-only class and labels its QR destination. Business-name
edits remain in component state and are not submitted or stored.

`SetupSupportLinks` reads phone and email destinations from the legal config.
The homepage's help actions jump directly to these choices. The page explains
account creation, business setup, the refundable AutoPay check, trial billing
and cancellation before signup. Signup repeats the same explanation and offers
support without changing authentication, consent or payment behavior.

Public marketing navigation can supply its account action label while existing
pages retain their default. Pricing and FAQ data still come from shared config.
