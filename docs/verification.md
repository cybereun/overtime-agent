# 검증 기록

## 자동 검증

- 핵심 구간/대화/예약/저장/IPC/업데이트 검증: 30 tests pass.
- TypeScript typecheck and Vite/Electron build pass.
- Production dependency audit: 0 vulnerabilities. Build-tool dependencies have 8 moderate transitive advisories; they are not shipped as production app dependencies.
- Independent read-only review performed. Five parser issues were reproduced in regression tests and fixed: explicit date consuming the year, wrong ambiguity insertion, explicit overnight endpoint, next-day AM/PM inheritance, clock minutes mistaken for excluded duration.

## Desktop acceptance

`npm run test:desktop` exercises actual Electron windows, isolated userData, IPC, sound playback, inactive bottom-right placement, real timer delivery, close-to-tray, restart, snooze, resume, active cancellation and auto-hide. Screenshots and machine-readable result are delivered in `검증자료`.

## Delivery

NSIS v1.0.0 installation returned exit code 0. The installed executable passed all 13 desktop acceptance checks, including inactive placement, actual audio playback, 10-minute snooze persistence, active cancellation, and auto-hide measured at 30.10 seconds. Uninstall returned exit code 0 and removed the installed executable while preserving isolated records. Native sound playback confirms media playback; actual speaker volume depends on Windows device/user settings.

Final branding: update heading displays `앱 업데이트 v1.0.0 @2026 j.u.Eun`. Every product screen uses 나이스; the provider attribution was removed from settings and the update-popup footer. Bundled Noto Sans KR custom-font rendering was verified through Chromium platform-font data in the installed executable.

## Actual online update

The installed v0.9.0 test fixture detected the public v1.0.0 release, downloaded the real GitHub installer, verified it, ran NSIS, and restarted as v1.0.0. Executable metadata reported `1.0.0.0`; the newly launched process and startup log confirmed restart. Isolated recorded work data remained unchanged. Result: PASS (`검증자료/upgrade-result.json`).

NSIS relaunches through Explorer, so test-only data-dir environment overrides are not propagated. The QA harness checks the real startup diagnostic in the normal app-data folder and the installed executable version instead of assuming that test environment variables persist.

The final installed-app appearance check verified the update footer contains only `현재 v1.0.0` and the saved-record notice. Screenshot: `검증자료/update-footer-final.png`. Windows GitHub Actions build passed for the final product code.
