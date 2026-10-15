# demo/audio

Pre-generated ElevenLabs voice clips for the three demo scenes. No clips are committed yet.

The web app serves this folder at `/audio/` (in dev, and copied into `apps/web/dist/audio` on build). The voice button tries sources in this order:

1. a clip listed in `manifest.json` whose `text` matches the guard's `voiceText`
2. *(TODO)* live TTS through `POST /api/voice/tts` (the ElevenLabs proxy is a stub in `workers/api`)
3. the browser's `speechSynthesis`
4. text only

## Naming

`<scene>-<lang>-<decision>.mp3`, for example `subscription-th-pause.mp3`, `stay-en-pause.mp3`, `crypto-th-pause.mp3`.

```json
{
  "clips": {
    "crypto-th-pause": { "file": "crypto-th-pause.mp3", "text": "<exact voiceText.th from the engine>" }
  }
}
```

To get the exact text, run a scene in the app and copy the voice line from the guard card's "Explanation & assumptions" section, or call `evaluate()` from `packages/guard-engine`.

Thai lines need **Eleven v3**, because Flash v2.5 has no Thai. Verify the v3 `model_id` on our account before generating clips.
