# PRODUCTION TASK: Add Electron Auto-Updater Without Breaking the Existing ZoomGuru Pipeline

You are working on the existing **ZoomGuru Electron desktop application**.

Your task is to add a reliable **automatic update feature** using `electron-updater`.

This must be implemented as an **additive feature** to the existing application.

The most important requirement is:

> **DO NOT BREAK, REFACTOR, REPLACE, OR DISRUPT ANY EXISTING PRODUCTION FUNCTIONALITY OR DEPLOYMENT PIPELINE.**

The current application is already live and working.

The updater must be introduced as an isolated capability around the existing system.

---

# 1. CURRENT ARCHITECTURE AND REQUIREMENTS

The application is an Electron desktop application with an existing frontend and production build process.

The source code is hosted in a **PRIVATE GitHub repository**.

The application already has an existing production download/release mechanism.

The application also has Firebase infrastructure available for public file distribution/downloads.

We want to introduce automatic desktop application updates.

The desired user experience is:

```text
User installs ZoomGuru
        ↓
ZoomGuru runs normally
        ↓
User later opens ZoomGuru
        ↓
Updater checks for a newer version
        ↓
No update?
        → Continue normally

Update available?
        ↓
Download update in background
        ↓
User continues using ZoomGuru
        ↓
Update downloaded
        ↓
Show "Update Ready"
        ↓
User chooses Restart Now or Later
        ↓
Application restarts
        ↓
New version installed
```

The updater must be invisible when there is nothing to update.

---

# 2. ABSOLUTE PRODUCTION-SAFETY REQUIREMENT

Before changing anything, inspect the existing project.

Do NOT assume the architecture.

Determine:

- Electron entry point
- Main process
- Preload process
- Renderer process
- React/Vite structure
- Existing IPC architecture
- `package.json`
- Electron Builder configuration
- Existing build scripts
- Existing installer configuration
- Existing GitHub release configuration
- Existing Firebase configuration
- Existing website download mechanism
- Existing environment variables
- Existing signing configuration, if any
- Existing CI/CD configuration
- Existing production deployment process

Do not modify unrelated components.

Do not upgrade unrelated dependencies.

Do not migrate frameworks.

Do not restructure the application.

Do not change the backend.

Do not change authentication.

Do not change the database.

Do not change API endpoints.

Do not change the existing website download mechanism unless absolutely necessary.

Do not replace working infrastructure.

The task is:

> **ADD ELECTRON AUTO-UPDATE SUPPORT.**

---

# 3. NO GITHUB ACTIONS

This project must NOT require GitHub Actions for the updater.

Do not create:

```text
.github/workflows/*
```

unless the repository already has workflows that are necessary for unrelated production functionality.

Do not introduce a new GitHub Actions workflow merely to build or publish Electron releases.

Do not introduce paid CI/CD infrastructure.

The intended release process is **local/manual**.

The developer should be able to build and publish a release from their own computer.

Conceptually:

```text
Private GitHub Repository
          ↓
       Developer
          ↓
    Local Build Machine
          ↓
    Electron Builder
          ↓
   Release Artifacts
          ↓
 GitHub Release and/or
 Firebase Storage
```

---

# 4. FIRST DETERMINE THE SAFEST UPDATE DISTRIBUTION METHOD

There are two possible distribution strategies.

## Strategy A — GitHub Releases

The existing private GitHub repository can be used as the source for GitHub Releases.

Electron Builder can create and publish release artifacts locally.

For example:

```text
ZoomGuru v1.0.1

ZoomGuru Setup 1.0.1.exe
latest.yml
ZoomGuru Setup 1.0.1.exe.blockmap
```

No GitHub Actions are required.

However, because the repository is PRIVATE, carefully verify whether ordinary end users can download update files through `electron-updater` without exposing a GitHub authentication token or other private credential.

---

# 5. PRIVATE GITHUB SECURITY REQUIREMENT

This is extremely important.

Never place any of the following inside the packaged Electron application:

- GitHub Personal Access Token
- GitHub Actions token
- GitHub App private key
- GitHub OAuth secret
- Firebase service account credentials
- Firebase Admin SDK credentials
- Any other private deployment credential

Do NOT solve private GitHub release access by hard-coding a developer's GitHub token into the application.

Do NOT expose private repository credentials through:

- JavaScript
- preload
- environment variables bundled into Vite
- renderer code
- Electron resources
- configuration files packaged with the application

Assume that anything packaged into an Electron application can eventually be inspected by the end user.

---

# 6. DECISION RULE FOR GITHUB VS FIREBASE

