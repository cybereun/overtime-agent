# 초과근무 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement in this session. User explicitly requested implementation of the complete plan.

**Goal:** Windows 상주형 대화 설정 초과근무 알림 앱과 설치 파일.
**Architecture:** Pure domain/parser/scheduler, Electron main owns persistence and notifications, typed preload IPC, React main and popup views.
**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, electron-builder, Playwright.
**Spec:** ../specs/2026-10-07-overtime-design.md

## Global Constraints
- KST, no API key, no external service, no actual 나이스 automation.
- Confirm before saving interpretation, close does not mean done.
- Persist deliveries before showing, suppress duplicate reminders, recover one grouped summary.

## Review Focus
- Ambiguous hours must ask, explicit 24-hour and AM/PM must work.
- Overnight and excluded intervals must have stable IDs and correct calendar reminders.
- Restart/recovery cannot replay every missed popup or cancel snoozes.
- Invalid IPC input cannot corrupt persistence; write failures must surface.
- Popup actions must apply only to still-current slots.

### Task 1: Domain and interpreter
- [ ] Tests first: KST date arithmetic, 18–21 midpoint, overnight, partial, overlap, exclusion, ambiguity, all approved expressions.
- [ ] Implement src/core/model.ts, src/core/parser.ts; parseCommand(text,date,state) -> ParseResult and applyProposal(state,proposal) -> State.
- [ ] Run npm test; commit domain and tests.

### Task 2: Scheduler and persistence
- [ ] Tests first: collectDue(state,now,recover) -> events, no duplicate, next-day pending only, snooze, cancellation.
- [ ] Implement src/core/scheduler.ts and electron/store.ts. Stable IDs, schema validation, atomic replacement and backup.
- [ ] Run npm test; commit scheduler.

### Task 3: Desktop and user flow
- [ ] Implement electron/main.ts and preload.ts with isolated IPC; main window, tray, inactive popup and sound, timer, power resume, login choice.
- [ ] Implement React chat, confirmation, date navigation, work cards, reasons, edit/delete, settings and popup actions.
- [ ] Run build and Playwright desktop checks including persistence and focus; commit UI.

### Task 4: Delivery
- [ ] Package NSIS, install to isolated test path, launch installed binary and uninstall without deleting data.
- [ ] Whole-project independent review, fix material findings, rerun affected checks.
- [ ] Copy source excluding dependency/build caches to Y:, provide installer, usage and verification evidence.
