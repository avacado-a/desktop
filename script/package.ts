/* eslint-disable no-sync */

import * as cp from 'child_process'
import * as path from 'path'
import * as electronInstaller from 'electron-winstaller'
import { getProductName, getCompanyName } from '../app/package-info'
import {
  getDistPath,
  getOSXZipPath,
  getWindowsIdentifierName,
  getWindowsStandaloneName,
  getWindowsInstallerName,
  shouldMakeDelta,
  getUpdatesURL,
  isPublishable,
  getBundleSizes,
  getDistRoot,
  getDistArchitecture,
  getIconDirectory,
} from './dist-info'
import { isGitHubActions } from './build-platforms'
import { existsSync, rmSync, writeFileSync } from 'fs'
import { getVersion } from '../app/package-info'
import { computeBundleHashSync } from '../app/src/lib/compute-bundle-hash'
import { rename } from 'fs/promises'
import { join } from 'path'
import { assertNonNullable } from '../app/src/lib/fatal-error'

const distPath = getDistPath()
const productName = getProductName()
const outputDir = getDistRoot()

const assertExistsSync = (path: string) => {
  if (!existsSync(path)) {
    throw new Error(`Expected ${path} to exist`)
  }
}

if (process.platform === 'darwin') {
  packageOSX()
} else if (process.platform === 'win32') {
  packageWindows()
} else if (process.platform === 'linux') {
  packageLinux()
} else {
  console.error(`I don't know how to package for ${process.platform} :(`)
  process.exit(1)
}

console.log('Writing bundle size info…')
writeFileSync(
  path.join(getDistRoot(), 'bundle-size.json'),
  JSON.stringify(getBundleSizes())
)

console.log('Writing bundle hash…')
writeFileSync(
  path.join(getDistRoot(), 'bundle-hash.json'),
  JSON.stringify({
    bundleHash: computeBundleHashSync(path.join(__dirname, '..', 'out')),
  })
)

function packageOSX() {
  const dest = getOSXZipPath()
  rmSync(dest, { recursive: true, force: true })

  const appPath = `${distPath}/${productName}.app`
  const entitlementsDev = path.resolve(__dirname, 'entitlements-dev.plist')
  console.log('Cleaning and ad-hoc signing macOS bundle…')
  cp.execSync(
    `find "${appPath}" -name "._*" -o -name ".DS_Store" -delete || true`
  )
  cp.execSync(`xattr -cr "${appPath}" || true`)
  if (!process.env.APPLE_APPLICATION_CERT) {
    cp.execSync(
      `find "${appPath}" \\( -name "*.node" -o -name "copilot-runtime" \\) -exec codesign --force --sign - --entitlements "${entitlementsDev}" {} \\; || true`
    )
    cp.execSync(
      `codesign --force --deep --sign - --entitlements "${entitlementsDev}" "${appPath}"`
    )
  }

  console.log('Packaging for macOS (.zip and .dmg)…')
  cp.execSync(
    `cd "${distPath}" && zip -r -y -X -q "${dest}" "${productName}.app"`
  )

  const arch = getDistArchitecture()
  const dmgStaging = path.join(outputDir, 'dmg-staging')
  const dmgDest = path.join(outputDir, `GitHubDesktop-macOS-${arch}.dmg`)
  rmSync(dmgStaging, { recursive: true, force: true })
  rmSync(dmgDest, { recursive: true, force: true })
  cp.execSync(`mkdir -p "${dmgStaging}"`)
  cp.execSync(`cp -R "${appPath}" "${dmgStaging}/"`)
  cp.execSync(`ln -s /Applications "${dmgStaging}/Applications"`)
  const helperScript = `#!/bin/bash
echo "Removing macOS quarantine attribute for GitHub Desktop..."
xattr -cr "/Applications/${productName}.app" 2>/dev/null || true
xattr -cr "$(dirname "$0")/${productName}.app" 2>/dev/null || true
echo "Done! Opening GitHub Desktop..."
open "/Applications/${productName}.app" 2>/dev/null || open "$(dirname "$0")/${productName}.app"
`
  writeFileSync(
    path.join(dmgStaging, 'Open First (Bypass Gatekeeper).command'),
    helperScript,
    { mode: 0o755 }
  )
  cp.execSync(
    `hdiutil create -volname "${productName}" -srcfolder "${dmgStaging}" -ov -format UDZO "${dmgDest}"`
  )
  rmSync(dmgStaging, { recursive: true, force: true })
}

