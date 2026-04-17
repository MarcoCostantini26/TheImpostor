import { test, expect } from '@playwright/test'

test('players vote the impostor but he guesses the secret word (so he wins)', async ({ browser }) => {
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
    .poll(async () => await startBtn.isEnabled(), { timeout: 90000 })
    .toBe(true)

  await host.waitForTimeout(200)
  await startBtn.click()

  // =========================
  // 5) ROLE POPUP
  // =========================
  let detectedImpostor: string | null = null
  for (let idx = 0; idx < pages.length; idx++) {
    const p = pages[idx]
    const gotIt = p.getByRole('button', { name: /got it/i })
    await expect(gotIt).toBeVisible({ timeout: 20000 })

    const myRole = await p.evaluate(async () => {
      // @ts-ignore
      const mod = await import('/src/stores/room.js')
      const useRoomStore = (mod as any).useRoomStore || (mod as any).default
      const store = useRoomStore()
      return store.myRole
    })
    if (myRole === 'IMPOSTOR') detectedImpostor = names[idx]

    await gotIt.click()
  }
  if (!detectedImpostor) detectedImpostor = 'P2'
  console.log('DETECTED IMPOSTOR:', detectedImpostor)

  // =========================
  // 6) SUBMIT CLUES
  // =========================
  let submits = 0
  const MAX_SUBMITS = 4

  while (submits < MAX_SUBMITS) {
    let activePage: import('@playwright/test').Page | null = null

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

  const TARGET = detectedImpostor

  for (const p of pages) {
    const myName = await p.evaluate(() => (JSON.parse(localStorage.getItem('user') || '{}').username) || '')
    const voteFor = myName === TARGET ? 'P1' : TARGET

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

  // Read the secret word from any crewmate's store and use it as the impostor's final guess
  const secrets = await Promise.all(pages.map(async (p: import('@playwright/test').Page) => {
    return p.evaluate(async () => {
      // @ts-ignore
      const mod = await import('/src/stores/room.js')
      const useRoomStore = (mod as any).useRoomStore || (mod as any).default
      const store = useRoomStore()
      return { role: store.myRole, secret: store.mySecretWord }
    })
  }))
  const found = secrets.find((s: any) => s && s.role !== 'IMPOSTOR' && s.secret)
  const SECRET_GUESS = found?.secret || (secrets[0]?.secret ?? 'WRONGGUESS')

  await Promise.all(pages.map(async (p: import('@playwright/test').Page) => {
    const me = await p.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}').username)
    if (me === detectedImpostor) {
      try {
        const banner = p.getByText(/final chance|final chance to guess|final chance!/i)
        await banner.waitFor({ timeout: 3000 })

        let guessInput = null
        if (await p.getByPlaceholder(/guess/i).isVisible().catch(() => false)) guessInput = p.getByPlaceholder(/guess/i)
        else if (await p.getByPlaceholder(/word/i).isVisible().catch(() => false)) guessInput = p.getByPlaceholder(/word/i)
        else guessInput = p.locator('input[type="text"]').first()

        await expect(guessInput).toBeVisible({ timeout: 20000 })
        await guessInput.fill(SECRET_GUESS)

        const submitBtn = p.getByRole('button', { name: /submit guess|submit|guess/i })
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click()
        } else {
          const btn2 = banner.locator('button').first()
          if (await btn2.isVisible().catch(() => false)) await btn2.click()
        }

        await p.waitForTimeout(500)
      } catch (e) {
        // ignore
      }
    }
  }))

  const finalState = await host.evaluate(async () => {
    // @ts-ignore - dynamic import inside browser context; types not available to the test runner
    const mod = await import('/src/stores/room.js')
    const useRoomStore = (mod as any).useRoomStore || (mod as any).default
    const store = useRoomStore()
    const impostorId = store.impostorIdForGuess
    const players = store.players || []
    const player = (players || []).find((p: any) => String(p.id || p.userId) === String(impostorId))
    return { impostorId, players, impostorUsername: player?.username || null }
  })

  if (!finalState || !finalState.impostorId) throw new Error('ImpostorGuessPhase was not triggered — impostor was not voted out')

  console.log('ELIMINATED IMPOSTOR:', finalState.impostorUsername, '(id:', finalState.impostorId, ')')
  console.log('IMPOSTOR GUESSED SECRET WORD:', SECRET_GUESS)

  const winnerDeadline = Date.now() + 10000
  let winner = null
  while (Date.now() < winnerDeadline) {
    winner = await host.evaluate(() => {
      // @ts-ignore
      return import('/src/stores/room.js').then((mod: any) => {
        const useRoom = mod.default || mod.useRoomStore || mod.useRoom
        try {
          const s = useRoom()
          return s.gameWinner || null
        } catch (e) {
          return null
        }
      })
    })
    if (winner) break
    await host.waitForTimeout(250)
  }

  console.log('GAME WINNER:', winner)
  expect(String(winner || '').toUpperCase()).toBe('IMPOSTOR_WINS')
  expect(finalState.impostorUsername).toBe(detectedImpostor)

  // CLEANUP
  await Promise.all(pages.map(p => p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} })))
  await Promise.all(contexts.map(c => c.close()))
})
