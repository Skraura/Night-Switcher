'use strict'

const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path   = require('path')
const fs     = require('fs')
const os     = require('os')
const { execSync, spawn } = require('child_process')

// electron-updater: only active in packaged builds
let autoUpdater = null
if (app.isPackaged) {
  try { autoUpdater = require('electron-updater').autoUpdater } catch {}
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const APPDATA      = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
const DATA_DIR     = path.join(APPDATA, 'NightSwitcher')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const LOG_FILE     = path.join(DATA_DIR, 'switch.log')
const TICK_TIMES_FILE = path.join(DATA_DIR, 'tick-times.json')

// ─── Logger ───────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    // Keep last 500 lines max to avoid unbounded growth
    let existing = ''
    if (fs.existsSync(LOG_FILE)) existing = fs.readFileSync(LOG_FILE, 'utf8')
    const lines = existing.split('\n').filter(Boolean)
    lines.push(line)
    fs.writeFileSync(LOG_FILE, lines.slice(-500).join('\n') + '\n')
  } catch {}
}

// DoD tracker integration file (written by DoD Tracker, read by us)
const DOD_FILE = (() => {
  for (const name of ['TcNo Account Switcher', 'TcNo-Acc-Switcher', 'NightSwitcher']) {
    const p = path.join(APPDATA, name, 'dod-integration.json')
    if (fs.existsSync(p)) return p
  }
  return path.join(APPDATA, 'TcNo Account Switcher', 'dod-integration.json')
})()

// Night Switcher ↔ DoD Tracker IPC file (we write requests, DoD Tracker acts on them)
const DOD_ACTION_FILE  = path.join(DATA_DIR, 'dod-action-request.json')
const DOD_ACTION_RESPONSE = path.join(DATA_DIR, 'dod-action-response.json')

fs.mkdirSync(DATA_DIR, { recursive: true })

// ─── Settings ─────────────────────────────────────────────────────────────────

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) } catch { return {} }
}
function saveSettings(s) {
  const cur = loadSettings()
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...cur, ...s }, null, 2))
}

// ─── Steam: read ALL accounts from loginusers.vdf ─────────────────────────────

function findSteamPath() {
  const candidates = [
    process.env.STEAM_PATH,
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'),
  ].filter(Boolean)

  for (const p of candidates) {
    if (p && fs.existsSync(path.join(p, 'Steam.exe'))) return p
  }

  // Try registry
  try {
    const reg = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf8' })
    const match = reg.match(/SteamPath\s+REG_SZ\s+(.+)/)
    if (match) return match[1].trim()
  } catch {}
  return null
}

function parseSteamVdf(content) {
  // Simple VDF text parser for loginusers.vdf
  // Returns { steamid: { AccountName, PersonaName, MostRecent, ... } }
  const users = {}
  const userBlockRe = /\"(7656119\d+)\"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs
  const kvRe = /\"(\w+)\"\s+\"([^\"]*)\"/g
  let um
  while ((um = userBlockRe.exec(content)) !== null) {
    const id = um[1]
    const block = um[2]
    const fields = {}
    let kv
    while ((kv = kvRe.exec(block)) !== null) {
      fields[kv[1]] = kv[2]
    }
    users[id] = fields
  }
  return users
}

function getSteamAccounts() {
  const steamPath = findSteamPath()
  if (!steamPath) return { ok: false, error: 'Steam not found. Make sure Steam is installed.', accounts: [] }

  const vdfFile = path.join(steamPath, 'config', 'loginusers.vdf')
  if (!fs.existsSync(vdfFile)) return { ok: false, error: 'loginusers.vdf not found.', accounts: [] }

  try {
    const content = fs.readFileSync(vdfFile, 'utf8')
    const users   = parseSteamVdf(content)
    const accounts = Object.entries(users).map(([id, f]) => ({
      id,
      name:       f.PersonaName || f.AccountName || id,
      accountName: f.AccountName || '',
      mostRecent: f.MostRecent === '1',
      avatar:     getSteamAvatar(steamPath, id),
    }))
    return { ok: true, accounts, steamPath }
  } catch (err) {
    return { ok: false, error: err.message, accounts: [] }
  }
}

