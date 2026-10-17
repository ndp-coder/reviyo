"""Render the homepage walkthrough with Pillow, Windows voice and ffmpeg.

Run: python scripts/render-home-film.py
No service, plugin, API key or additional app dependency is used. The narration
is spoken by the installed Windows voice. All business examples are fictional.
"""
from pathlib import Path
from functools import lru_cache
import json
import math
import shutil
import subprocess
import wave
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'output/home-film'
DEST = ROOT / 'public/media'
W, H, FPS = 1280, 720, 15
NAVY, TEAL, MUTED = '#0e2250', '#13665b', '#546174'
SCENES = [
    {'title': 'A simpler way to start', 'heading': 'The visit is real.\nThe words are theirs.', 'kind': 'intro',
     'narration': 'Every visit has a story. Reviyo helps your customers find the words to share theirs, with a simple QR code and an editable review draft.'},
    {'title': 'Scan the code', 'heading': 'One scan.\nNo extra app.', 'kind': 'scan',
     'narration': 'Place your review QR at the counter, on a table, or with a bill. Customers scan with their phone camera to open your page. No app or customer signup is needed.'},
    {'title': 'Describe the visit', 'heading': 'Their experience\nis the starting point.', 'kind': 'topics',
     'narration': 'They choose relevant topics, add their own comment, and give consent for a draft. The prompts help them describe their actual experience. Customers are never filtered by how their visit went.'},
    {'title': 'Read and edit the draft', 'heading': 'A little help\nfinding the words.', 'kind': 'draft',
     'narration': 'Reviyo uses their input to prepare a draft. They read it, correct anything that is not right, and make it sound like themselves. The opinion stays theirs.'},
    {'title': 'Choose what to share', 'heading': 'Their words.\nTheir choice to post.', 'kind': 'post',
     'narration': 'When they are ready, they copy the text and open your Google review page. They choose their stars on Google and post from their own account. Reviyo never posts for them.'},
    {'title': 'Make it part of your day', 'heading': 'Your counter.\nTheir next conversation.', 'kind': 'end',
     'narration': 'As the owner, customise your topics, print your QR, and see where customers stop in the journey. Invite everyone the same way, with no rewards for reviews. Start with a free review QR, or explore Reviyo at reviyo dot in.'},
]

@lru_cache(maxsize=None)
def font(size, bold=False):
    return ImageFont.truetype(str(Path('C:/Windows/Fonts') / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)

def lines(text, size, width, bold=False):
    d = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    result = []
    for para in text.split('\n'):
        line = ''
        for word in para.split():
            trial = (line + ' ' + word).strip()
            if line and d.textlength(trial, font=font(size, bold)) > width:
                result.append(line); line = word
            else:
                line = trial
        if line:
            result.append(line)
    return result

def text(d, value, x, y, size=26, fill=NAVY, bold=False, width=500, gap=10):
    for line in lines(value, size, width, bold):
        d.text((x, y), line, font=font(size, bold), fill=fill)
        y += size + gap
    return y

def rounded(d, box, fill='white', radius=18, outline=None):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)

def qr(d, x, y, size):
    matrix = json.loads((ROOT / 'output/homepage-qr.json').read_text())
    module = size / (matrix['size'] + 6)
    d.rectangle((x, y, x + size, y + size), fill='white')
    for row in range(matrix['size']):
        for col in range(matrix['size']):
            if matrix['cells'][row * matrix['size'] + col]:
                left, top = x + (col + 3) * module, y + (row + 3) * module
                d.rectangle((round(left), round(top), round(left + module), round(top + module)), fill=NAVY)

def ui_base(d):
    rounded(d, (704, 110, 1195, 575), '#ffffff', 22, '#d2dfe1')
    rounded(d, (724, 130, 1175, 163), '#f1f4f7', 10)
    text(d, 'reviyo.in / Your review page', 744, 135, 15, MUTED)
    rounded(d, (735, 190, 775, 230), '#e1efeb', 11)
    text(d, 'K', 748, 193, 24, NAVY, True)
    text(d, 'Kaveri Café', 788, 190, 24, NAVY, True)
    text(d, 'Illustrative example', 788, 221, 14, MUTED)

def button(d, label, y=482):
    rounded(d, (735, y, 1163, y + 54), NAVY, 10)
    size = 22
    length = d.textlength(label, font=font(size, True))
    text(d, label, 949 - length / 2, y + 10, size, 'white', True)

