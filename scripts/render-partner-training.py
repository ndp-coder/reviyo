"""Local, captioned partner class. No network services or generated claims.

Run node scripts/prepare-partner-training.mjs, then Windows PowerShell with
scripts/speak-partner-training.ps1, then this script (Pillow + ffmpeg required).
The source script is in partner-training-content.json. Only finished media and
the generated chapter/transcript manifest ship. Captions use System.Speech word
events, not estimated reading times. Do not import this script to render media.
"""
import json
from pathlib import Path
import shutil
import subprocess
import wave
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'output/partner-training'
DEST = ROOT / 'public/media'
W, H = 1280, 720
NAVY, TEAL, INK, MUTED = '#102454', '#008282', '#17243b', '#526178'

@lru_cache(maxsize=None)
def font(size, bold=False):
    return ImageFont.truetype(str(Path('C:/Windows/Fonts') / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)

def wrap(draw, text, size, width, bold=False):
    result = []
    for paragraph in text.split('\n'):
        line = ''
        for word in paragraph.split():
            trial = (line + ' ' + word).strip()
            if draw.textlength(trial, font=font(size, bold)) > width and line:
                result.append(line)
                line = word
            else:
                line = trial
        if line:
            result.append(line)
    return result

def text(draw, value, xy, width, size=30, fill=INK, bold=False, gap=10):
    x, y = xy
    for line in wrap(draw, value, size, width, bold):
        draw.text((x, y), line, font=font(size, bold), fill=fill)
        y += size + gap
    return y

def timecode(seconds, srt=False):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}' + (',' if srt else '.') + f'{ms % 1000:03}'