// FIX: Return a base64 data URL instead of a raw file path.
// This avoids Electron's file:// security restrictions in the renderer,
// and also broadens the search to cover all naming patterns Steam uses.
function getSteamAvatar(steamPath, steamId) {
  // Steam's avatarcache names files by a hash, but sometimes also by
  // the lower 32 bits of the SteamID (SteamID3 / accountID).
  const steamId32 = (BigInt(steamId) & 0xFFFFFFFFn).toString()

  const searchDirs = [
    path.join(steamPath, 'config', 'avatarcache'),
    path.join(steamPath, 'appcache', 'librarycache'),
  ]

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue
    let files
    try { files = fs.readdirSync(dir) } catch { continue }

    const candidate = files.find(f =>
      f.startsWith(steamId) ||
      f.startsWith(steamId32) ||
      f.includes(steamId32)
    )

    if (candidate) {
      try {
        const filePath = path.join(dir, candidate)
        const data = fs.readFileSync(filePath)
        const ext  = candidate.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
        return `data:image/${ext};base64,${data.toString('base64')}`
      } catch { continue }
    }
  }

  return null
}

function getActiveSteamAccount() {
  const result = getSteamAccounts()
  if (!result.ok) return null
  return result.accounts.find(a => a.mostRecent) || null
}

// ─── Running Games ────────────────────────────────────────────────────────────

// Read all Steam library folders from libraryfolders.vdf so we know every path
// where Steam games can be installed (multi-drive setups).
function getSteamLibraryPaths(steamPath) {
  const paths = []
  if (!steamPath) return paths
  // Default steamapps dir
  paths.push(path.join(steamPath, 'steamapps'))
  try {
    const vdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
    if (fs.existsSync(vdf)) {
      const content = fs.readFileSync(vdf, 'utf8')
      // Match "path" keys in the VDF — each extra library has a "path" entry
      const pathRe = /"path"\s+"([^"]+)"/gi
      let m
      while ((m = pathRe.exec(content)) !== null) {
        const libPath = path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps')
        if (!paths.includes(libPath)) paths.push(libPath)
      }
    }
  } catch {}
  return paths
}

