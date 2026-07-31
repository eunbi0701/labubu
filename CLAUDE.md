# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 자동 푸시 규칙 (필수)

**파일을 만들거나 수정한 뒤에는 항상 GitHub `main`에 푸시한다.** 사용자가 따로
"푸시해줘"라고 말하지 않아도, 한 번의 작업이 끝난 시점에 바로 실행한다.

```powershell
powershell -File scripts/push.ps1 -Message "무엇을 바꿨는지 한 줄"
```

- 대상 저장소는 `eunbi0701/labubu`, 브랜치는 `main` (스크립트 기본값).
- 이 컴퓨터에는 `git` / `gh` CLI가 **없다.** `git add`·`git commit`·`git push`는
  전부 실패하므로 절대 쓰지 말 것. 스크립트가 GitHub REST API로
  blob → tree → commit → ref 순서로 커밋을 만든다.
- 토큰은 `.env`의 `GITHUB_TOKEN`에서 읽는다. `.env`는 `.gitignore` 대상이며
  스크립트도 업로드 목록에서 제외한다.
- 커밋은 작업 디렉터리 전체를 그대로 반영한다(`base_tree` 미사용). 로컬에서 지운
  파일은 원격에서도 사라지므로, 푸시 전에 작업 디렉터리 상태가 의도한 그대로인지 확인할 것.
- 변경되지 않은 파일은 git blob SHA를 비교해 재업로드하지 않는다(이미지 4장 ≈ 370KB).
- 새 저장소에 처음 올릴 때는 Git Data API가 409 `Git Repository is empty`를 반환한다.
  Contents API(`PUT /repos/{o}/{r}/contents/{path}`)로 파일 하나를 먼저 넣어 시드한 뒤
  스크립트를 실행한다.

## 프로젝트 성격

의존성 없는 정적 랜딩페이지 한 장. **빌드·번들러·패키지 매니저·테스트가 없다.**
`node`도 설치돼 있지 않으므로 npm 기반 도구를 제안하지 말 것.

미리보기는 파일을 직접 열면 된다 (`file://`로 폰트·이미지 모두 정상 동작):

```powershell
Start-Process index.html
```

렌더링 확인이 필요하면 Chrome/Edge 헤드리스 스크린샷을 쓴다(둘 다 설치돼 있음).

## 구조

| 파일 | 역할 |
| --- | --- |
| `index.html` | 전체 마크업. 섹션 순서: 티커 → 네비 → 히어로 → 라인업 → 공방 → 편지 → 주문서 → 푸터 |
| `styles.css` | `:root` 디자인 토큰 + 섹션별 스타일 + 반응형(파일 하단) |
| `uploads/*.jpeg` | 제품 이미지 4종 |
| `scripts/push.ps1` | GitHub 푸시 헬퍼 (위 규칙 참조) |

`index.html`의 섹션 주석 블록(`<!-- ── Hero ── -->`)과 `styles.css`의 주석 블록이
1:1로 대응한다. 섹션을 추가하면 양쪽 순서를 맞춰서 넣을 것.

## 스타일 작성 규칙

- **하드코딩된 색·간격 금지.** 모든 값은 `:root` 토큰에서 온다. 특히
  `--bw`(테두리 2px), `--sh`(하드 셰도우 6px), `--img-filter`(사진 세피아),
  `--rule-style`(카드 내부 점선)은 원본 Claude Design `.dc` 파일의
  `{{ 플레이스홀더 }}`를 확정한 값이라 여기서만 바꾼다.
- 서체는 세 갈래로 고정: 제목·버튼·가격 `--head`(Gaegu, 손글씨), 본문 `--body`(Gowun Dodum),
  캡션·메타·라벨 `--mono`(Space Mono, 대문자 + `letter-spacing`).
- 클래스는 BEM 계열(`.product__media`, `.plan--featured`). 유틸리티 클래스나
  인라인 스타일을 새로 만들지 말고 기존 블록에 붙일 것.
- 크기는 `clamp()`로 유동 처리(`--h1`, `--h2`, `--gutter`, `--sec-pad`).
  픽셀 고정 breakpoint 추가는 최후 수단.
- 카드 계열(`.product` / `.letter` / `.plan`)은 같은 공식을 공유한다:
  `var(--card)` 바탕 + `var(--bw) solid var(--ink)` 테두리 + 오프셋 하드 셰도우.
  새 카드를 만들면 이 세 가지를 그대로 따를 것.
- 반전 섹션(`.workshop`, `.ticker`, `.footer`)은 `--ink` 바탕이므로 텍스트에
  `--light` / `--light-mid` / `--light-soft`를 쓴다.

## 유지해야 할 것

- 접근성: 건너뛰기 링크, 이미지 `alt`, 별점 `aria-label`, `:focus-visible` 링,
  장식 문자(`◆`, `|`)의 `aria-hidden`.
- `prefers-reduced-motion`에서 뱃지 흔들림과 부드러운 스크롤이 꺼진다.
  새 애니메이션을 넣으면 이 블록에도 추가할 것.
- 이미지에는 `width`/`height` 속성과 (히어로 제외) `loading="lazy"`를 붙인다.

## 알려진 편차

공방 섹션은 원본이 `uploads/hero-labubu.png`를 쓰지만 디자인 API 응답 한도(192KB)에서
잘려 내려와 디코딩이 불가능했다. 지금은 `labubu-purple.jpeg`로 대체돼 있고,
라인업 MODEL 01과 이미지가 겹친다. 원본 PNG를 확보하면
`.workshop__media img`의 `src`만 되돌리면 된다.
