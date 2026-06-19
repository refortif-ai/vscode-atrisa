export const meta = {
  name: 'verify-atrisa-build',
  description: 'Exhaustively verify the rebuilt Atrisa.app: branding, copilot removal, icon, baked-in extension, residual VS Code strings',
  phases: [
    { title: 'Audit', detail: 'parallel adversarial auditors over the app bundle + source diff' },
    { title: 'Synthesize', detail: 'merge verdicts into a pass/fail report' },
  ],
}

const APP = '/Users/sayanmitra/Coding/VSCode-darwin-arm64/Atrisa.app'
const RES = APP + '/Contents/Resources'
const APPROOT = RES + '/app'
const SRC = '/Users/sayanmitra/Coding/vscode-atrisa'
const EXT = '/Users/sayanmitra/Coding/Analog/atrisa'

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['dimension', 'pass', 'checks', 'problems', 'summary'],
  properties: {
    dimension: { type: 'string' },
    pass: { type: 'boolean', description: 'true only if every required check passed' },
    checks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'ok', 'evidence'],
        properties: {
          name: { type: 'string' },
          ok: { type: 'boolean' },
          evidence: { type: 'string', description: 'the concrete command output / value that proves ok' },
        },
      },
    },
    problems: { type: 'array', items: { type: 'string' }, description: 'concrete defects a user would notice; empty if none' },
    summary: { type: 'string' },
  },
}

phase('Audit')

