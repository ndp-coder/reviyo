"""Render the partner training film from narrated audio and word timestamps.

Usage: python scripts/render-partner-walkthrough.py
Requires Pillow and ffmpeg/ffprobe. Inputs are in output/partner-walkthrough;
only the finished MP4, JPEG and VTT in public/media ship with the application.
All examples are fictional; no customer or payout details enter this film.
"""
import json
import math
from functools import lru_cache
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'output/partner-walkthrough'
DEST = ROOT / 'public/media'
DEST.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1280, 720, 24
NAVY, TEAL, INK, MUTED = '#102454', '#008b8b', '#182337', '#58677b'
FONT = Path('C:/Windows/Fonts')
@lru_cache(maxsize=None)
def font(size, bold=False):
    return ImageFont.truetype(str(FONT / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)

words = json.loads((WORK / 'words.json').read_text(encoding='utf-8'))
duration = float(subprocess.check_output([shutil.which('ffprobe'), '-v', 'error', '-show_entries',
    'format=duration', '-of', 'default=nw=1:nk=1', str(WORK / 'narration.mp3')]))

# Keep captions short, aligned with the measured speech, and away from controls.
cues, group = [], []
for word in words:
    if word.get('type') != 'word':
        continue
    group.append(word)
    if len(group) >= 9 or word['text'].endswith(('.', '?', '!')):
        cues.append([group[0]['start'], group[-1]['end'], ' '.join(w['text'] for w in group)])
        group = []
if group:
    cues.append([group[0]['start'], group[-1]['end'], ' '.join(w['text'] for w in group)])
def stamp(t):
    ms = round(t * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'
(DEST / 'partner-walkthrough-en.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(
    f'{stamp(a)} --> {stamp(b)}\n{line}' for a,b,line in cues) + '\n', encoding='utf-8')

scenes = [
    (0, 'A simple start for every owner', 'Partner walkthrough', 'intro'),
    (4.55, 'Join your private dashboard', '01 / Set your password', 'password'),
    (11.25, 'Use the owner’s own email', '02 / Enter business details', 'details'),
    (21.04, 'Prepare their review page', '03 / Add the finishing touches', 'review'),
    (30.54, 'Save, check and invite', '04 / Send the owner invitation', 'invite'),
    (38.46, 'The owner reviews and pays', '05 / Owner completes setup', 'payment'),
    (49.84, 'Payment confirmed. QR ready.', '06 / Download and start', 'qr'),
    (60.26, 'Real experiences. Their words.', '07 / Customers write and post', 'customer'),
    (68.72, 'Track your earnings', '08 / Set up automatic payouts', 'earnings'),
    (85.68, 'You prepare. The owner controls.', 'Ready to help your first owner?', 'end'),
]

def wrap(draw, text, f, width):
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=f) > width and line:
            lines.append(line); line=word
        else:
            line=trial
    if line:
        lines.append(line)
    return lines

def multi(draw, text, xy, width, size=28, fill=INK, bold=False, spacing=10):
    x,y=xy; f=font(size,bold)
    for line in wrap(draw,text,f,width):
        draw.text((x,y),line,font=f,fill=fill);y+=size+spacing
    return y

def card(draw, box, fill='white', outline='#dce3e8'):
    draw.rounded_rectangle(box, radius=20, fill=fill, outline=outline, width=2)

def button(draw, label, xy, width=300, secondary=False):
    x,y=xy;card(draw,(x,y,x+width,y+52), '#f1f5f9' if secondary else NAVY)
    f=font(21,True); length=draw.textlength(label,font=f)
    draw.text((x+(width-length)/2,y+11),label,font=f,fill=INK if secondary else 'white')

def field(draw, label, value, y, active=False):
    draw.text((650,y),label,font=font(18),fill=MUTED)
    draw.rounded_rectangle((650,y+30,1160,y+83),radius=10,fill='#f8fafc',outline=TEAL if active else '#dce3e8',width=2)
    draw.text((666,y+40),value,font=font(23),fill=INK)