def base(index):
    scene = SCENES[index]
    im = Image.new('RGB', (W, H), '#f5f8f7')
    d = ImageDraw.Draw(im)
    d.rectangle((654, 0, W, 623), fill=['#e1efeb', '#e1efeb', '#e7ebf9', '#e7ebf9', '#f4e5d8', '#e1efeb'][index])
    text(d, 'Reviyo', 55, 29, 37, NAVY, True)
    text(d, 'A review in their own words.', 55, 86, 16, MUTED)
    text(d, scene['title'], 55, 184, 23, TEAL)
    text(d, scene['heading'], 50, 235, 53, NAVY, True, width=580, gap=8)
    description = {
        'intro': 'A QR at your counter. An editable draft on their phone. A review they choose to post.',
        'scan': 'Any phone camera opens your page. No app to install and no account for customers.',
        'topics': 'Relevant topics and their own comment. A draft based on what actually happened.',
        'draft': 'Read, change or discard the draft. The customer controls the final words.',
        'post': 'Copy the draft. Open Google. Choose a rating and post from their own account.',
        'end': 'One business. One location. A simpler way to invite an honest review.',
    }
    text(d, description[scene['kind']], 55, 422, 26, MUTED, width=510, gap=12)
    if scene['kind'] != 'scan':
        ui_base(d)
    else:
        d.ellipse((747, 552, 1170, 586), fill='#c4d9d0')
        rounded(d, (787, 133, 1134, 556), NAVY, 12)
        rounded(d, (775, 119, 1122, 542), 'white', 12)
        text(d, 'Kaveri Café', 845, 155, 29, NAVY, True)
        text(d, 'How was your visit?', 842, 200, 21, MUTED)
        qr(d, 820, 241, 260)
        text(d, 'Scan to share your experience', 818, 509, 17, MUTED)
    d.rectangle((0, 624, W, H), fill=NAVY)
    return im

def stamp(value, srt=False):
    ms = round(value * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}' + (',' if srt else '.') + f'{ms % 1000:03}'