const dims = [
  {
    key: 'branding',
    prompt: `You are an adversarial release auditor. Verify the macOS app at ${APP} is fully rebranded "Atrisa" with NO leftover "Code - OSS"/"code-oss" identifiers in machine-readable config. Use Bash only (read-only).
Check, with evidence from real commands:
1. ${APP}/Contents/Info.plist: CFBundleName == "Atrisa", CFBundleExecutable == "Atrisa", CFBundleIdentifier == "ai.refortif.atrisa", and CFBundleURLTypes contains a URL scheme "atrisa" (use /usr/libexec/PlistBuddy -c "Print ..." ).
2. ${APPROOT}/product.json (parse with node): nameShort & nameLong == "Atrisa", applicationName == "atrisa", urlProtocol == "atrisa", dataFolderName == ".atrisa-ide", darwinBundleIdentifier == "ai.refortif.atrisa". Report ANY field still containing "oss" or "Code - OSS".
3. The MacOS executable file ${APP}/Contents/MacOS/Atrisa exists and is executable.
Fail the dimension if any identifier is wrong. Return the structured verdict.`,
  },
  {
    key: 'copilot-removed',
    prompt: `You are an adversarial auditor verifying GitHub Copilot is removed from the built app at ${APP}. Bash only, read-only.
Check with evidence:
1. There is NO directory ${APPROOT}/extensions/copilot (ls should fail). List ${APPROOT}/extensions and confirm no folder name contains "copilot".
2. ${APPROOT}/product.json (parse with node): "trustedExtensionAuthAccess" is an empty object {}, "builtInExtensionsEnabledWithAutoUpdates" is an empty array []. IMPORTANT NUANCE: "defaultChatAgent" SHOULD still be PRESENT (it is intentionally kept — removing it crashes the renderer). So pass-condition for this check is: defaultChatAgent EXISTS. Flag as a problem ONLY if defaultChatAgent is MISSING.
3. In source ${SRC}/build/gulpfile.vscode.ts, the copilot build tasks are de-wired: grep shows compileCopilotExtensionBuildTask and prepareCopilotRipgrepShimTask are NOT in the active darwin task series (they may appear in imports/old comments).
Return structured verdict; pass=true only if copilot extension is absent AND the two arrays are empty AND defaultChatAgent is present.`,
  },
  {
    key: 'icon',
    prompt: `You are an adversarial auditor verifying the app icon is the Atrisa logo (from atrisa_logo.png, NOT the square variant). Bash only, read-only.
Check with evidence:
1. The bundle icon ${RES}/Atrisa.icns exists; 'file' reports it as a Mac OS icon.
2. shasum of ${RES}/Atrisa.icns EQUALS shasum of ${SRC}/resources/darwin/code.icns (the build renames code.icns -> Atrisa.icns; they must be byte-identical).
3. Decode the icns to png (sips -s format png ${RES}/Atrisa.icns --out /tmp/verify-icon.png) and confirm it is 1024x1024 (sips -g pixelWidth -g pixelHeight).
Return structured verdict; pass=true only if the icns exists, is valid, and SHA-matches the source.`,
  },
  {
    key: 'extension-baked',
    prompt: `You are an adversarial auditor verifying the Atrisa extension is correctly baked into ${APPROOT}/extensions/atrisa as a built-in. Bash only, read-only. The app's bundled node can be run via: ELECTRON_RUN_AS_NODE=1 "${APP}/Contents/MacOS/Atrisa" -e '<js>'.
Check with evidence:
1. ${APPROOT}/extensions/atrisa/package.json parses; name=="atrisa", publisher=="refortif-ai", main=="./out/extension.js"; contributes.customEditors includes viewType "atrisa.schEditor"; contributes.views has an "atrisa" container.
2. ${APPROOT}/extensions/atrisa/out/extension.js exists and is non-trivial (size > 100KB).
3. The runtime native/peer dependency closure is present under ${APPROOT}/extensions/atrisa/node_modules: apache-arrow, flatbuffers, tslib, @lancedb/lancedb, @lancedb/lancedb-darwin-arm64, @resvg/resvg-js, @resvg/resvg-js-darwin-arm64, @anthropic-ai/claude-agent-sdk, @anthropic-ai/claude-agent-sdk-darwin-arm64. List any that are MISSING (this is the apache-arrow class of bug).
4. Adversarial: starting from @lancedb/lancedb, is there any other require()'d top-level package that is absent? Spot-check by reading @lancedb/lancedb/package.json peerDependencies and confirming each installed.
Return structured verdict; pass=true only if manifest is correct AND every dependency in the list is present.`,
  },
  {
    key: 'residual-vscode-strings',
    prompt: `You are an adversarial brand auditor. The product must present as "Atrisa", and the user explicitly wanted GitHub Copilot and "Welcome to VS Code" surfaces stripped. Hunt for USER-VISIBLE residual branding in the built app. Bash only, read-only. This is a search/judgment task — be thorough but distinguish user-visible UI strings from harmless internal identifiers.
Investigate:
1. grep the bundled main NLS/strings for user-facing product name leakage that would show in the title bar/about/menus. Note: many internal "vscode"/"VS Code" code identifiers are unavoidable and NOT user-visible — do NOT flag those. Focus on what renders in UI.
2. Confirm the onboarding "Welcome to VS Code" sign-in modal cannot show: in source ${SRC}/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts the setting 'workbench.welcomePage.experimentalOnboarding' default is false. Report its actual default value.
3. Confirm the secondary side bar (agent "Build with Agent" panel) defaults to hidden: in ${SRC}/src/vs/workbench/browser/workbench.contribution.ts the 'workbench.secondarySideBar.defaultVisibility' default is 'hidden'. Report the actual default.
4. Judgment: list concrete user-visible places (if any) where "VS Code", "Code - OSS", or "Copilot" would still appear to an end user. Be specific and evidence-based; if you find none, say so. Do not invent problems from internal-only identifiers.
Return the structured verdict; pass=true if onboarding default is false AND secondarySideBar default is 'hidden' AND you found no clearly user-visible Copilot/VS Code branding regressions.`,
  },
  {
    key: 'source-diff-risk',
    prompt: `You are a senior reviewer auditing the uncommitted source changes in ${SRC} that produced this build, for correctness and risk. Bash only (git), read-only. Run: cd ${SRC} && git --no-pager diff -- product.json build/gulpfile.vscode.ts src/vs/workbench/browser/workbench.contribution.ts src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts ; and: git --no-pager status --short | grep -v '^ D extensions/copilot' .
Assess:
1. product.json is valid (the Atrisa rebrand + emptied copilot arrays + KEPT defaultChatAgent). Any malformed JSON or accidental removal of a needed key? (node -e require it.)
2. gulpfile.vscode.ts copilot de-wiring did not break the task series syntax (no dangling commas / removed task still referenced).
3. The two workbench setting-default flips are exactly the intended one-line changes and nothing else unintended changed.
4. Also check ${EXT}/.vscodeignore contains the apache-arrow allowlist (the extension packaging fix).
Return structured verdict; pass=true if all changes are correct and low-risk with no syntax/JSON breakage.`,
  },
]

const verdicts = await parallel(dims.map(d => () =>
  agent(d.prompt, { label: `audit:${d.key}`, phase: 'Audit', schema: VERDICT, effort: 'medium' })
))

phase('Synthesize')
const real = verdicts.filter(Boolean)
const report = {
  dimensions: real.map(v => ({ dimension: v.dimension, pass: v.pass, problems: v.problems, summary: v.summary })),
  allPass: real.length === dims.length && real.every(v => v.pass),
  totalProblems: real.flatMap(v => v.problems || []),
  missingAgents: dims.length - real.length,
}
log(`verify-atrisa-build: ${real.filter(v=>v.pass).length}/${dims.length} dimensions pass; ${report.totalProblems.length} problems`)
return report
