# Closed-Loop Test Plan

## Integration Tests
1. **Voice path**: STT input → OpenClaw response → TTS → LED sequence.
   - Expect: `listening → thinking → talking → idle`.
2. **WhatsApp path**: WhatsApp message → OpenClaw response → TTS → LED.

## Failure-Mode Tests
1. **TTS cloud failure**: simulate provider timeout → local TTS fallback.
2. **Stuck thinking**: block OpenClaw response → watchdog resets to `idle`.
3. **Stuck talking**: stop audio playback callback → watchdog resets to `idle`.

## Latency Targets
- Speech end → TTS start: < 2.5s (Pi 4 baseline).
- STT transcription: < 4s for 3-5s utterance.

## Observability
Capture logs with timestamps:
- State changes
- TTS routing decisions
- TTS playback start/stop
