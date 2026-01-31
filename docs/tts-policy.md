# TTS Routing Policy (Self-Governing)

## Primary Goal
Use **Inworld cloning** for high-impact responses while keeping costs low by
routing low-priority or long responses to local TTS. Always fall back locally
when the cloud provider is unavailable or slow.

## Inputs (Criteria)
- `source`: voice vs WhatsApp.
- `length`: response length in characters or seconds.
- `priority`: system flags (urgent, reminder, routine).
- `demonicIntensity`: user mode (`low|med|high`).
- `networkOnline`: internet connectivity.
- `cpuLoad`: local load for throttling.

## Routing Rules (Initial)
1. If `networkOnline` is false → **Local TTS**.
2. If `length` > 500 chars → **Local TTS**.
3. If `priority` is `urgent` or `demonicIntensity=high` → **Inworld**.
4. If source is WhatsApp and `length` < 200 → **Inworld** (short, premium).
5. Otherwise → **Local TTS**.

## Fallback Chain
1. Inworld (primary).
2. Local TTS (fallback).
3. Text-only output to logs if audio fails.

## Logging
Log each routing decision:
- `timestamp`, `provider`, `reason`, `latencyMs`, `success`.
