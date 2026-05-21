# Graph Report - apps/backend/src  (2026-05-21)

## Corpus Check
- Corpus is ~20,813 words - fits in a single context window. You may not need a graph.

## Summary
- 267 nodes · 320 edges · 38 communities detected
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]

## God Nodes (most connected - your core abstractions)
1. `getDB()` - 54 edges
2. `AuthController` - 18 edges
3. `AuthService` - 18 edges
4. `AdminController` - 14 edges
5. `AdminService` - 14 edges
6. `CvService` - 10 edges
7. `PaystackService` - 8 edges
8. `SessionController` - 7 edges
9. `AiController` - 6 edges
10. `PaystackController` - 6 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `initDB()`  [INFERRED]
  src\main.ts → src\database\init.ts
- `resolveRoute()` --calls--> `routeQuestion()`  [INFERRED]
  src\ai\ai.service.ts → src\ai\question-router.ts
- `initDB()` --calls--> `getDB()`  [INFERRED]
  src\database\init.ts → src\database\db.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (6): AdminService, AuthService, getDB(), initDB(), bootstrap(), ReferralService

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (1): AuthController

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (6): isUsernameValid(), sanitizeUsername(), verifyAccessToken(), verifyElectronOAuthToken(), verifyRefreshToken(), LicenseService

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (2): CvController, CvService

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (2): PaystackController, PaystackService

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (1): AdminController

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (5): AiService, resolveRoute(), buildCVContext(), buildSystemPrompt(), routeQuestion()

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (2): AiController, SSEManager

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (1): SessionController

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (1): SessionService

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (2): AdminGuard, DeviceGuard

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.4
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.6
Nodes (3): isDeviceLocked(), isLicenseExpired(), resolveLicenseStatus()

### Community 18 - "Community 18"
Cohesion: 0.4
Nodes (1): LicenseController

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (1): ReferralController

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (1): JwtStrategy

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (1): AppController

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (1): AppModule

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): AdminModule

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): AiModule

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): AuthModule

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): JwtAuthGuard

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (1): CvModule

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): LicenseModule

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): PaystackModule

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): ReferralModule

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): SessionModule

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **10 isolated node(s):** `AppModule`, `AdminModule`, `AiModule`, `AuthModule`, `JwtAuthGuard` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 24`** (2 nodes): `AppModule`, `app.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `AdminModule`, `admin.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `AiModule`, `ai.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `AuthModule`, `auth.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `JwtAuthGuard`, `jwt-auth.guard.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `CvModule`, `cv.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `LicenseModule`, `license.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `verifyWebhookSignature()`, `paystack-webhook.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `PaystackModule`, `paystack.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `ReferralModule`, `referral.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `SessionModule`, `session.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `prompts.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `question-router.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `cv.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDB()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.338) - this node is a cross-community bridge._
- **Why does `AuthController` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 53 inferred relationships involving `getDB()` (e.g. with `.getStats()` and `.getUsers()`) actually correct?**
  _`getDB()` has 53 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppModule`, `AdminModule`, `AiModule` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._