// Find all PIDs that are children of Steam (process tree method) PLUS any
// process whose executable or command line lives inside a Steam library folder,
// PLUS any process matching Unreal Engine's naming convention (*-Win64-Shipping,
// *-Win32-Shipping) — UE games often run elevated and WMI returns null for their
// ExecutablePath, so we must also fall back to CommandLine and name patterns.
function getRunningGames(steamPath) {
  log('getRunningGames: scanning...')
  const games = []
  const seenPids = new Set()

  const nonGameExes = new Set([
    'steam.exe', 'steamwebhelper.exe', 'steamservice.exe',
    'gameoverlayui.exe', 'gameoverlayrenderer.exe', 'gameoverlayrenderer64.exe',
    'steamoverlayvulkanlayer.dll',
  ])

  // Helper: push a process into games[] if not already seen and not Steam infra
  function addGame(p, method) {
    if (seenPids.has(p.ProcessId)) return
    if (nonGameExes.has((p.Name || '').toLowerCase())) return
    seenPids.add(p.ProcessId)
    games.push({ pid: p.ProcessId, parentPid: p.ParentProcessId, exeName: p.Name, exePath: p.ExecutablePath || '', gameName: p.Name || 'Unknown' })
    log(`getRunningGames: [${method}] FOUND game — PID=${p.ProcessId} name=${p.Name} path=${p.ExecutablePath || '(null)'} cmdline=${(p.CommandLine || '').slice(0, 120)}`)
  }

  try {
    // Fetch ExecutablePath AND CommandLine — CommandLine is populated even when
    // ExecutablePath is null (elevated UE processes, protected games, etc.)
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath,CommandLine,ParentProcessId | ConvertTo-Json -Compress"',
      { encoding: 'utf8', timeout: 15000 }
    )
    const raw  = JSON.parse(out)
    const list = Array.isArray(raw) ? raw : [raw]
    log(`getRunningGames: total system processes = ${list.length}`)

    // ── Method 1: Steam process tree ─────────────────────────────────────────
    const steamExes = new Set(['steam.exe', 'steamservice.exe', 'steamwebhelper.exe', 'gameoverlayui.exe'])
    const steamPids = new Set()
    for (const p of list) {
      if (p.Name && steamExes.has(p.Name.toLowerCase())) {
        steamPids.add(p.ProcessId)
        log(`getRunningGames: Steam PID ${p.ProcessId} (${p.Name})`)
      }
      // Any process whose exe path is inside the Steam root folder
      if (steamPath && p.ExecutablePath && p.ExecutablePath.toLowerCase().startsWith(steamPath.toLowerCase())) {
        steamPids.add(p.ProcessId)
      }
    }
    log(`getRunningGames: steam PIDs = [${[...steamPids].join(', ')}]`)

    const steamTree = new Set(steamPids)
    let added = true
    while (added) {
      added = false
      for (const p of list) {
        if (steamTree.has(p.ParentProcessId) && !steamTree.has(p.ProcessId)) {
          steamTree.add(p.ProcessId)
          added = true
        }
      }
    }
    log(`getRunningGames: full steam process tree = [${[...steamTree].join(', ')}]`)

    for (const p of list) {
      if (!steamTree.has(p.ProcessId)) continue
      if (steamPids.has(p.ProcessId)) continue
      addGame(p, 'tree')
    }

    // ── Method 2: Steam library path scan (ExecutablePath) ───────────────────
    // Catches games not under Steam tree — Riot, EA App, Ubisoft, etc.
    const libraryPaths = getSteamLibraryPaths(steamPath)
    log(`getRunningGames: library paths = ${JSON.stringify(libraryPaths)}`)
    const libraryPathsLower = libraryPaths.map(lp => lp.toLowerCase())
    for (const p of list) {
      if (seenPids.has(p.ProcessId)) continue
      if (p.ExecutablePath) {
        const exeLower = p.ExecutablePath.toLowerCase()
        if (libraryPathsLower.some(lib => exeLower.startsWith(lib))) {
          addGame(p, 'path(exe)')
          continue
        }
      }
      // ── Method 3: CommandLine path scan ──────────────────────────────────
      // WMI returns null ExecutablePath for elevated processes (common in UE games)
      // but CommandLine still contains the full quoted path to the exe.
      if (p.CommandLine) {
        const cmdLower = p.CommandLine.toLowerCase()
        if (libraryPathsLower.some(lib => cmdLower.includes(lib.toLowerCase()))) {
          addGame(p, 'path(cmd)')
          continue
        }
      }
    }

    // ── Method 4: Unreal Engine name pattern ─────────────────────────────────
    // Last-resort: if the process is named *-Win64-Shipping.exe or
    // *-Win32-Shipping.exe it is almost certainly a UE game binary.
    // This fires even when both ExecutablePath and CommandLine are null/empty
    // (can happen for highly-privileged anti-cheat wrapped processes).
    const uePattern = /-win(64|32)-shipping\.exe$/i
    for (const p of list) {
      if (seenPids.has(p.ProcessId)) continue
      if (!p.Name) continue
      if (uePattern.test(p.Name)) {
        addGame(p, 'UE-name')
      }
    }

    if (games.length === 0) log('getRunningGames: no game processes found (all methods)')
    else log(`getRunningGames: total games found = ${games.length}`)
  } catch (err) {
    log(`getRunningGames ERROR: ${err.message}`)
  }
  return games
}