def render_card(scene, chapter, chapter_index, total, recorded):
    im = Image.new('RGB', (W, H), '#f5f7fb')
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 78), fill=NAVY)
    d.text((48, 18), 'Reviyo', font=font(31, True), fill='white')
    d.text((245, 29), 'Partner training / From conversation to payment', font=font(19), fill='#dce7f3')
    d.text((1130, 29), f'{chapter_index + 1:02} / {total:02}', font=font(20, True), fill='white')
    d.text((54, 113), scene['label'], font=font(23, True), fill=TEAL)
    title_end = text(d, scene['heading'], (50, 157), 1170, 45, INK, True, 6)
    top = max(257, title_end + 27)
    if 'quote' in scene:
        lines = wrap(d, scene['quote'], 33, 1052)
        bottom = top + 45 + len(lines) * 44 + 30
        if bottom > 586:
            raise ValueError('Quote does not fit: ' + scene['heading'])
        d.rounded_rectangle((50, top, 1230, bottom), radius=20, fill='white', outline='#d8e1eb', width=2)
        d.rounded_rectangle((50, top, 57, bottom), radius=3, fill=TEAL)
        text(d, scene['quote'], (89, top + 26), 1052, 33, INK, False, 11)
    else:
        y = top
        for index, point in enumerate(scene['points']):
            lines = wrap(d, point, 30, 1020)
            height = max(66, 21 + len(lines) * 39)
            if y + height > 590:
                raise ValueError('Checklist does not fit: ' + scene['heading'])
            d.rounded_rectangle((50, y, 1230, y + height), radius=14, fill='white', outline='#d8e1eb', width=2)
            d.text((78, y + 16), f'{index + 1:02}', font=font(25, True), fill=TEAL)
            text(d, point, (147, y + 13), 1020, 30, INK, False, 9)
            y += height + 14
    d.text((54, 600), chapter['title'], font=font(19), fill=MUTED)
    d.text((965, 600), f'Recorded {recorded}', font=font(18), fill=MUTED)
    # Leave the lower area clear for two lines of burned-in captions.
    d.rectangle((0, 639, W, H), fill=NAVY)
    return im

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    content = json.loads((WORK / 'content.json').read_text(encoding='utf-8'))
    marks = json.loads((WORK / 'speech-marks.json').read_text(encoding='utf-8-sig'))
    chapters, scenes, cues, fragments = [], [], [], []
    clock = 0.0
    index = 0
    narration = wave.open(str(WORK / 'narration.wav'), 'wb')
    narration.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
    for ci, chapter in enumerate(content['chapters']):
        entry = {'title': chapter['title'], 'start': round(clock, 3), 'scenes': []}
        for si, scene in enumerate(chapter['scenes']):
            with wave.open(str(WORK / f'{index:03}.wav'), 'rb') as audio:
                assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, 16000)
                duration = audio.getnframes() / audio.getframerate()
                narration.writeframes(audio.readframes(audio.getnframes()))
            pause = 0.8 if si == len(chapter['scenes']) - 1 else 0.45
            # Use an exact sample count so captions, video, audio and chapters agree.
            samples = round(pause * 16000)
            pause = samples / 16000
            narration.writeframes(b'\x00\x00' * samples)
            image = WORK / f'{index:03}.png'
            render_card(scene, chapter, ci, len(content['chapters']), content['recorded']).save(image)
            scenes.append((clock, duration + pause, image, ci))
            fragments += [f"file '{image.name}'", f'duration {duration + pause:.6f}']
            speech = marks[index]['marks']
            assert speech and marks[index]['index'] == index, 'Missing speech timestamps'
            assert all(0 <= w['start'] < duration for w in speech), 'Speech events exceed the audio duration; check the voice sample rate'
            group = []
            for wi, word in enumerate(speech):
                # Include the punctuation between this word and the next event.
                next_position = speech[wi + 1]['position'] if wi + 1 < len(speech) else len(scene['narration'])
                value = scene['narration'][word['position']:next_position].strip()
                if not value:
                    continue
                group.append((word['start'], value))
                line = ' '.join(item[1] for item in group)
                if len(group) >= 11 or len(line) >= 85 or value.endswith(('.', '?', '!')) or wi == len(speech) - 1:
                    end = speech[wi + 1]['start'] if wi + 1 < len(speech) else duration
                    if end > group[0][0]:
                        cues.append((clock + group[0][0], clock + end, line))
                    group = []
            if group:
                cues.append((clock + group[0][0], clock + duration, ' '.join(item[1] for item in group)))
            entry['scenes'].append(scene)
            clock += duration + pause
            index += 1
        chapters.append(entry)
    narration.close()
    # Concat demuxer requires the last image to be repeated for its duration.
    fragments.append(f"file '{scenes[-1][2].name}'")
    (WORK / 'slides.ffconcat').write_text('ffconcat version 1.0\n' + '\n'.join(fragments) + '\n', encoding='utf-8')
    (DEST / 'partner-training-en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
        f'{timecode(a)} --> {timecode(b)}\n{line}' for a, b, line in cues) + '\n', encoding='utf-8')
    (WORK / 'captions.srt').write_text('\n\n'.join(
        f'{i + 1}\n{timecode(a, True)} --> {timecode(b, True)}\n{line}' for i, (a, b, line) in enumerate(cues)) + '\n', encoding='utf-8')
    (DEST / 'partner-training-chapters.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
        f'{timecode(c["start"])} --> {timecode(chapters[i + 1]["start"] if i + 1 < len(chapters) else clock)}\n{c["title"]}'
        for i, c in enumerate(chapters)) + '\n', encoding='utf-8')
    manifest = {'title': content['title'], 'recorded': content['recorded'], 'duration': round(clock, 3), 'voice': marks[0]['voice'], 'chapters': chapters}
    (ROOT / 'src/config/partner-training.ts').write_text(
        '// Generated by scripts/render-partner-training.py. Regenerate media and this manifest together.\n'
        + 'export const partnerTraining = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ' as const;\n', encoding='utf-8')
    poster = render_card({'label': 'The complete partner class', 'heading': 'From first conversation to a paid business',
        'points': ['A clear pitch and useful answers to objections', 'Owner invitation, password and secure payment', 'English narration, captions and 15 chapters']},
        {'title': 'Watch, practise and replay any step'}, 0, len(chapters), content['recorded'])
    poster.save(DEST / 'partner-training-poster.jpg', quality=90)
    metadata = [';FFMETADATA1', 'title=Reviyo partner training']
    for i, chapter in enumerate(chapters):
        metadata += ['[CHAPTER]', 'TIMEBASE=1/1000', f'START={round(chapter["start"] * 1000)}',
            f'END={round((chapters[i + 1]["start"] if i + 1 < len(chapters) else clock) * 1000)}', 'title=' + chapter['title']]
    (WORK / 'chapters.ffmeta').write_text('\n'.join(metadata) + '\n', encoding='utf-8')
    command = [shutil.which('ffmpeg'), '-hide_banner', '-loglevel', 'warning', '-y',
        '-f', 'concat', '-safe', '0', '-i', 'slides.ffconcat', '-i', 'narration.wav', '-i', 'chapters.ffmeta',
        '-map', '0:v:0', '-map', '1:a:0', '-map_metadata', '2', '-map_chapters', '2',
        '-vf', "fps=12,subtitles=captions.srt:force_style='FontName=Segoe UI,FontSize=14,PrimaryColour=&HFFFFFF,OutlineColour=&H542410,BorderStyle=1,Outline=0,Shadow=0,MarginV=4,Alignment=2'",
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart', '-t', f'{clock:.6f}', str(DEST / 'partner-training.mp4')]
    print(f'Rendering {clock / 60:.1f} minutes, {len(chapters)} chapters, {len(cues)} caption cues. Voice: {marks[0]["voice"]}', flush=True)
    subprocess.run(command, cwd=WORK, check=True)
    print(f'Finished: {(DEST / "partner-training.mp4").stat().st_size / 1024 / 1024:.1f} MB', flush=True)

if __name__ == '__main__':
    main()
