import { execSync } from 'child_process'

/**
 * Executes a shell command and returns the output
 */
function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch (e) {
    return null
  }
}

/**
 * Finds packages that use preinstall, install or postinstall scripts.
 *
 * ⚠️ This scripts takes some time.
 *
 * Usage:
 *
 * `node scripts/check-install-scripts.js > check-install-scripts.log`
 */
async function checkScripts() {
  console.log('🔍 Fetching full dependency tree...')

  // Get all unique package names from the project
  const listJson = JSON.parse(
    run('pnpm list --recursive --depth Infinity --json'),
  )
  const allPkgs = new Set()

  // Flatten the pnpm list output
  const processDeps = deps => {
    if (!deps) return
    Object.keys(deps).forEach(pkg => {
      allPkgs.add(pkg)
      if (deps[pkg].dependencies) processDeps(deps[pkg].dependencies)
    })
  }

  listJson.forEach(project => {
    processDeps(project.dependencies)
    processDeps(project.devDependencies)
  })

  const pkgList = Array.from(allPkgs)
  console.log(
    `📦 Found ${pkgList.length} unique dependencies. Checking scripts...\n`,
  )

  const flagged = []

  for (const pkg of pkgList) {
    process.stdout.write(`Checking ${pkg}... \r`)

    // Fetch scripts via pnpm view
    const scriptData = run(`pnpm view ${pkg} scripts --json`)

    if (scriptData) {
      const scripts = JSON.parse(scriptData)
      const hooks = ['preinstall', 'install', 'postinstall'].filter(
        h => scripts[h],
      )

      if (hooks.length > 0) {
        flagged.push({ package: pkg, hooks: hooks.join(', ') })
        console.log(`⚠️  ${pkg} has hooks: ${hooks.join(', ')}`)
      }
    }
  }

  console.log('\n--- Scan Complete ---')
  if (flagged.length > 0) {
    console.table(flagged)
  } else {
    console.log('✅ No lifecycle scripts found in transitive dependencies.')
  }
}

checkScripts()