function getAllProcesses() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress"',
      { encoding: 'utf8', timeout: 12000 }
    )
    const raw = JSON.parse(out)
    return Array.isArray(raw) ? raw : [raw]
  } catch (err) {
    log(`getAllProcesses ERROR: ${err.message}`)
    return []
  }
}

function getProcessTreePids(rootPid, allProcs) {
  const tree = new Set([rootPid])
  let added = true
  while (added) {
    added = false
    for (const p of allProcs) {
      if (tree.has(p.ParentProcessId) && !tree.has(p.ProcessId)) {
        tree.add(p.ProcessId)
        added = true
      }
    }
  }
  return [...tree]
}

function hardKillPid(pid) {
  try {
    const result = execSync(`taskkill /F /T /PID ${pid} 2>&1`, { encoding: 'utf8', timeout: 5000 })
    log(`hardKillPid(${pid}): OK — ${result.trim()}`)
  } catch (err) {
    log(`hardKillPid(${pid}): FAILED — ${err.message.trim()}`)
  }
}

function hardKillName(name) {
  try {
    const result = execSync(`taskkill /F /IM "${name}" 2>&1`, { encoding: 'utf8', timeout: 5000 })
    log(`hardKillName(${name}): OK — ${result.trim()}`)
  } catch (err) {
    // "not found" is normal if the exe isn't running — only log real errors
    const msg = err.message || ''
    if (!msg.includes('not found') && !msg.includes('ERROR: The process') && !msg.includes('no tasks')) {
      log(`hardKillName(${name}): ${msg.trim()}`)
    }
  }
}

function killGameProcess(pid, exeName, allProcs) {
  // Step 1: kill by PID tree (children first, then parent)
  const tree = getProcessTreePids(pid, allProcs)
  log(`killGameProcess(${pid}): tree = [${tree.join(', ')}]`)
  for (const p of [...tree].reverse()) hardKillPid(p)

  // Step 2: also kill by image name — a frozen/hung Unreal Engine process can
  // survive taskkill /F /PID (the kernel queues the signal but the process never
  // pumps its message loop to act on it). /IM bypasses that by going through
  // a different kernel path and reliably terminates even a fully hung process.
  if (exeName) hardKillName(exeName)
}

const COMPANION_EXES = [
  'EasyAntiCheat.exe',
  'EasyAntiCheat_EOS.exe',
  // Unreal Engine / EOS overlay processes (Day of Dragons and other UE games)
  'EOSOverlayRenderer-Win64-Shipping.exe',
  'EOSOverlayRenderer-Win32-Shipping.exe',
  'EpicOnlineServices.exe',
  'EpicWebHelper.exe',
  // BattlEye
  'BEService.exe',
  'BEService_x64.exe',
  // UE crash reporter — can hold file locks after the main process dies
  'CrashReportClient.exe',
  'CrashReportClient-Win64-Shipping.exe',
  // Steam overlay — holds session lock
  'steamwebhelper.exe',
]


function killSteam(steamPath) {
  try { execSync('taskkill /F /IM steam.exe', { timeout: 5000 }) } catch {}
}

function launchSteamWithAccount(steamPath, accountName) {
  // Steam supports -login <user> <pass> but we use the registry/autoLogin approach
  // Write the AutoLoginUser registry key so Steam logs in automatically
  try {
    execSync(`reg add "HKCU\\Software\\Valve\\Steam" /v AutoLoginUser /t REG_SZ /d "${accountName}" /f`)
    execSync(`reg add "HKCU\\Software\\Valve\\Steam" /v RememberPassword /t REG_DWORD /d 1 /f`)
  } catch {}
  // FIX: Removed -silent flag. Steam with -silent can silently fail to start
  // if its lock files haven't fully released yet. Without it, Steam shows its
  // normal loading window and is more reliable at completing startup.
  spawn(path.join(steamPath, 'Steam.exe'), [], { detached: true, stdio: 'ignore' }).unref()
}

function launchGame(appId) {
  spawn('cmd', ['/c', `start steam://rungameid/${appId}`], { detached: true, stdio: 'ignore' }).unref()
}

