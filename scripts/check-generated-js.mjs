import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TSC = path.join(ROOT, 'node_modules', '.bin', 'tsc')
const SOURCE_ROOTS = ['miniprogram', 'tests']

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'waimao-ts-build-'))
  try {
    const compile = spawnSync(TSC, ['--outDir', tempRoot, '--rootDir', ROOT], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    if (compile.status !== 0) {
      process.stderr.write(compile.stdout || '')
      process.stderr.write(compile.stderr || '')
      process.exitCode = compile.status || 1
      return
    }

    const typeScriptFiles = []
    for (const sourceRoot of SOURCE_ROOTS) {
      await collectTypeScriptFiles(path.join(ROOT, sourceRoot), typeScriptFiles)
    }

    const mismatches = []
    for (const sourcePath of typeScriptFiles) {
      const relativeTs = path.relative(ROOT, sourcePath)
      const relativeJs = relativeTs.replace(/\.ts$/, '.js')
      const committedPath = path.join(ROOT, relativeJs)
      const generatedPath = path.join(tempRoot, relativeJs)
      const [committed, generated] = await Promise.all([
        readTextOrNull(committedPath),
        readTextOrNull(generatedPath),
      ])
      if (committed !== generated) mismatches.push(relativeJs)
    }

    if (mismatches.length) {
      console.error('TypeScript 生成的 JavaScript 与仓库不一致：')
      mismatches.forEach(file => console.error(`- ${file}`))
      console.error('请先运行 npm run build，并提交对应 .js 文件。')
      process.exitCode = 1
      return
    }

    console.log(`[ok] generated JavaScript matches ${typeScriptFiles.length} TypeScript sources`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function collectTypeScriptFiles(directory, output) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectTypeScriptFiles(target, output)
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      output.push(target)
    }
  }
}

async function readTextOrNull(filePath) {
  try {
    return normalizeLineEndings(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null
    throw error
  }
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

await main()
