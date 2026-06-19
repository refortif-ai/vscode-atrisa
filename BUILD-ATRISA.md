# Building Atrisa.app

This repo is a Code-OSS fork rebranded as **Atrisa**, with the Atrisa VS Code
extension baked in as a built-in (system) extension so it ships with the app —
no marketplace install required.

## What was changed vs. upstream Code-OSS

1. **`product.json`** — rebranded: `nameShort`/`nameLong` → `Atrisa`,
   `applicationName` → `atrisa`, `darwinBundleIdentifier` →
   `ai.refortif.atrisa`, `urlProtocol` → `atrisa`, data/server/tunnel folder
   names, and the win32/linux name fields.
2. **App icons** — `resources/darwin/code.icns` (and the Linux/server PNGs) are
   regenerated from the teal Atrisa mark
   (`dynamic_wallpaper/atrisa_logo_square.png`). The packaging step renames the
   icns to `Atrisa.icns` inside the bundle automatically.
3. **`scripts/bake-atrisa-extension.sh`** — installs the Atrisa extension into a
   built Atrisa.app as a built-in extension.

The Atrisa extension itself is NOT wired into the in-repo `extensions/` build
pipeline: that pipeline assumes vscode's hoisted production-deps layout, whereas
the extension ships as a self-contained `.vsix` (esbuild bundle + allowlisted
native node_modules). Instead it is unpacked into the packaged app's built-in
extensions folder, which the desktop runtime scans at launch
(`EnvironmentService.builtinExtensionsPath` → `<app>/Contents/Resources/app/extensions`).

## GitHub Copilot removal

This distro ships **without** GitHub Copilot. Changes:

- **Bundled extension dropped** — `extensions/copilot` (GitHub Copilot Chat,
  ~2.5 GB source) is deleted, and its build tasks
  (`compileCopilotExtensionBuildTask`, `prepareCopilotRipgrepShimTask`) are
  removed from the darwin packaging series in `build/gulpfile.vscode.ts`.
- **First-run sign-in modal disabled** — the "Welcome to VS Code" onboarding
  wizard (sign in to Copilot/Google/Apple) is gated by
  `workbench.welcomePage.experimentalOnboarding`, whose default is flipped to
  `false` in `gettingStarted.contribution.ts` (and its `experiment` binding
  removed so it can't be re-enabled remotely).
- **`product.json`** — `trustedExtensionAuthAccess` and
  `builtInExtensionsEnabledWithAutoUpdates` (which referenced
  `GitHub.copilot-chat`) are emptied.
- **Built-in AI/Copilot UI fully disabled** — `chat.disableAIFeatures` default
  flipped to `true` (`chat.shared.contribution.ts`). This is VS Code's official
  switch to disable AND hide all built-in GitHub Copilot features: the chat
  view, the title-bar **"Copilot Sign In"** button, the "Use AI features with
  Copilot for free" setup affordances, and inline suggestions. It does NOT touch
  Atrisa's own extension chat (a separate webview view in the `atrisa` activity-
  bar container).
- **Right-side "Build with Agent" panel hidden by default** — the core
  multi-agent "sessions" chat lives in the secondary side bar.
  `workbench.secondarySideBar.defaultVisibility` is flipped from
  `visibleInWorkspace` to `hidden` (in both `workbench.contribution.ts` and the
  main-process fallback in `themeMainServiceImpl.ts`).
- **No "Setup VS Code" welcome/walkthrough on launch** — `workbench.startupEditor`
  default flipped from `welcomePage` to `none` (in `gettingStarted.contribution.ts`
  and the `themeMainServiceImpl.ts` fallback), so the getting-started walkthrough
  (whose body text still says "VS Code") never auto-opens.

A verification harness lives at `scripts/verify-atrisa-build.wf.js` (a
multi-agent audit workflow): it adversarially checks branding, Copilot removal,
icon, the baked-in extension's dependency closure, and residual VS Code strings.

> Build note: the marketplace built-in extensions (js-debug etc.) are fetched
> from GitHub Releases at build time. Export `GITHUB_TOKEN=$(gh auth token)`
> before `npm run gulp …` or repeated builds hit the 60-req/hr unauthenticated
> rate limit and fail with HTTP 504.

Note: `product.json`'s `defaultChatAgent` block is **kept**. It is inert config
(Copilot URLs/IDs) with no extension behind it, but several
extension-gallery/management code paths deref `product.defaultChatAgent.extensionId`
*without* a null guard — removing it crashes extension browse/install. With the
extension gone and the modal disabled, there is no functional or visible Copilot.

## Prerequisites

- Node **24.15.0** (see `.nvmrc`): `nvm install 24.15.0 && nvm use 24.15.0`
- The Atrisa extension checkout at `~/Coding/Analog/atrisa` with deps installed.

## Build steps

```bash
# 1. Build the Atrisa extension vsix (in the extension repo)
cd ~/Coding/Analog/atrisa
npm install
npm run build
npx vsce package --allow-missing-repository \
  --baseContentUrl https://github.com/refortif-ai/atrisa/raw/main \
  --baseImagesUrl https://github.com/refortif-ai/atrisa/raw/main
# -> atrisa-0.1.0.vsix

# 2. Build the packaged app (in this repo)
cd ~/Coding/vscode-atrisa
nvm use 24.15.0
npm install
npm run gulp -- vscode-darwin-arm64-min
# -> ../VSCode-darwin-arm64/Atrisa.app

# 3. Bake the extension in as a built-in
scripts/bake-atrisa-extension.sh \
  ~/Coding/Analog/atrisa/atrisa-0.1.0.vsix \
  ../VSCode-darwin-arm64/Atrisa.app

# 4. Launch
open ../VSCode-darwin-arm64/Atrisa.app
```

For an unminified (faster, larger) build use `vscode-darwin-arm64` instead of
`vscode-darwin-arm64-min`. For Intel Macs use `…-x64`.

## Notes / gotchas

- **`apache-arrow`**: `@lancedb/lancedb` `require()`s `apache-arrow` at load,
  declared as a *peerDependency*, so the extension's `.vscodeignore` must
  allowlist `apache-arrow` and its runtime closure or activation fails with
  `Cannot find module 'apache-arrow'`. This is fixed in the extension repo's
  `.vscodeignore`; rebuild the vsix after pulling that fix.
- The extension's native modules (`@lancedb/lancedb`, `@resvg/resvg-js`) are
  N-API/napi-rs binaries — ABI-stable across Node versions, so the host-arch
  prebuilt binaries run under Electron's Node without a rebuild.
- The app is **not code-signed**. Locally built, it runs without Gatekeeper
  quarantine. To distribute, sign + notarize the `.app`.
</content>