function getInstalledGames(steamPath) {
  const steamAppsDir = path.join(steamPath, 'steamapps')
  if (!fs.existsSync(steamAppsDir)) return []
  const games = []
  try {
    const files = fs.readdirSync(steamAppsDir).filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))
    for (const f of files) {
      const content = fs.readFileSync(path.join(steamAppsDir, f), 'utf8')
      const appId   = f.match(/appmanifest_(\d+)\.acf/)?.[1]
      const nameMatch = content.match(/"name"\s+"([^"]+)"/)
      if (appId && nameMatch) games.push({ appId, name: nameMatch[1] })
    }
  } catch {}
  return games
}

// ─── DoD Integration (read-only — DoD Tracker writes the file) ───────────────

function readDodIntegration() {
  try {
    if (!fs.existsSync(DOD_FILE)) return null
    return JSON.parse(fs.readFileSync(DOD_FILE, 'utf8'))
  } catch { return null }
}

// Write a dragon action request for DoD Tracker to pick up
// DoD Tracker watches dod-integration.json and our request file
function writeDragonAction(action) {
  // action: { dragonId, type: 'kill'|'dead'|'hungry'|'tick', steamId }
  const req = { ...action, timestamp: Date.now(), processed: false }
  fs.writeFileSync(DOD_ACTION_FILE, JSON.stringify(req, null, 2))
  // Also update dod-integration.json directly (optimistic local update)
  // The DoD Tracker will sync to Firebase when it sees the action
  try {
    const integ = readDodIntegration()
    if (!integ) return { ok: true, note: 'no_integration_file' }
    for (const [accId, dragons] of Object.entries(integ.dragons || {})) {
      const dragon = dragons.find(d => d.dragon_id === action.dragonId)
      if (!dragon) continue
      if (action.type === 'kill') {
        dragon.growth  = 'Hatchling'
        dragon.is_dead = false
      } else if (action.type === 'dead') {
        dragon.is_dead = true
      } else if (action.type === 'hungry') {
        dragon.is_hungry = !dragon.is_hungry
      }
      // 'tick' type: no local optimistic change needed — DoD Tracker handles it
    }
    integ.pendingAction = req
    integ.updatedAt = Date.now()
    fs.writeFileSync(DOD_FILE, JSON.stringify(integ, null, 2))
  } catch (err) {
    console.warn('[dod-action] Could not update integration file:', err.message)
  }
  return { ok: true }
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  })

  Menu.setApplicationMenu(null)

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdater()
})
app.on('window-all-closed', () => app.quit())

// ─── Auto Updater ─────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (!autoUpdater) return  // dev mode or require failed

  autoUpdater.autoDownload    = true   // download silently in background
  autoUpdater.autoInstallOnAppQuit = false  // we control when to install

  autoUpdater.on('update-available', (info) => {
    log(`[updater] Update available: v${info.version}`)
    mainWindow?.webContents.send('update:available', {
      version:     info.version,
      releaseNotes: info.releaseNotes || '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    log('[updater] App is up to date')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log(`[updater] Update downloaded: v${info.version}`)
    mainWindow?.webContents.send('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    log(`[updater] Error: ${err.message}`)
    mainWindow?.webContents.send('update:error', { message: err.message })
  })

  // Check for updates ~5 seconds after startup (give window time to render)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => log(`[updater] check failed: ${err.message}`))
  }, 5000)
}