Investigate whether `electron-updater` can safely and reliably consume the private GitHub Releases in this exact production scenario.

If the private GitHub updater implementation requires distributing a secret/token to end users:

**DO NOT IMPLEMENT THAT APPROACH.**

Instead, use:

```text
Private GitHub Repository
        ↓
Local Electron Builder
        ↓
Firebase Storage
        ↓
electron-updater
        ↓
End Users
```

Firebase Storage should act as the public update distribution layer.

The GitHub repository can remain completely private.

GitHub Releases may still be retained for archival/source-release purposes if they already exist.

The priority is:

> **Security and reliability over forcing GitHub Releases to be the updater source.**

---

# 7. PREFERRED ZERO-CI ARCHITECTURE

If private GitHub Releases cannot safely serve public end-user updates, implement this architecture:

```text
             PRIVATE GITHUB
                  │
                  │ source code
                  ▼
            Developer PC
                  │
                  │ local build
                  ▼
          Electron Builder
                  │
          ┌───────┴────────┐
          │                │
          ▼                ▼
     Installer        Update metadata
     .exe             latest.yml
          │            .blockmap
          │                │
          └───────┬────────┘
                  ▼
           Firebase Storage
                  │
                  ▼
           electron-updater
                  │
                  ▼
          Existing ZoomGuru
             installations
```

No GitHub Actions.

No update backend.

No Redis.

No additional server.

No CI/CD bill.

---

# 8. ELECTRON-UPDATER

Install and use:

```bash
npm install electron-updater
```

First inspect whether it is already installed.

If it is already present, reuse the existing dependency.

Do not create duplicate updater implementations.

Use the existing Electron Builder setup.

---

# 9. ELECTRON BUILDER

Inspect the current Electron Builder configuration before changing it.

Do not replace the existing configuration.

Extend it minimally to support publishing update artifacts.

For a generic Firebase Storage provider, the configuration should conceptually resemble:

```json
{
  "publish": {
    "provider": "generic",
    "url": "https://YOUR_UPDATE_STORAGE_URL/"
  }
}
```

Do not copy this blindly.

Determine the correct configuration based on the existing project.

If GitHub Releases are determined to be safe for the end-user updater, use the existing GitHub provider instead.

---

# 10. WINDOWS SUPPORT

Prioritize the existing Windows production target.

If the application currently uses NSIS, preserve that configuration.

Do not replace the current installer technology unless required.

Ensure Electron Builder produces the appropriate updater artifacts.

For Windows this may include:

```text
latest.yml
ZoomGuru Setup X.X.X.exe
ZoomGuru Setup X.X.X.exe.blockmap
```

Do not manually generate `latest.yml`.

Electron Builder must generate the correct metadata.

Do not manually modify hashes or blockmap information.

---

# 11. VERSIONING

Use the application's existing version system.

Do not create a separate updater version database.

For example:

```json
{
  "version": "1.0.0"
}
```

When releasing:

```text
1.0.0 → 1.0.1
```

the updater must detect the newer version.

The updater must never unintentionally downgrade users.

---

# 12. UPDATE CHECK ON APPLICATION START

The updater should check for updates after the application has initialized.

The updater must NOT block application startup.

The conceptual lifecycle should be:

```text
app.whenReady()
        ↓
Create application window
        ↓
Initialize normal services
        ↓
Initialize updater
        ↓
Check for update asynchronously
```

Never:

```text
Start app
   ↓
Wait for updater
   ↓
If updater fails
   ↓
Application doesn't start
```

The updater is optional infrastructure.

The application itself is not dependent on it.

---

# 13. INTERNET / OFFLINE BEHAVIOUR

ZoomGuru must work perfectly offline.

If the user starts ZoomGuru without Internet:

```text
Offline
   ↓
Skip update check
   ↓
Launch application normally
```

There must be no:

- crash
- blocking screen
- infinite spinner
- error dialog
- forced retry loop

When connectivity becomes available, the updater should be able to check again.

Implement sensible retry/check behaviour.

Avoid aggressive polling.

A reasonable periodic interval such as 10–30 minutes may be used, but choose the final interval based on the application's architecture.

---

# 14. UPDATE CHECK FREQUENCY

The updater should check:

1. On application startup.
2. Periodically while the application remains open.
3. After connectivity is restored, where practical.

Do not check every few seconds.

Do not create multiple timers.

Do not create duplicate update requests.

Make sure only one update check/download can occur at a time.

---

# 15. DOWNLOAD UPDATES IN THE BACKGROUND

When a newer version is found:

```text
Current:
1.0.0

Available:
1.0.1
```

download the update in the background.