def tick(draw, label, y, checked=True):
    draw.rounded_rectangle((650,y,673,y+23),radius=5,fill=TEAL if checked else 'white',outline=TEAL,width=2)
    if checked:
        draw.line((656,y+12,661,y+17,669,y+6),fill='white',width=3)
    multi(draw,label,(690,y-1),450,21)

def base(index):
    _,title,kicker,kind=scenes[index]
    im=Image.new('RGB',(W,H),'#f4f7f7');d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,82),fill='white')
    d.text((52,17),'Reviyo',font=font(34,True),fill=NAVY)
    d.text((970,29),'Partner guide  /  English',font=font(18),fill=MUTED)
    d.text((55,132),kicker,font=font(21,True),fill=TEAL)
    multi(d,title,(55,179),505,49,INK,True,8)
    descriptions={
        'intro':'Prepare a business setup. Invite the owner. Let them review, pay and start.',
        'password':'Accept the developer invitation, then create and confirm your password.',
        'details':'Check the email carefully. The owner uses it to sign in and pay.',
        'review':'Use the business’s real Google review link and relevant review topics.',
        'invite':'A saved setup can be edited. Send or resend the invitation when it is ready.',
        'payment':'The owner checks their details and accepts the terms themselves. No free trial.',
        'qr':'The owner gets their QR after confirmed payment. Never pay twice for a delayed confirmation.',
        'customer':'Customers describe a genuine experience, edit the draft and post it themselves.',
        'earnings':'Only qualifying annual payments count. Refunds and disputes are checked.',
        'end':'Your partner dashboard has saved setups, referrals, earnings and payout details.',
    }
    multi(d,descriptions[kind],(55,345),495,27,MUTED)
    card(d,(620,130,1195,567))
    d.text((650,157),{
        'intro':'From setup to first scan','password':'Create your partner password',
        'details':'Set up a business for an owner','review':'Review page details','invite':'Check before sending',
        'payment':'Owner’s next steps','qr':'Your QR code','customer':'The customer stays in control',
        'earnings':'How earnings work','end':'Start in your partner dashboard',
    }[kind],font=font(25,True),fill=INK)
    d.text((55,538),'reviyo.in  /  Private partner dashboard',font=font(18),fill=MUTED)
    return im

bases=[base(i) for i in range(len(scenes))]

