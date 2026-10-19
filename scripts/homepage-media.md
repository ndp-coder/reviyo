# Homepage presentation

The homepage layout is restored from commit `464519f`, including the cafe
hero, three review-step images and owner setup photo. These are illustrative
scenes, not customer endorsements. Responsive WebP sources, lazy loading for
lower images, shared plan prices and legal configuration remain in use.

The Telugu walkthrough and its current player are preserved. Later
interactive demo components remain available in source but are not rendered
on this restored homepage.

## Images

The images live in `public/images/home`. Their prompts are recorded in
`homepage-process-image-prompts.json` and `homepage-owner-image-prompt.json`.

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