The application must remain usable.

Do NOT:

- close the application
- restart the application
- interrupt the current session
- force an installation
- block the renderer

while the update is downloading.

---

# 16. DOWNLOAD PROGRESS

Capture updater download progress.

For example:

```text
0%
25%
50%
75%
100%
```

Expose this to the renderer only if the existing UI architecture needs it.

Use secure IPC.

Do not expose the raw `autoUpdater` object to the renderer.

---

# 17. UPDATE-READY STATE

When the update finishes downloading, transition the application into an update-ready state.

Example:

```text
ZoomGuru update ready

Version 1.0.1 has been downloaded
and is ready to install.

[Restart Now] [Later]
```

The user must be able to postpone the restart.

Do not automatically restart ZoomGuru after an update download.

---

# 18. RESTART / INSTALLATION

Use the supported `electron-updater` installation mechanism.

The desired behaviour is:

```text
Download update
       ↓
Update ready
       ↓
User continues working
       ↓
User chooses restart
       ↓
Install update
       ↓
Launch updated application
```

If the user chooses "Later":

```text
Continue using current version
```

The update should remain available for installation according to Electron Updater's normal lifecycle.

---

# 19. UPDATE EVENTS

Handle the relevant updater events, including:

```text
checking-for-update
update-available
update-not-available
download-progress
update-downloaded
error
```

Create clean application-level state around these events.

For example:

```text
idle
checking
available
downloading
downloaded
error
```

Do not allow updater exceptions to propagate into application startup or crash the main process.

---

# 20. IPC SECURITY

Inspect the existing preload/IPC architecture.

If the renderer needs updater information, expose only a minimal API.

For example:

```text
getCurrentVersion()
onUpdateAvailable()
onUpdateProgress()
onUpdateDownloaded()
onUpdateError()
installUpdate()
```

Do NOT expose:

```text
autoUpdater
ipcRenderer
fs
shell
child_process
```

directly to the renderer.

Preserve:

```text
contextIsolation: true
```

if currently enabled.

Do not enable unrestricted Node.js integration simply to implement the updater.

---

# 21. UPDATER MODULE

Keep updater logic isolated.

If appropriate for the existing project, create something similar to:

```text
electron/
    updater/
        updater.ts
```

or:

```text
electron/
    services/
        updater.ts
```

Do not force this exact structure.

Follow the project's existing architecture.

The principle is:

```text
Electron Application
       │
       ├── Existing functionality
       │
       └── Updater Service
```

not:

```text
Updater code scattered throughout the application
```

---

# 22. ERROR HANDLING

Updater failure must never equal application failure.

For example:

```text
Firebase unavailable
       ↓
Updater error
       ↓
Log error
       ↓
Continue ZoomGuru
```

Likewise:

```text
GitHub unavailable
DNS failure
timeout
invalid metadata
download interrupted
storage unavailable
```

must not stop ZoomGuru from functioning.

---

# 23. LOGGING

Use updater-specific logs.

For example:

```text
[Updater] Checking for updates
[Updater] Current version: 1.0.0
[Updater] Update available: 1.0.1
[Updater] Download progress: 42%
[Updater] Update downloaded: 1.0.1
[Updater] Installation deferred
```

Do not log secrets.

Do not log:

- Firebase service credentials
- GitHub tokens
- private keys
- authentication headers
- sensitive user information

If Sentry already exists in the project, determine whether updater errors should be reported there.

Do not introduce another monitoring system unnecessarily.

---

# 24. FIREBASE STORAGE

If Firebase is selected as the update distribution provider, use the existing Firebase Storage infrastructure where possible.

Do not create an entirely separate Firebase project unless necessary.

The update directory should logically contain:

```text
updates/
    latest.yml
    ZoomGuru Setup 1.0.1.exe
    ZoomGuru Setup 1.0.1.exe.blockmap
```

Use an appropriate folder structure if the existing Firebase architecture suggests another layout.

The updater must be able to access the required files through HTTPS.

---

# 25. FIREBASE SECURITY

Users need:

```text
READ
```

access to update files.

They must NOT have:

```text
WRITE
DELETE
MODIFY
```

access.

Deployment/upload credentials must remain private.

Do not place Firebase Admin credentials inside ZoomGuru.

Do not place service-account JSON files inside the packaged application.

If Firebase Storage rules must be changed, make the smallest possible change.

Do not weaken unrelated storage permissions.

---

# 26. LOCAL RELEASE PROCESS

No GitHub Actions should be required.

The preferred release process should be local.

For example:

