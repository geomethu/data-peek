/**
 * AI SDK dependency consistency guard.
 *
 * The @ai-sdk/* packages all depend on @ai-sdk/provider-utils. If two
 * installed @ai-sdk packages resolve different major versions of
 * provider-utils, Electron's asar packaging can pick the wrong one at
 * runtime and the app crashes with errors like:
 *
 *     TypeError: (0 , import_provider_utils6.createProviderToolFactoryWithOutputSchema)
 *                is not a function
 *
 * This is exactly what shipped in v0.21.0 when @ai-sdk/xai (needing
 * provider-utils@4) was installed alongside ai@5 (pinned to
 * provider-utils@3). This test fails fast in CI if the same split
 * recurs — before anyone packages a release.
 *
 * The check runs against the real on-disk node_modules rather than a
 * parsed lockfile so it keeps working regardless of pnpm's hoisting
 * strategy.
 */

import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function readPackageJson(pkgDir: string): PackageJson | null {
  const file = path.join(pkgDir, 'package.json')
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PackageJson
  } catch {
    return null
  }
}

// node_modules is hoisted at the monorepo root.
const REPO_ROOT = path.resolve(__dirname, '../../../../../')
const AI_SDK_DIR = path.join(REPO_ROOT, 'node_modules/@ai-sdk')

function collectProviderUtilsRequirements(): Array<{
  package: string
  version: string
  requires: string
}> {
  if (!fs.existsSync(AI_SDK_DIR)) return []

  const entries = fs.readdirSync(AI_SDK_DIR, { withFileTypes: true })
  const results: Array<{ package: string; version: string; requires: string }> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'provider-utils' || entry.name === 'provider') continue

    const pkg = readPackageJson(path.join(AI_SDK_DIR, entry.name))
    if (!pkg) continue
    const requires = pkg.dependencies?.['@ai-sdk/provider-utils']
    if (!requires) continue
    results.push({
      package: `@ai-sdk/${entry.name}`,
      version: pkg.version ?? 'unknown',
      requires
    })
  }

  return results
}

function majorOf(range: string): string {
  // Strip leading ^ ~ >= <= =, take everything up to the first dot.
  const cleaned = range.replace(/^[^\d]*/, '')
  return cleaned.split('.')[0] ?? range
}

describe('@ai-sdk dependency consistency', () => {
  it('all @ai-sdk/* packages agree on the major version of provider-utils', () => {
    const requirements = collectProviderUtilsRequirements()
    expect(requirements.length).toBeGreaterThan(0)

    const majors = new Map<string, Array<{ package: string; version: string; requires: string }>>()
    for (const r of requirements) {
      const major = majorOf(r.requires)
      if (!majors.has(major)) majors.set(major, [])
      majors.get(major)!.push(r)
    }

    if (majors.size > 1) {
      const summary = [...majors.entries()]
        .map(
          ([major, pkgs]) =>
            `  provider-utils@${major}.x (${pkgs.length}):\n` +
            pkgs.map((p) => `    - ${p.package}@${p.version} needs ${p.requires}`).join('\n')
        )
        .join('\n')

      throw new Error(
        `Multiple major versions of @ai-sdk/provider-utils are installed.\n` +
          `This crashes the packaged Electron app at require-time.\n` +
          `Either downgrade the offending package or remove it:\n\n${summary}\n`
      )
    }

    expect(majors.size).toBe(1)
  })

  it('the resolved ai package pins a provider-utils version and matches', () => {
    const aiPkg = readPackageJson(path.join(REPO_ROOT, 'node_modules/ai'))
    expect(aiPkg).toBeTruthy()
    const aiRequires = aiPkg!.dependencies?.['@ai-sdk/provider-utils']
    expect(aiRequires).toBeTruthy()

    const requirements = collectProviderUtilsRequirements()
    for (const r of requirements) {
      expect(
        majorOf(r.requires),
        `${r.package}@${r.version} requires provider-utils ${r.requires}, but ai requires ${aiRequires}`
      ).toBe(majorOf(aiRequires!))
    }
  })
})
