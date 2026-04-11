import { test, expect } from '@playwright/test'

test('two players create/join room', async ({ browser }) => {
  // Player A (host)
  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  // Bypass login UI by pre-setting a user in localStorage, then go to authenticated home
  await pageA.addInitScript(() => localStorage.setItem('user', JSON.stringify({ username: 'Host' })))
  await pageA.goto('/home')
  // Host creates room (use role-based selector)
  const createBtn = pageA.getByRole('button', { name: 'Create Room' })
  await createBtn.waitFor({ state: 'visible', timeout: 30000 })
  await createBtn.click()
  // Wait for lobby header that contains CODE: <CODE> (narrow to header to avoid ambiguous matches)
  const headerLocator = pageA.locator('header').getByText(/^CODE:/)
  await headerLocator.waitFor({ state: 'visible', timeout: 30000 })
  const headerText = await headerLocator.innerText()
  const codeMatch = headerText.match(/CODE:\s*(\w+)/i)
  if (!codeMatch) throw new Error('Unable to parse room code from header: ' + headerText)
  const code = codeMatch[1].trim()
  console.log('E2E: created room code ->', code)

  // Player B (guest)
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  // Bypass login UI for guest and go to home
  await pageB.addInitScript(() => localStorage.setItem('user', JSON.stringify({ username: 'Guest' })))
  await pageB.goto('/home')
  // Fill join input using placeholder
  await pageB.getByPlaceholder('- - - - - -').fill(code)
  await pageB.getByRole('button', { name: 'Join' }).click()
  // Poll backend room endpoint to confirm guest joined 
  const roomA = await pageA.evaluate(async (code: string) => {
    const url = `http://localhost:8080/api/rooms/${encodeURIComponent(code)}`
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          if (json.players && json.players.length >= 2) return json
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 250))
    }
    return null
  }, code)
  expect(roomA).not.toBeNull()
  console.log('E2E: room players (after join) ->', roomA.players.map((p: any) => p.username || p.displayName || p.id))
  expect(roomA.players.length).toBeGreaterThanOrEqual(2)

  const roomB = await pageB.evaluate(async (code: string) => {
    const url = `http://localhost:8080/api/rooms/${encodeURIComponent(code)}`
    const res = await fetch(url)
    return res.ok ? res.json() : null
  }, code)
  expect(roomB).not.toBeNull()
  console.log('E2E: room players from B ->', roomB.players.map((p: any) => p.username || p.displayName || p.id))
  expect(roomB.players.length).toBeGreaterThanOrEqual(2)

  await ctxA.close()
  await ctxB.close()
})