# 라부부 완구사 — Toy Package 랜딩페이지

Claude Design 프로젝트 `Labubu Landing - Toy Package.dc.html`를 의존성 없는 정적 웹사이트로 구현한 것입니다.

옛날 완구 상자 카탈로그 느낌 — 크림색 종이 바탕, 진한 잉크색 테두리,
그림자가 딱 떨어지는 하드 셰도우, 손글씨 제목 + 모노스페이스 캡션.

## 구성

```
index.html        홈 (티커·네비·히어로·라인업·공방·편지·주문서·CTA 띠·푸터)
support.html      고객센터 (연락처·배송/교환/환불·FAQ)
account.html      마이페이지 (주문 조회 — 데모 화면)
styles.css        디자인 토큰 + 세 페이지 전체 스타일 + 반응형
uploads/          제품 이미지 4종
docs/             구현계획 문서
scripts/push.ps1  git CLI 없이 GitHub REST API로 푸시
```

로컬에서 보려면 `index.html`을 브라우저로 열면 됩니다. 빌드 과정 없음.

### 페이지 구조

홈 하단 CTA 띠에서 두 서브페이지로 들어갑니다. 세 페이지는 티커·네비·푸터를 공유하지만
템플릿 엔진이 없어 **마크업이 복사되어 있습니다** — 이 셋을 고칠 때는 세 파일 모두 반영해야 합니다.

네비 링크는 페이지마다 다릅니다. 홈은 `#lineup` 같은 페이지 내 앵커를 쓰고,
서브페이지는 `index.html#lineup`처럼 파일명을 붙입니다. 그대로 복사하면 링크가 죽습니다.

`account.html`은 백엔드가 없어 **주문 데이터가 전부 HTML에 박힌 더미**입니다.
페이지 상단 DEMO 배지가 이를 밝히고 있으며, `<meta name="robots" content="noindex">`로
검색 색인에서도 제외했습니다. 실제 서비스가 되면 배지를 지우고 진입점을 로그인 뒤로 옮겨야 합니다.

## 받은 편지들 — 가로 무한 스크롤

편지 카드는 3열 그리드 대신 끊김 없이 흐르는 가로 줄로 배치됩니다.
카드 디자인(`.letter`)은 그대로이고, 스크롤러 안에서 폭만 고정됩니다.

- 카드 3장을 JS로 3번 복제해 총 4세트를 만들고, 한 세트 폭
  `calc(3 * (--letter-w + --letter-gap))`만큼 이동시켜 원위치로 순환합니다.
  복제본에는 `aria-hidden="true"`가 붙어 스크린리더가 중복해 읽지 않습니다.
- 마우스를 올리거나 키보드 포커스가 들어오면 멈춥니다 — 흐르는 본문은 정지 없이 읽기 어렵습니다.
- 양 끝은 `mask-image`로 페이드됩니다.
- JS가 없으면 원본 카드 3장이 그대로 남고, `prefers-reduced-motion`에서는
  흐르지 않고 손으로 미는 줄이 됩니다.

속도·카드 폭은 `styles.css`의 `.scroller` 안 `--scroll-duration`, `--letter-w`로 조절합니다.

## 푸시

이 PC에는 git CLI가 없어 REST API로 올립니다. 토큰은 `.env`의 `GITHUB_TOKEN`에서 읽습니다.

```powershell
powershell -File scripts/push.ps1 -Message "커밋 메시지"
```

## 디자인 토큰

원본 `.dc` 파일의 `{{ 플레이스홀더 }}`를 CSS 커스텀 프로퍼티로 확정했습니다.
값은 `styles.css` 최상단 `:root`에서 한곳에 모아 수정할 수 있습니다.

| 토큰 | 값 | 쓰임 |
| --- | --- | --- |
| `--paper` | `#EFE0C0` | 페이지 바탕 (누런 종이) |
| `--card` | `#FBF4E4` | 카드 바탕 (밝은 크림) |
| `--ink` | `#3A2A19` | 테두리 · 본문 · 반전 섹션 |
| `--stamp` | `#B8462F` | 도장 빨강 (강조 · 링크) |
| `--accent` | `#EFC050` | 겨자색 뱃지 |
| `--bw` | `2px` | 테두리 두께 |
| `--radius` | `4px` | 카드 모서리 |
| `--sh` | `6px` | 하드 셰도우 오프셋 |
| `--img-filter` | `sepia(.12) saturate(1.02) contrast(1.02)` | 사진 색바램 |
| `--rule-style` | `dashed` | 카드 안쪽 점선 |

서체는 제목 `Gaegu`, 본문 `Gowun Dodum`, 캡션 `Space Mono` (Google Fonts).

## 반응형

| 브레이크포인트 | 변화 |
| --- | --- |
| `≤1080px` | 라인업 4열 → 2열 |
| `≤900px` | 히어로 · 공방 세로 스택, 네비 링크 줄바꿈, 편지/주문서 1열 |
| `≤560px` | 라인업 1열, 한정 뱃지 축소 |

제목·여백은 `clamp()`로 유동적으로 줄어듭니다.
`prefers-reduced-motion`에서는 뱃지 흔들림과 부드러운 스크롤이 꺼집니다.

## 원본과 다른 점

- **공방 섹션 이미지**: 원본은 `uploads/hero-labubu.png`를 씁니다. 이 파일은
  디자인 API 응답 한도(192KB)에서 잘려 내려와 디코딩이 불가능했습니다.
  분위기가 가장 가까운 `uploads/labubu-purple.jpeg`(밤하늘 장면)로 대체했습니다.
  원본 PNG를 확보하면 `index.html`의 `.workshop__media img` 경로만 되돌리면 됩니다.
- `.dc` 전용 문법(`<x-dc>`, `<sc-if>`, `style-hover`)은 표준 HTML/CSS로 옮겼습니다.
  `sc-if` 세 곳(티커 · 한정 뱃지 · 공방 섹션)은 기본값 `true` 기준으로 모두 노출했습니다.
- 인라인 스타일을 클래스로 정리하고, 접근성 요소(건너뛰기 링크, `alt` 텍스트,
  별점 `aria-label`, 포커스 링)를 추가했습니다.