def main():
    WORK.mkdir(parents=True, exist_ok=True); DEST.mkdir(exist_ok=True)
    (WORK / 'content.json').write_text(json.dumps({'chapters': [{'scenes': SCENES}]}), encoding='utf-8')
    subprocess.run(['powershell', '-NoProfile', '-File', str(ROOT / 'scripts/speak-partner-training.ps1'), '-WorkDirectory', 'output/home-film'], check=True)
    marks = json.loads((WORK / 'speech-marks.json').read_text(encoding='utf-8-sig'))
    durations, starts, cues, elapsed = [], [], [], 0.0
    with wave.open(str(WORK / 'narration.wav'), 'wb') as combined:
        combined.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        for i, scene in enumerate(SCENES):
            starts.append(elapsed)
            with wave.open(str(WORK / f'{i:03}.wav')) as audio:
                duration = audio.getnframes() / audio.getframerate()
                combined.writeframes(audio.readframes(audio.getnframes()))
            silence = .6
            combined.writeframes(b'\x00\x00' * round(silence * 16000))
            durations.append(duration + silence)
            words = marks[i]['marks']; group = []
            assert all(0 <= w['start'] < duration for w in words)
            for wi, word in enumerate(words):
                end_position = words[wi + 1]['position'] if wi + 1 < len(words) else len(scene['narration'])
                value = scene['narration'][word['position']:end_position].strip()
                group.append((word['start'], value))
                if len(group) >= 10 or value.endswith(('.', '?', '!')) or wi == len(words) - 1:
                    end = words[wi + 1]['start'] if wi + 1 < len(words) else duration
                    cues.append((elapsed + group[0][0], elapsed + end, ' '.join(w[1] for w in group)))
                    group = []
            elapsed += duration + silence
    (DEST / 'reviyo-product-film-en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{s}' for a, b, s in cues) + '\n', encoding='utf-8')
    (ROOT / 'src/config/home-film.ts').write_text('// Generated with scripts/render-home-film.py. Keep the transcript and video together.\nexport const homeFilm = ' + json.dumps({'duration': round(elapsed, 3), 'scenes': [{'title': s['title'], 'narration': s['narration']} for s in SCENES]}, ensure_ascii=False, indent=2) + ' as const;\n', encoding='utf-8')
    bases = [base(i) for i in range(len(SCENES))]
    def frame(t, poster=False):
        index = max(i for i, start in enumerate(starts) if start <= t)
        scene = SCENES[index]; local = t - starts[index]; progress = min(1, local / max(1, durations[index] - 1))
        im = bases[index].copy(); d = ImageDraw.Draw(im)
        kind = scene['kind']
        if kind == 'scan':
            scan_y = 262 + (math.sin(local * 1.1) + 1) * 103
            d.rectangle((827, scan_y - 12, 1073, scan_y + 12), fill='#e5f4eb')
            d.line((827, scan_y, 1073, scan_y), fill=TEAL, width=3)
        elif kind in ('intro', 'end'):
            text(d, 'Your experience, in your words.', 735, 270, 25, NAVY, True, width=420)
            for j, value in enumerate(['Scan the QR', 'Read and edit a draft', 'Choose whether to post']):
                y = 326 + j * 61
                rounded(d, (735, y, 771, y + 36), TEAL if progress > j * .25 else '#e1efeb', 18)
                text(d, str(j + 1), 748, y + 3, 20, 'white' if progress > j * .25 else NAVY, True)
                text(d, value, 787, y + 2, 23, NAVY)
        elif kind == 'topics':
            text(d, 'What would you like to mention?', 735, 267, 22, NAVY, True, width=430)
            for j, value in enumerate(['Coffee', 'Service', 'Atmosphere']):
                x = 735 + j * 144
                selected = j < 2 and progress > j * .2
                rounded(d, (x, 313, x + 132, 355), NAVY if selected else '#f1f4f7', 21)
                text(d, value, x + 16, 322, 17, 'white' if selected else MUTED)
            rounded(d, (735, 377, 1163, 440), '#f6f7fa', 10)
            comment = 'I stopped in for coffee after work.'
            text(d, comment[:int(len(comment) * min(1, progress * 1.9))], 751, 391, 20, NAVY, width=390)
            button(d, 'Create my draft')
            text(d, 'With the customer’s consent.', 814, 549, 16, MUTED)
        elif kind == 'draft':
            text(d, 'Make it sound like you', 735, 267, 27, NAVY, True)
            rounded(d, (735, 317, 1163, 457), '#f6f7fa', 12)
            example = 'I stopped in for coffee after work. The staff helped me choose something to order.'
            typed = example[:int(len(example) * min(1, progress * 2))]
            text(d, typed, 753, 334, 23, NAVY, width=385, gap=10)
            button(d, 'Copy & open Google')
            text(d, 'Edit or discard. The choice is yours.', 789, 550, 16, MUTED)
        elif kind == 'post':
            text(d, 'Ready to share?', 735, 270, 30, NAVY, True)
            for j, label in enumerate(['Copy your words', 'Choose your stars on Google', 'Decide whether to post']):
                y = 327 + j * 60
                rounded(d, (735, y, 771, y + 36), '#e1efeb', 18)
                text(d, str(j + 1), 747, y + 3, 20, TEAL, True)
                text(d, label, 785, y + 4, 21, NAVY, width=380)
            text(d, 'You post. Reviyo never posts for you.', 765, 543, 17, MUTED)
        d.rectangle((0, 620, round(W * min(1, t / elapsed)), 624), fill='#58bfa4')
        if not poster:
            cue = next((line for a, b, line in cues if a <= t < b), '')
            wrapped = lines(cue, 25, 1170)
            for j, line in enumerate(wrapped):
                length = d.textlength(line, font=font(25))
                d.text(((W - length) / 2, 649 + j * 31), line, font=font(25), fill='white')
        return im
    poster = frame(starts[3] + durations[3] * .65, True)
    poster.save(DEST / 'reviyo-product-film-poster.jpg', quality=90)
    ffmpeg = [shutil.which('ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', str(WORK / 'narration.wav'), '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart', '-t', str(elapsed), str(DEST / 'reviyo-product-film.mp4')]
    print(f'Rendering {elapsed:.1f}s with the default local voice, 6 animated scenes and {len(cues)} captions.', flush=True)
    process = subprocess.Popen(ffmpeg, stdin=subprocess.PIPE)
    try:
        for i in range(math.ceil(elapsed * FPS)):
            process.stdin.write(frame(i / FPS).tobytes())
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('Video encoding failed')
    except BaseException:
        process.kill(); process.wait(); raise
    print('Finished local product film.', flush=True)

if __name__ == '__main__':
    main()