function packageLinux() {
  const arch = getDistArchitecture()
  const destTar = path.join(outputDir, `${productName}-linux-${arch}.tar.gz`)
  console.log('Packaging for Linux (.tar.gz and .deb)…')
  cp.execSync(
    `tar -czf "${destTar}" -C "${outputDir}" "${path.basename(distPath)}"`
  )

  try {
    const debArch = arch === 'arm64' ? 'arm64' : 'amd64'
    const debRoot = path.join(outputDir, 'deb-staging')
    const debDest = path.join(outputDir, `GitHubDesktop-linux-${arch}.deb`)
    rmSync(debRoot, { recursive: true, force: true })
    cp.execSync(
      `mkdir -p "${debRoot}/DEBIAN" "${debRoot}/opt/github-desktop" "${debRoot}/usr/bin" "${debRoot}/usr/share/applications"`
    )
    cp.execSync(`cp -R "${distPath}/"* "${debRoot}/opt/github-desktop/"`)
    cp.execSync(
      `ln -s /opt/github-desktop/github-desktop "${debRoot}/usr/bin/github-desktop"`
    )
    const control = `Package: github-desktop-pathplanner
Version: ${getVersion()}
Section: devel
Priority: optional
Architecture: ${debArch}
Maintainer: GitHub Desktop PathPlanner Fork
Description: GitHub Desktop with FRC PathPlanner (.path and .auto) visual diff viewer
`
    writeFileSync(path.join(debRoot, 'DEBIAN', 'control'), control)
    const desktopEntry = `[Desktop Entry]
Name=GitHub Desktop (PathPlanner)
Comment=GitHub Desktop with FRC PathPlanner Visual Diffs
Exec=/opt/github-desktop/github-desktop %U
Terminal=false
Type=Application
Categories=Development;RevisionControl;
`
    writeFileSync(
      path.join(
        debRoot,
        'usr/share/applications',
        'github-desktop-pathplanner.desktop'
      ),
      desktopEntry
    )
    cp.execSync(`dpkg-deb --build "${debRoot}" "${debDest}"`)
    rmSync(debRoot, { recursive: true, force: true })
  } catch (e) {
    console.warn('Warning: failed to create .deb package:', e)
  }
}

function packageWindows() {
  const iconSource = join(getIconDirectory(), 'icon-logo.ico')

  if (!existsSync(iconSource)) {
    console.error(`expected setup icon not found at location: ${iconSource}`)
    process.exit(1)
  }

  const splashScreenPath = path.resolve(
    __dirname,
    '../app/static/logos/win32-installer-splash.gif'
  )

  if (!existsSync(splashScreenPath)) {
    console.error(
      `expected setup splash screen gif not found at location: ${splashScreenPath}`
    )
    process.exit(1)
  }

  const iconUrl = 'https://desktop.githubusercontent.com/app-icon.ico'

  const nugetPkgName = getWindowsIdentifierName()
  const options: electronInstaller.Options = {
    name: nugetPkgName,
    appDirectory: distPath,
    outputDirectory: outputDir,
    authors: getCompanyName(),
    iconUrl: iconUrl,
    setupIcon: iconSource,
    loadingGif: splashScreenPath,
    exe: `${nugetPkgName}.exe`,
    title: productName,
    setupExe: getWindowsStandaloneName(),
    setupMsi: getWindowsInstallerName(),
  }

  if (shouldMakeDelta()) {
    const url = new URL(getUpdatesURL())
    // Make sure Squirrel.Windows isn't affected by partially or completely
    // disabled releases.
    url.searchParams.set('bypassStaggeredRelease', '1')
    options.remoteReleases = url.toString()
  }

  if (
    isGitHubActions() &&
    isPublishable() &&
    process.env.AZURE_CODE_SIGNING_TENANT_ID
  ) {
    assertNonNullable(process.env.RUNNER_TEMP, 'Missing RUNNER_TEMP env var')

    const acsPath = join(process.env.RUNNER_TEMP, 'acs')
    const dlibPath = join(acsPath, 'bin', 'x64', 'Azure.CodeSigning.Dlib.dll')

    assertExistsSync(dlibPath)

    const metadataPath = join(acsPath, 'metadata.json')
    const acsMetadata = {
      Endpoint: 'https://wus3.codesigning.azure.net/',
      CodeSigningAccountName: 'GitHubInc',
      CertificateProfileName: 'GitHubInc',
      CorrelationId: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }
    writeFileSync(metadataPath, JSON.stringify(acsMetadata))

    options.signWithParams = `/v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib "${dlibPath}" /dmdf "${metadataPath}"`
  }

  console.log('Packaging for Windows…')
  electronInstaller
    .createWindowsInstaller(options)
    .then(() => console.log(`Installers created in ${outputDir}`))
    .then(async () => {
      // electron-winstaller (more specifically Squirrel.Windows) doesn't let
      // us control the name of the nuget packages but we want them to include
      // the architecture similar to how the setup exe and msi do so we'll just
      // have to rename them here after the fact.
      const arch = getDistArchitecture()
      const prefix = `${getWindowsIdentifierName()}-${getVersion()}`

      for (const kind of shouldMakeDelta() ? ['full', 'delta'] : ['full']) {
        const from = join(outputDir, `${prefix}-${kind}.nupkg`)
        const to = join(outputDir, `${prefix}-${arch}-${kind}.nupkg`)

        console.log(`Renaming ${from} to ${to}`)
        await rename(from, to)
      }
    })
    .catch(e => {
      console.error(`Error packaging: ${e}`)
      process.exit(1)
    })
}
