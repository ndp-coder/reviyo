import { useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { homeFilm } from '@/config/home-film';

export function HomeProductFilm() {
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playNotice, setPlayNotice] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  function start() {
    const video = player.current;
    if (!video) return;
    setStarted(true); setFailed(false); setPlayNotice(false);
    video.load();
    void video.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setPlayNotice(true);
    });
  }
  return <section id="product-film" className="landing-section landing-film-section" aria-labelledby="home-film-title"><div className="landing-container">
    <div className="landing-section-heading"><div><p className="landing-section-kicker">The video walkthrough</p><h2 id="home-film-title">See the full review flow.</h2></div><p className="landing-section-description">From setting out the QR card to a customer posting on Google. {Math.round(homeFilm.duration)} seconds, with {homeFilm.audioLanguage} audio and optional captions.</p></div>
    <div className="landing-film-player"><video ref={player} controls={started} playsInline preload="none" poster={homeFilm.posterSrc} aria-label="Reviyo product walkthrough" onError={() => setFailed(true)} onCanPlay={() => setFailed(false)}>
      <source src={homeFilm.videoSrc} type="video/mp4" onError={() => setFailed(true)} />
      {homeFilm.captions.map(caption => <track key={caption.lang} kind="captions" src={caption.src} srcLang={caption.lang} label={caption.label} default={caption.lang === 'en'} />)}Your browser cannot play the film. Read the walkthrough below.
    </video>{!started && <button type="button" className="landing-film-play" onClick={start} aria-label="Play the Reviyo product walkthrough"><span aria-hidden="true">▶</span><span>See Reviyo in action<small>{Math.round(homeFilm.duration)} seconds · Sound on</small></span></button>}</div>
    {failed && <Alert variant="warning" className="mt-4" action={<Button variant="outline" onClick={start}>Retry video</Button>}>The video could not load. Read the walkthrough below or <a href={homeFilm.videoSrc} className="underline">open the video directly</a>.</Alert>}
    {playNotice && !failed && <p className="landing-film-note" role="status">Press play on the video to start. You can also read the walkthrough below.</p>}
    <div className="landing-film-footer">{homeFilm.captions.length > 1 && <p className="landing-film-language-note">Choose English or Telugu captions in the video controls.</p>}<details><summary>Read the walkthrough</summary><ol>{homeFilm.scenes.map(scene => <li key={scene.title}><strong>{scene.title}</strong>{scene.narrationTelugu && <p lang="te" className="mb-2">{scene.narrationTelugu}</p>}<p>{scene.narration}</p></li>)}</ol></details></div>
  </div></section>;
}
