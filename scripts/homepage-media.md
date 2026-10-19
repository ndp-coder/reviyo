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
