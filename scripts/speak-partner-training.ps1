# Run in Windows PowerShell: powershell -File scripts/speak-partner-training.ps1
# Uses only the installed default Windows English voice; no service or key.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class ReviyoSpeechMark {
  public double start;
  public int position;
  public int length;
}
public class ReviyoLocalSpeech {
  public string voice;
  public List<ReviyoSpeechMark> marks = new List<ReviyoSpeechMark>();
  public void Render(string text, string path) {
    using (var synth = new SpeechSynthesizer()) {
      if (!synth.Voice.Culture.Name.StartsWith("en")) {
        synth.SelectVoiceByHints(VoiceGender.NotSet, VoiceAge.NotSet, 0, new System.Globalization.CultureInfo("en-US"));
      }
      voice = synth.Voice.Name;
      synth.Rate = 0;
      // The default desktop voice reports word positions at its native 16 kHz.
      // Match that format so SpeakProgress.AudioPosition stays in sync with WAV.
      synth.SetOutputToWaveFile(path, new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
      synth.SpeakProgress += (sender, e) => {
        marks.Add(new ReviyoSpeechMark { start = e.AudioPosition.TotalSeconds, position = e.CharacterPosition, length = e.CharacterCount });
      };
      synth.Speak(text);
    }
  }
}
'@
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskWork = Join-Path $taskRoot 'output/partner-training'
$taskContent = Get-Content -LiteralPath (Join-Path $taskWork 'content.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskIndex = 0
$taskResults = @()
foreach ($taskChapter in $taskContent.chapters) {
  foreach ($taskScene in $taskChapter.scenes) {
    $taskName = '{0:D3}' -f $taskIndex
    $taskSpeech = New-Object ReviyoLocalSpeech
    $taskSpeech.Render($taskScene.narration, (Join-Path $taskWork ($taskName + '.wav')))
    $taskResults += [pscustomobject]@{ index = $taskIndex; voice = $taskSpeech.voice; marks = @($taskSpeech.marks) }
    $taskIndex++
    Write-Output ('Narrated scene {0}: {1}' -f $taskIndex, $taskScene.heading)
  }
}
$taskResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskWork 'speech-marks.json') -Encoding UTF8