```text
Update version
       ↓
npm run build
       ↓
Electron Builder
       ↓
Generate installer
       ↓
Generate latest.yml
       ↓
Upload artifacts
       ↓
Firebase Storage
```

If GitHub Releases are safely usable:

```text
Electron Builder
       ↓
GitHub Release
```

may also be retained.

---

# 27. CREATE A SIMPLE RELEASE COMMAND IF APPROPRIATE

If the existing project supports it without disrupting current scripts, create a dedicated command such as:

```bash
npm run release
```

This should perform only the required release tasks.

For example:

```text
npm run release
        ↓
Production frontend build
        ↓
Electron Builder
        ↓
Generate installer/update metadata
        ↓
Upload update artifacts
```

However:

**Do not replace existing build commands.**

If the existing command is:

```bash
npm run build
```

it must continue working exactly as before.

A new release command should be additive.

---

# 28. DO NOT REQUIRE GITHUB ACTIONS

The final system must work without:

```text
GitHub Actions
GitHub CI
GitHub-hosted runners
paid CI services
```

The developer must be able to release an update from their local development machine.

---

# 29. GITHUB RELEASES

If GitHub Releases are already part of the production process, do not remove them automatically.

If safe, the developer can continue publishing:

```text
ZoomGuru v1.0.1
```

from the local machine.

The source repository remains private.

No GitHub Actions are required.

However, if GitHub Releases cannot safely provide unauthenticated update downloads to end users because the repository is private, Firebase Storage must be used as the updater source.

---

# 30. DO NOT EXPOSE GITHUB CREDENTIALS

This is a hard security requirement.

The packaged application must never contain:

```text
GH_TOKEN
GITHUB_TOKEN
Personal Access Token
GitHub App private key
```

or equivalent credentials.

Build-time credentials may exist on the developer's local machine, but they must never become part of the application bundle.

---

# 31. DEVELOPMENT MODE

Do not make auto-update behaviour interfere with development.

When running:

```bash
npm run dev
```

or the existing development command:

```text
React/Vite development
Electron development
```

the updater should either remain disabled or behave appropriately for development.

Do not accidentally download production installers into a developer's environment during normal development.

---

# 32. DUPLICATE UPDATE PREVENTION

Prevent multiple update downloads.

This must not happen:

```text
10:00 → check
10:01 → check
10:02 → check
10:03 → check
```

with four simultaneous downloads.

Maintain updater state and ensure only one update operation is active.

---

# 33. NO UPDATE LOOP

Ensure this does not occur:

```text
1.0.0
 ↓
1.0.1
 ↓
restart
 ↓
1.0.1
 ↓
"update available"
 ↓
1.0.1
 ↓
restart
```

Once the current version is the latest version, the updater must correctly report:

```text
update-not-available
```

---

# 34. TESTING

Before considering the feature complete, perform controlled tests.

## Test A — Existing application startup

Install the current production version.

Launch it.

Expected:

```text
Application launches normally.
```

---

## Test B — Offline startup

Disable Internet.

Launch ZoomGuru.

Expected:

```text
ZoomGuru launches normally.
No crash.
No blocking updater screen.
```

---

## Test C — No update available

Install the newest version.

Launch.

Expected:

```text
Update check occurs.
No update is downloaded.
Application continues normally.
```

---

## Test D — Update available

Create a test release.

For example:

```text
Current:
1.0.0

New:
1.0.1
```

Install `1.0.0`.

Launch.

Expected:

```text
1.0.1 detected.
```

Then:

```text
Download starts.
```

The application remains usable.

---

## Test E — Download progress

Verify that:

```text
download-progress
```

is correctly received.

Ensure no duplicate downloads occur.

---

## Test F — Update downloaded

After the download:

```text
update-downloaded
```

should be triggered.

Expected:

```text
Update ready.
```

No forced restart.

---

## Test G — Restart

Select:

```text
Restart Now
```

Expected:

```text
1.0.1 installed.
Application launches as 1.0.1.
```

---

## Test H — Defer update

Select:

```text
Later
```

Expected:

```text
Application remains on current version.
User can continue using ZoomGuru.
```

---

## Test I — Update server unavailable

Temporarily make the update endpoint unavailable.

Expected:

```text
ZoomGuru still launches.
ZoomGuru remains functional.
Updater error is logged.
```

---

## Test J — Firebase unavailable

If Firebase is the update provider:

```text
Block Firebase update endpoint.
Launch ZoomGuru.
```

Expected:

```text
Application works normally.
```

---

## Test K — Existing website download

Visit the existing ZoomGuru website.

Click the current:

```text
Download ZoomGuru
```

button.

Expected:

```text
Existing installer downloads exactly as before.
```

