import { useRef, useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { partnerTraining } from '@/config/partner-training';
import { formatRupees, PLAN_ORDER, PLANS, planTerm } from '@/config/plans';
import { legal } from '@/config/legal';

function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function PartnerTraining() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [failed, setFailed] = useState(false);
  const [playNotice, setPlayNotice] = useState(false);

  function updateChapter() {
    const currentTime = videoRef.current?.currentTime ?? 0;
    const index = partnerTraining.chapters.findIndex((chapter, i) => currentTime >= chapter.start
      && (i === partnerTraining.chapters.length - 1 || currentTime < partnerTraining.chapters[i + 1].start));
    setActiveChapter(Math.max(0, index));
  }

  function play() {
    const video = videoRef.current;
    if (!video) return;
    setPlayNotice(false);
    void video.play().catch((error: unknown) => {
      // A second chapter click can interrupt the previous play request.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setPlayNotice(true);
    });
  }

  function jump(index: number) {
    const video = videoRef.current;
    if (!video) return;
    pendingSeek.current = partnerTraining.chapters[index].start;
    setActiveChapter(index);
    if (video.readyState > 0) {
      video.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    }
    // play() loads metadata if needed. Keep the latest requested chapter until
    // metadata arrives, so a quick click or slow connection cannot lose it.
    play();
  }

  return <Card className="mt-6 overflow-hidden">
    <div className="p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Your partner training class</p>
      <h2 id="partner-training-title" className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">From first conversation to a paid business</h2>
      <p id="partner-training-description" className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">A {Math.round(partnerTraining.duration / 60)}-minute class with English narration and captions. Learn what to say, how to answer objections, and how to guide an owner through their invitation, password and payment. Watch at your own pace or choose a chapter below.</p>
    </div>
    <video ref={videoRef} aria-labelledby="partner-training-title" aria-describedby="partner-training-description"
      controls playsInline preload="metadata" poster="/media/partner-training-poster.jpg"
      className="aspect-video w-full bg-brand-900" onTimeUpdate={updateChapter} onSeeked={updateChapter}
      onLoadedMetadata={() => {
        const video = videoRef.current;
        if (video && pendingSeek.current !== null) {
          video.currentTime = pendingSeek.current;
          pendingSeek.current = null;
        }
      }} onError={() => setFailed(true)} onCanPlay={() => setFailed(false)}>
      <source src="/media/partner-training.mp4" type="video/mp4" onError={() => setFailed(true)} />
      <track kind="captions" src="/media/partner-training-en.vtt" srcLang="en" label="English" />
      <track kind="chapters" src="/media/partner-training-chapters.vtt" srcLang="en" label="Training chapters" />
      Your browser cannot play this video. Read the full class below.
    </video>
    <div className="space-y-6 p-5 sm:p-7">
      {failed && <Alert variant="warning" action={<Button variant="outline" size="sm" onClick={() => {
        const video = videoRef.current;
        if (video) { pendingSeek.current = video.currentTime; video.load(); }
        setPlayNotice(false);
      }}>Retry video</Button>}>The video could not load. You can still read every lesson below, or <a href="/media/partner-training.mp4" className="underline">open the video directly</a>.</Alert>}
      {playNotice && !failed && <p role="status" className="text-sm text-gray-600">Press play on the video to continue from your selected chapter.</p>}
      <section aria-labelledby="training-chapters-title">
        <h3 id="training-chapters-title" className="font-semibold text-gray-900">Choose a chapter</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {partnerTraining.chapters.map((chapter, index) => <li key={chapter.title}>
            <Button variant={index === activeChapter ? 'primary' : 'outline'} className="h-full w-full justify-start gap-3 text-left"
              aria-current={index === activeChapter ? 'true' : undefined} onClick={() => jump(index)}>
              <span className="shrink-0 font-mono text-xs tabular-nums">{timestamp(chapter.start)}</span>
              <span>{index + 1}. {chapter.title}</span>
            </Button>
          </li>)}
        </ol>
      </section>
      <section aria-labelledby="training-prices-title" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 id="training-prices-title" className="text-sm font-semibold text-gray-900">Confirm the current price with the owner</h3>
        <p className="mt-2 text-sm text-gray-700">{PLAN_ORDER.map(plan => `${formatRupees(PLANS[plan].price)} for ${planTerm(plan)}`).join(' · ')}.</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">This class was recorded on {new Date(`${partnerTraining.recorded}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Use the price and terms shown in the owner’s checkout when selling. Partner-prepared setups have no free trial.</p>
      </section>
      <details className="group text-sm">
        <summary className="cursor-pointer font-semibold text-gray-900">Read the full class and practice scripts</summary>
        <div className="mt-5 space-y-3">
          {partnerTraining.chapters.map((chapter, index) => <details key={chapter.title} className="rounded-lg border border-gray-200 p-4">
            <summary className="cursor-pointer font-semibold text-gray-900">{index + 1}. {chapter.title}</summary>
            <div className="mt-4 space-y-5">{chapter.scenes.map(scene => <section key={scene.heading}>
              <h4 className="font-medium text-gray-900">{scene.heading}</h4>
              {'quote' in scene && <blockquote className="mt-2 whitespace-pre-line border-l-2 border-brand-600 bg-gray-50 py-3 pl-4 pr-3 leading-relaxed text-gray-800">{scene.quote}</blockquote>}
              <p className="mt-2 leading-relaxed text-gray-600">{scene.narration}</p>
            </section>)}</div>
          </details>)}
        </div>
      </details>
      <p className="text-xs leading-relaxed text-gray-600">Need help with an owner’s setup or payment? Contact <a className="font-medium text-brand-700 underline" href={`mailto:${legal.supportEmail}`}>{legal.supportEmail}</a> with the issue and payment reference, if relevant.</p>
    </div>
  </Card>;
}
