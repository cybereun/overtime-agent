# 검증 기록

## 자동 검증

- 핵심 구간/대화/예약/저장/IPC/업데이트 검증: 30 tests pass.
- TypeScript typecheck and Vite/Electron build pass.
- Production dependency audit: 0 vulnerabilities. Build-tool dependencies have 8 moderate transitive advisories; they are not shipped as production app dependencies.
- Independent read-only review performed. Five parser issues were reproduced in regression tests and fixed: explicit date consuming the year, wrong ambiguity insertion, explicit overnight endpoint, next-day AM/PM inheritance, clock minutes mistaken for excluded duration.

## Desktop acceptance

`npm run test:desktop` exercises actual Electron windows, isolated userData, IPC, sound playback, inactive bottom-right placement, real timer delivery, close-to-tray, restart, snooze, resume, active cancellation and auto-hide. Screenshots and machine-readable result are delivered in `검증자료`.

## Delivery

Build, install/uninstall result and final file hashes will be recorded after packaging. Native sound playback confirms media playback; actual speaker volume depends on Windows device/user settings.