Do not break the initial installation path.

---

# 35. PRODUCTION BACKWARD COMPATIBILITY

The following must remain functional:

```text
Existing website
Existing download button
Existing installer
Existing frontend
Existing Electron application
Existing backend
Existing authentication
Existing database
Existing API
Existing GitHub repository
Existing production build
Existing release process
```

The updater is an additional capability.

---

# 36. MINIMAL CHANGE PRINCIPLE

When there are several valid implementation options:

Choose the one requiring the fewest changes to the existing application.

Do not refactor unrelated code.

Do not "clean up" unrelated files.

Do not rename existing components unnecessarily.

Do not migrate package managers.

Do not upgrade Electron unless absolutely necessary.

Do not upgrade React unless absolutely necessary.

Do not change Vite configuration unless necessary.

Do not change backend infrastructure.

Do not change hosting.

Do not change Firebase architecture beyond what is required.

---

# 37. RELEASE ARTIFACT VERIFICATION

Before publishing a release, verify that the generated artifacts are internally consistent.

For example:

```text
Application version:
1.0.1

latest.yml:
1.0.1

Installer:
ZoomGuru Setup 1.0.1.exe
```

Ensure the metadata points to the correct artifact.

Do not manually edit generated hashes.

Do not manually create update metadata unless absolutely necessary.

---

# 38. RELEASE SECURITY

The release process must ensure that only the developer/deployment environment can publish update files.

End users must only have download/read access.

The application must never have upload permissions.

---

# 39. FINAL ARCHITECTURE

After implementation, the preferred architecture should look like:

```text
                  PRIVATE GITHUB
                       │
                       │
                   Source Code
                       │
                       ▼
                 DEVELOPER PC
                       │
                       │ local build
                       ▼
                ELECTRON BUILDER
                       │
             ┌─────────┴──────────┐
             │                    │
             ▼                    ▼
       GitHub Release        Firebase Storage
       (if retained)        (update distribution)
                                  │
                                  │ HTTPS
                                  ▼
                         electron-updater
                                  │
                                  ▼
                         Installed ZoomGuru
                                  │
                         ┌────────┴────────┐
                         │                 │
                    No update          Update found
                         │                 │
                         ▼                 ▼
                    Continue         Download silently
                                           │
                                           ▼
                                      Update ready
                                           │
                                  ┌────────┴────────┐
                                  │                 │
                              Restart            Later
                                  │                 │
                                  ▼                 ▼
                             Install          Continue using
                             update
```

There must be **no dependency on GitHub Actions**.

---

# 40. FINAL REPORT

After implementation, provide a detailed but concise report containing:

## A. Architecture discovered

Describe the existing Electron/build architecture before your changes.

## B. Files changed

List every file created or modified.

## C. Dependencies added

List every dependency added.

If none were added because the dependency already existed, state that.

## D. Updater configuration

Explain exactly how `electron-updater` is configured.

## E. Update provider

Explicitly state whether the final updater uses:

```text
GitHub Releases
```

or:

```text
Firebase Storage
```

and explain why.

## F. GitHub Actions

Explicitly confirm:

```text
GitHub Actions are NOT required for the updater.
```

## G. Release process

Give the exact steps the developer should follow to release:

```text
1.0.1
```

from their local machine.

## H. Firebase

If Firebase is used, explain:

- storage path
- public read configuration
- upload process
- credentials required
- where credentials are stored
- confirmation that credentials are NOT packaged into ZoomGuru

## I. User experience

Explain exactly what a user sees when:

- no update exists
- an update exists
- download is in progress
- download finishes
- user postpones
- user restarts
- user is offline
- update server is unavailable

## J. Existing production pipeline

Explicitly identify which existing production components were left untouched.

## K. Testing

Report the tests performed and their results.

## L. Manual setup

Clearly list anything that still requires manual configuration.

Do not claim that a configuration has been completed if it has not actually been tested.

---

# FINAL INSTRUCTION

The most important principle is:

> **This is an ADD-ON, not a rewrite.**

Inspect the existing ZoomGuru project first.

Understand how it currently builds and releases.

Make the smallest safe changes possible.

Preserve the existing production pipeline.

Do not introduce GitHub Actions.

Do not expose private GitHub credentials.

Do not make the private GitHub repository public.

Use GitHub Releases for updates only if they can safely serve end users without exposing credentials.

Otherwise, use Firebase Storage as the public update distribution layer while keeping GitHub private.

The final result must allow ZoomGuru users to automatically receive updates without manually downloading a new installer every time, while ensuring the existing production application and release process continue to function exactly as they do today.