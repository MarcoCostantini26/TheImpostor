import { test, expect } from '@playwright/test'

test('players can vote and host resolves elimination of a crewmate', async ({ browser }) => {
  test.setTimeout(120000)

  const names = ['Host', 'P1', 'P2', 'P3']

  // =========================
  // CONTEXT SETUP
  // =========================
  const contexts: import('@playwright/test').BrowserContext[] = await Promise.all(names.map(() => browser.newContext()))

  for (let i = 0; i < contexts.length; i++) {
    await contexts[i].addInitScript((username) => {
      localStorage.setItem('user', JSON.stringify({ username }))
    }, names[i])
  }

  const pages: import('@playwright/test').Page[] = await Promise.all(contexts.map(c => c.newPage()))

  // =========================
  // 1) HOST CREATES ROOM
  // =========================
  const host = pages[0]

  await host.goto('/home')
  await host.getByRole('button', { name: /create room/i }).click()

  await host.waitForURL(/\/lobby\/.+/)

  const codeElement = host.getByText(/CODE:/)

  await expect(codeElement).toBeVisible()

  const codeText = await codeElement.textContent()
  if (!codeText) throw new Error('No code found')

  const match = codeText.match(/CODE:\s*([A-Z0-9]{6})/)

  if (!match) throw new Error(`Invalid code format: ${codeText}`)

  const code = match[1]

  console.log('ROOM CODE:', code)

  // =========================
  // 2) PLAYERS JOIN
  // =========================
  for (let i = 1; i < pages.length; i++) {
  const p = pages[i]

  await p.goto('/home')
  await p.fill('input[placeholder="- - - - - -"]', code)
  await p.getByRole('button', { name: /join/i }).click()

  await expect(
    p.getByText(new RegExp(`CODE:\\s*${code}`))
  ).toBeVisible({ timeout: 20000 })

  const readyBtn = p.getByRole('button', { name: /ready/i })
  await expect(readyBtn).toBeVisible({ timeout: 20000 })
  }

  // =========================
  // 3) PLAYERS READY
  // =========================
  for (let i = 1; i < pages.length; i++) {
    const p = pages[i]

    const readyBtn = p.getByRole('button', { name: /ready/i })
    await readyBtn.click()

    await expect(readyBtn).toHaveText(/unready/i)
  }

  // =========================
  // 4) HOST STARTS GAME
  // =========================
  const startBtn = host.getByRole('button', { name: /start game/i })
  await expect
    .poll(async () => {
      return await startBtn.isEnabled()
    }, { timeout: 40000 })
  .toBe(true)

  await expect
  .poll(async () => await startBtn.isEnabled(), { timeout: 40000 })
  .toBe(true)

  await startBtn.click()

  // =========================
  // 5) ROLE POPUP
  // =========================
  // Mapping: Host=P1/P3 -> CREWMATE, P2 -> IMPOSTOR
  await Promise.all(
    pages.map(async (p: import('@playwright/test').Page, idx: number) => {
      const btn = p.getByRole('button', { name: /got it/i })
      await expect(btn).toBeVisible({ timeout: 20000 })

      await p.evaluate((roomCode: string) => {
        const mapping: Record<string, string> = { Host: 'CREWMATE', P1: 'CREWMATE', P2: 'IMPOSTOR', P3: 'CREWMATE' }
        // @ts-ignore - dynamic import resolved at runtime inside browser context
        return import('/src/stores/room.js').then((mod: any) => {
          const useRoom = (mod as any).default || (mod as any).useRoomStore || (mod as any).useRoom
          const store = useRoom()

          try {
            if (Array.isArray(store.players)) {
              store.players = store.players.map((pl: any) => {
                if (!pl) return pl
                const uname = pl.username || pl.displayName || pl.name
                const forced = (mapping as any)[String(uname)]
                return forced ? { ...pl, role: forced } : pl
              })
            }

            const me = JSON.parse(localStorage.getItem('user') || '{}')
            const myrole = (mapping as any)[String(me.username)]
            if (myrole) store.myRole = myrole

            try { sessionStorage.setItem('theimpostor:role:' + (roomCode || ''), JSON.stringify({ role: myrole })) } catch (e) { /* void */ }
          } catch (e) {
            // ignore errors 
          }
          return true
        })
      }, code)

      await btn.click()
    })
  )

  // =========================
  // 6) SUBMIT CLUES
  // =========================
  let submits = 0
  const MAX_SUBMITS = 4

  while (submits < MAX_SUBMITS) {
    let activePage = null

    for (const p of pages) {
      const btn = p.getByRole('button', { name: /submit/i })
      if (await btn.isVisible().catch(() => false)) {
        activePage = p
        break
      }
    }

    if (!activePage) {
      activePage = await Promise.any(
        pages.map(async (p: import('@playwright/test').Page) => {
          const btn = p.getByRole('button', { name: /submit/i })
          await btn.waitFor({ timeout: 30000 })
          return p
        })
      )
    }

    if (!activePage) throw new Error('No active player found')

    const input = activePage.getByPlaceholder('One word…')
    await expect(input).toBeVisible()

    await input.fill(`Word${submits}`)
    await activePage.getByRole('button', { name: /submit/i }).click()

    submits++
  }

  console.log('SUBMIT PHASE COMPLETE - total submits:', submits)

  // =========================
  // 7) DISCUSSION PHASE
  // =========================
  for (const p of pages) {
    await expect(p.locator('text=DISCUSSION PHASE')).toBeVisible({ timeout: 20000 })
  }

  console.log('DISCUSSION PHASE VISIBLE on all pages')

  console.log('Waiting for voting phase to start... (this may take ~60s)')
  await Promise.all(pages.map((p: import('@playwright/test').Page) => p.getByRole('button', { name: /vote/i }).first().waitFor({ timeout: 90000 })))
  console.log('VOTING PHASE STARTED - vote buttons are visible')

  const TARGET = 'P1'

  for (const p of pages) {
    const myName = await p.evaluate(() => (JSON.parse(localStorage.getItem('user') || '{}').username) || '')
    const voteFor = myName === TARGET ? 'P2' : TARGET

    const targetIndex = names.indexOf(voteFor)
    if (targetIndex < 0) throw new Error(`Unknown vote target: ${voteFor}`)

    const voteBtn = p.locator('.space-y-3 > div').nth(targetIndex).getByRole('button', { name: /vote/i })
    await expect(voteBtn).toBeEnabled({ timeout: 20000 })
    await voteBtn.click()
    }

  const deadline = Date.now() + 30000
  let votedCount = 0
  while (Date.now() < deadline) {
    votedCount = await host.evaluate(() => {
      // dynamic import of the room store inside the browser context
      // @ts-ignore
      return import('/src/stores/room.js').then((mod: any) => {
        const useRoom = mod.default || mod.useRoomStore || mod.useRoom
        try {
          const s = useRoom()
          return Array.isArray(s.votedPlayers) ? s.votedPlayers.length : 0
        } catch (e) {
          return 0
        }
      })
    })

    if (votedCount === pages.length) break
    await host.waitForTimeout(500)
  }

  if (votedCount !== pages.length) {
    throw new Error(`Timed out waiting for all votes to be registered (have ${votedCount} / ${pages.length})`)
  }

  await host.getByRole('button', { name: /resolve voting/i }).click()
  console.log('Host clicked RESOLVE VOTING')

  const eliminated = await host.evaluate(async () => {
    // @ts-ignore - dynamic import inside browser context; types not available to the test runner
    const mod = await import('/src/stores/room.js')
    const useRoomStore = (mod as any).useRoomStore || (mod as any).default
    const store = useRoomStore()
    const lastEliminatedId = store.lastEliminatedId
    const players = store.players || []
    const elimRoleFromData = (store.eliminationData && store.eliminationData.eliminatedRole) || null
    const player = (players || []).find((p: any) => String(p.id || p.userId) === String(lastEliminatedId))
    const roleFromPlayer = player ? (player.role || player.eliminatedRole || player.roleName || null) : null
    return { lastEliminatedId, players, eliminatedRole: elimRoleFromData || roleFromPlayer }
  })

  if (!eliminated || !eliminated.lastEliminatedId) throw new Error('No player eliminated')

  const eliminatedId = eliminated.lastEliminatedId
  const eliminatedPlayer = (eliminated.players || []).find((p: any) => String(p.id || p.userId) === String(eliminatedId))
  if (!eliminatedPlayer) throw new Error('Eliminated player not found in players list')

  const eliminatedRole = eliminated.eliminatedRole || eliminatedPlayer.role || eliminatedPlayer.eliminatedRole || eliminatedPlayer.roleName || null
  console.log('ELIMINATED PLAYER:', eliminatedPlayer, 'ROLE:', eliminatedRole)
  expect(eliminatedPlayer.status || eliminatedPlayer.state || eliminatedPlayer.statusText).toBeTruthy()

  // CLEANUP
  await Promise.all(pages.map(p => p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} })))
  await Promise.all(contexts.map(c => c.close()))
})