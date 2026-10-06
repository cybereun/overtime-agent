# GitHub 릴리즈와 자동 업데이트

공개 저장소: https://github.com/cybereun/overtime-agent

## 다음 버전 배포

1. `npm version patch` 등으로 package.json/package-lock.json 버전을 올립니다. 태그는 `v1.0.1`처럼 실제 앱 버전과 맞춥니다.
2. `npm test`와 `npm run package`를 실행합니다. GitHub Actions의 Windows build 작업에서도 같은 빌드 파일을 받을 수 있습니다.
3. GitHub Releases의 **Draft a new release**에서 새 태그를 선택합니다.
4. 아래 세 파일을 **같은 빌드 결과에서** 첨부합니다.
   - `Overtime-Agent-Setup-1.0.1.exe`
   - `Overtime-Agent-Setup-1.0.1.exe.blockmap`
   - `latest.yml`
5. `latest.yml`의 version, 파일 이름, sha512가 같은 설치 파일을 가리키는지 확인합니다. 설치 파일을 바꿨다면 manifest도 다시 생성해야 합니다.
6. 모든 업로드를 마친 뒤 **Publish release** 합니다. Draft/Prerelease는 정식 앱의 업데이트 대상으로 사용하지 않습니다.

## 앱 동작

- 설치 앱이 시작한 지 10초 후, 이후 6시간마다 공개 GitHub Releases를 확인합니다.
- 설정과 트레이 메뉴에서 수동 확인할 수 있습니다.
- 새 버전이 있으면 **다운로드 / 나중에** 팝업을 표시합니다.
- 다운로드 완료 후 **설치 후 재실행 / 나중에** 팝업을 표시합니다.
- 설치 선택 시 기록을 먼저 저장하고 NSIS 설치기를 실행합니다. 완료 후 앱이 다시 시작됩니다.
- 다운로드/설치에 동의하지 않은 상태에서는 앱 종료 시 임의로 설치하지 않습니다.
- 인터넷 오류는 설정 화면에 표시하며 다시 확인할 수 있습니다. 알림 기능은 계속 동작합니다.
- 로그는 사용자 앱 데이터 폴더의 `update.log`에 보관합니다. 공개 GitHub 주소를 사용하고 앱에 GitHub 토큰을 넣지 않습니다.

코드 서명 인증서는 적용하지 않았습니다. 배포 전 Windows 보안 표시가 나타날 수 있으며, 자동 업데이트는 GitHub HTTPS와 manifest SHA-512 검증을 사용합니다.