ipcMain.handle('update:install', () => {
  autoUpdater?.quitAndInstall(false, true)
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

ipcMain.handle('app:getLog', () => {
  try { return fs.readFileSync(LOG_FILE, 'utf8') } catch { return '(no log yet)' }
})

ipcMain.handle('app:clearLog', () => {
  try { fs.writeFileSync(LOG_FILE, '') } catch {}
})

ipcMain.handle('steam:getAccounts', () => getSteamAccounts())
ipcMain.handle('steam:getActive', () => getActiveSteamAccount())
ipcMain.handle('steam:getRunningGames', () => { const s = loadSettings(); return getRunningGames(s.steamPath) })
ipcMain.handle('steam:getInstalledGames', (_, { steamPath }) => getInstalledGames(steamPath))

ipcMain.handle('steam:switchAccount', async (event, { accountName, steamPath, runGamesAfter }) => {
  const send = (msg) => {
    log(`[UI] ${msg}`)
    try { event.sender.send('switch:status', msg) } catch {}
  }
  log(`=== switchAccount START → ${accountName} ===`)
  try {
    // 1. Kill running games
    send('Stopping running games…')
    const games = getRunningGames(steamPath)
    log(`switchAccount: found ${games.length} game process(es)`)
    if (games.length > 0) {
      const allProcs = getAllProcesses()
      log(`switchAccount: system process snapshot = ${allProcs.length} entries`)
      for (const g of games) {
        log(`switchAccount: killing game "${g.gameName}" (${g.exeName}, PID=${g.pid})`)
        killGameProcess(g.pid, g.exeName, allProcs)
      }
    }
    // Always kill companion/overlay processes unconditionally — steamwebhelper
    // stays alive even when no game was detected and holds the session lock.
    log('switchAccount: killing companion exes by name (always)…')
    for (const exe of COMPANION_EXES) hardKillName(exe)
    log('switchAccount: waiting 3000ms for handles to release…')
    await new Promise(r => setTimeout(r, 3000))
    // Second pass — stubborn UE processes sometimes survive the first kill
    // (kernel may defer TerminateProcess until the first pass's handle closes).
    if (games.length > 0) {
      log('switchAccount: second-pass kill for any surviving game processes…')
      for (const g of games) hardKillName(g.exeName)
      for (const exe of COMPANION_EXES) hardKillName(exe)
    }

    // 2. Kill Steam
    send('Closing Steam…')
    log(`switchAccount: killing Steam at ${steamPath}`)
    killSteam(steamPath)
    log('switchAccount: waiting 4000ms for Steam to exit…')
    await new Promise(r => setTimeout(r, 4000))

    // 3. Launch Steam with new account
    send('Starting Steam…')
    log(`switchAccount: launching Steam as ${accountName}`)
    launchSteamWithAccount(steamPath, accountName)
    log('switchAccount: waiting 4000ms for Steam to start…')
    await new Promise(r => setTimeout(r, 4000))

    // 4. Re-launch games
    if (runGamesAfter && runGamesAfter.length > 0) {
      send('Launching games…')
      const installed = getInstalledGames(steamPath)
      const installedIds = new Set(installed.map(g => g.appId))
      for (const appId of runGamesAfter) {
        if (installedIds.has(String(appId))) {
          log(`switchAccount: re-launching game appId=${appId}`)
          launchGame(appId)
        }
      }
    }

    log('=== switchAccount DONE ===')
    return { ok: true }
  } catch (err) {
    log(`switchAccount ERROR: ${err.message}`)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('dod:read', () => readDodIntegration())
ipcMain.handle('dod:action', (_, action) => writeDragonAction(action))

// ─── Dragon tick timestamps (6-hour cooldown indicator) ───────────────────────

function loadTickTimes() {
  try { return JSON.parse(fs.readFileSync(TICK_TIMES_FILE, 'utf8')) } catch { return {} }
}
function saveTickTimes(times) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(TICK_TIMES_FILE, JSON.stringify(times, null, 2))
}

// Record the current time for a dragon tick (resets the 6-hour cooldown)
ipcMain.handle('dod:recordTick', (_, { dragonId }) => {
  const times = loadTickTimes()
  times[dragonId] = Date.now()
  saveTickTimes(times)
  return { ok: true }
})

// Return all tick timestamps so the renderer can compute readiness
ipcMain.handle('dod:getTickTimes', () => loadTickTimes())

ipcMain.handle('settings:load', () => loadSettings())
ipcMain.handle('settings:save', (_, s) => { saveSettings(s); return { ok: true } })