def frame(t, poster=False):
    index=max(i for i,s in enumerate(scenes) if s[0]<=t)
    _,_,_,kind=scenes[index];local=t-scenes[index][0]
    im=bases[index].copy();d=ImageDraw.Draw(im)
    if kind in ('intro','end'):
        labels=['Prepare the business','Invite the owner','Owner reviews and pays','Download QR and start']
        for j,label in enumerate(labels):
            y=220+j*73;active=local>j*.55
            d.ellipse((650,y,689,y+39),fill=TEAL if active else '#e4ecee')
            d.text((662,y+4),str(j+1),font=font(22,True),fill='white' if active else MUTED)
            d.text((709,y+4),label,font=font(24,True),fill=INK)
    elif kind=='password':
        field(d,'Invited email','partner@example.in',210)
        field(d,'New password','•'*min(12,max(0,int(local*3))),316,True)
        field(d,'Confirm password','•'*min(12,max(0,int((local-1.6)*3))),422)
        button(d,'Create password and continue',(650,519),510)
    elif kind=='details':
        value='owner@example.in';field(d,'Owner email',value[:max(0,min(len(value),int(local*8)))],211,True)
        field(d,'Business name','Example salon',318)
        field(d,'Category','Salon',425)
    elif kind=='review':
        field(d,'Google review link','Owner’s Google Business Profile link',210)
        field(d,'Business logo (optional)','Logo selected',316)
        d.text((650,427),'Review topics',font=font(18),fill=MUTED)
        for j,label in enumerate(['Service','Staff','Atmosphere']):
            x=650+j*166;card(d,(x,463,x+151,511),'#eef8f7',TEAL)
            d.text((x+15,475),label,font=font(19),fill=TEAL)
    elif kind=='invite':
        tick(d,'Owner email checked',226)
        tick(d,'Business details checked',280)
        tick(d,'Google link tested',334)
        button(d,'Save without sending',(650,402),510,True)
        button(d,'Save and invite owner',(650,475),510)
    elif kind=='payment':
        tick(d,'Create your own account password',218,local>0.5)
        tick(d,'Review and edit business details',275,local>1)
        tick(d,'Owner accepts the terms',332,local>3)
        tick(d,'Choose a plan and pay via Razorpay',389,local>5)
        card(d,(650,465,1160,526),'#eff8f6',TEAL)
        d.text((673,477),'Paid plan required · No free trial',font=font(23,True),fill=TEAL)
    elif kind=='qr':
        d.text((650,224),'1. Confirm payment',font=font(28,True),fill=TEAL)
        d.text((650,279),'2. Download your QR',font=font(28,True),fill=INK)
        d.text((650,334),'3. Put it on the counter',font=font(28,True),fill=INK)
        button(d,'Check payment status',(650,424),510,True)
        d.text((650,500),'Confirmation delayed? Check, don’t pay again.',font=font(20),fill=MUTED)
    elif kind=='customer':
        labels=['Scan the business QR','Describe the real experience','Edit the review draft','Post on Google themselves']
        for j,label in enumerate(labels):
            y=227+j*72;d.text((650,y),f'{j+1:02}',font=font(26,True),fill=TEAL)
            d.text((710,y),label,font=font(24,True),fill=INK)
    elif kind=='earnings':
        multi(d,'₹1,000 per qualifying owner',(650,226),510,29,INK,True)
        multi(d,'Annual payment · 14-day payment check',(650,271),510,22,MUTED)
        multi(d,'₹2,000 bonus at every 10',(650,335),510,29,INK,True)
        multi(d,'Monthly and six-month: no commission',(650,382),510,21,MUTED)
        button(d,'Save payout bank account',(650,472),510)
    # A moving progress bar and restrained highlight make the pacing clear.
    d.rounded_rectangle((55,588,1225,594),radius=3,fill='#dce6e6')
    d.rounded_rectangle((55,588,55+max(2,1170*t/duration),594),radius=3,fill=TEAL)
    if not poster:
        line=next((line for a,b,line in cues if a<=t<=b),'')
        if line:
            lines=wrap(d,line,font(28,True),1160)
            for j,l in enumerate(lines):
                size=d.textlength(l,font=font(28,True))
                d.rounded_rectangle(((W-size)/2-16,619+j*40,(W+size)/2+16,658+j*40),radius=9,fill=NAVY)
                d.text(((W-size)/2,619+j*40),l,font=font(28,True),fill='white')
    else:
        d.text((55,630),'90 seconds  /  English narration + captions',font=font(22,True),fill=INK)
    return im

frame(2,True).save(DEST/'partner-walkthrough-poster.jpg',quality=90)
command=[shutil.which('ffmpeg'),'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24',
    '-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(WORK/'narration.mp3'),
    '-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k',
    '-movflags','+faststart','-shortest',str(DEST/'partner-walkthrough.mp4')]
proc=subprocess.Popen(command,stdin=subprocess.PIPE)
try:
    for i in range(math.ceil(duration*FPS)):
        proc.stdin.write(frame(i/FPS).tobytes())
finally:
    proc.stdin.close()
if proc.wait()!=0:
    raise SystemExit('Video encoding failed')
print(f'Rendered {duration:.2f}s video: {(DEST/"partner-walkthrough.mp4").stat().st_size/1048576:.2f} MB')
