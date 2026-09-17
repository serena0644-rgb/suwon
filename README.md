# 수원 든든패스

수원화성 일대 교통약자(휠체어·유모차·고령자) 관광 웹서비스입니다.

## 지도 · 경로 관련 환경변수

`.env.example` 을 `.env.local` 로 복사한 뒤 아래 두 키를 채워야 지도와 보행 경로가 동작합니다.

| 환경변수 | 발급처 | 용도 | 노출 범위 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | [카카오 개발자 콘솔](https://developers.kakao.com) → 내 애플리케이션 → 앱 키 → **JavaScript 키** | 카카오맵 표시 | 브라우저 (필수 노출) |
| `TMAP_APP_KEY` | [SK open API](https://openapi.sk.com) → 내 프로젝트 → 앱 키 | 보행자 경로탐색 | 서버 전용 |

- 카카오 키는 SDK 특성상 브라우저에 노출되므로, 콘솔의 **플랫폼 → Web** 에 배포 도메인(및 `http://localhost:3000`)을 등록해 사용 범위를 제한하세요.
- TMAP 키는 서버 라우트 `app/api/route/walk/route.ts` 에서만 쓰이며 클라이언트 번들에 포함되지 않습니다.
- 지도는 기존 공개 앱키를 기본으로 사용하며 환경변수로 재정의할 수 있습니다. TMAP 키가 없거나 API가 실패하면 실제 경로를 표시하지 않습니다. 장소별 카카오 길안내 링크는 계속 사용할 수 있습니다.

## 보행자 경로탐색 API를 TMAP으로 고른 이유

카카오 지도 JS SDK 에는 길찾기가 없고, 카카오모빌리티 Directions 와 네이버 Directions 는 **자동차 전용**이라 보도·횡단보도를 따르는 경로를 만들 수 없습니다.
TMAP 보행자 경로안내(`POST https://apis.openapi.sk.com/tmap/routes/pedestrian`)는

- 국내 보도/횡단보도/지하보도/육교 데이터를 갖고 있고,
- `searchOption=30` 으로 **계단을 제외한** 경로를 요청할 수 있으며,
- 응답에 한국어 턴바이턴 안내 문구(`description`)와 `turnType` 이 들어 있어 실시간 안내에 바로 쓸 수 있습니다.

무장애 서비스라는 요구사항에 계단 회피 옵션이 결정적이어서 TMAP 을 선택했습니다. 기본 보행 옵션은 `계단 제외`이며, 화면에서 추천/대로우선/최단으로 바꿀 수 있습니다.

---

# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
