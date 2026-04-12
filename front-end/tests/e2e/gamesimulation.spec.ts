import { test, expect } from '@playwright/test'

test('full game flow — 4 players submit clues -> discussion phase', async ({ browser }) => {
  test.setTimeout(120000)

  const names = ['Host', 'P1', 'P2', 'P3']

  // =========================
  // CONTEXT SETUP
  // =========================
  const contexts = await Promise.all(names.map(() => browser.newContext()))

  for (let i = 0; i < contexts.length; i++) {
    await contexts[i].addInitScript((username) => {
      localStorage.setItem('user', JSON.stringify({ username }))
    }, names[i])
  }

  const pages = await Promise.all(contexts.map(c => c.newPage()))

  // =========================
  // 1) HOST CREA STANZA
  // =========================
  const host = pages[0]

  await host.goto('/home')
  await host.getByRole('button', { name: /create room/i }).click()

  await host.waitForURL(/\/lobby\/.+/)

  const codeElement = host.getByText(/CODE:/)

  await expect(codeElement).toBeVisible()

  const codeText = await codeElement.textContent()
  if (!codeText) throw new Error('No code found')

  // ✅ prende SOLO il codice (6 caratteri)
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

  // aspetta che la lobby sia davvero renderizzata
  await expect(
    p.getByText(new RegExp(`CODE:\\s*${code}`))
  ).toBeVisible({ timeout: 20000 })

  // poi aspetta READY (che arriva dopo join backend)
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
  // 4) HOST START GAME
  // =========================
  const startBtn = host.getByRole('button', { name: /start game/i })
    // aspetta che il backend propaghi lo stato
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
  await Promise.all(
    pages.map(async (p) => {
      const btn = p.getByRole('button', { name: /got it/i })
      await expect(btn).toBeVisible({ timeout: 20000 })
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
        pages.map(async (p) => {
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

  // =========================
  // 7) DISCUSSION PHASE
  // =========================
  for (const p of pages) {
    await expect(p.locator('text=DISCUSSION PHASE')).toBeVisible({ timeout: 20000 })
  }

  // =========================
  // CLEANUP
  // =========================
  await Promise.all(contexts.map(c => c.close()))
})