// The one door every transaction goes through (manual form, quick add, bank SMS, statement imports, Telegram,
// debts, bills, course payments, shopping, transfers, recurring rows, the site panel API).
// Before 2026-11 each of ~14 routes built and pushed its own row with its own rules, which is how settlements
// landed in the wrong account and bills got counted twice. Now they all hand their row to recordTx().
//
// recordTx(db, user, row, opts) — normalises the row in place, pushes it into db.transactions and returns it
// (null when the amount is not a positive number). It never writes storage: the caller still calls write(db) once.
//   • id / userId / createdAt filled when missing; amount → positive integer (rial); date → ISO (default today)
//   • kind ∈ income | expense | transfer; account defaults to «بدون حساب»; title trimmed; tags always an array
//   • category: kept when given; empty → learned rule → keyword → «متفرقه»
//   • opts.autoRules (rows that come from the user or the bank, not from another feature): an expense that is a
//     loan / bill installment is linked to it (matchInstallment); otherwise the pass-through rule runs when the user
//     has turned it on. An explicit row.passThrough (true/false) always wins.
export function makeLedger({ id, today, learnedCategory, suggestCategoryKeyword, isPassThroughTitle, matchInstallment }) {
  function recordTx(db, userOrId, row, opts = {}) {
    const user = typeof userOrId === 'string' ? ((db.users || []).find((u) => u.id === userOrId) || { id: userOrId }) : userOrId
    if (!row || !user) return null
    const amount = Math.round(Math.abs(Number(row.amount)))
    if (!(amount > 0) || !Number.isFinite(amount)) return null
    row.amount = amount
    if (!row.id) row.id = id()
    if (!row.userId) row.userId = user.id
    if (!row.createdAt) row.createdAt = Date.now()
    row.kind = row.kind === 'income' || row.kind === 'transfer' ? row.kind : 'expense'
    row.title = String(row.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || (row.kind === 'income' ? 'واریز' : 'برداشت')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) row.date = today()
    row.account = String(row.account || '').trim() || 'بدون حساب'
    if (!Array.isArray(row.tags)) row.tags = row.tags ? String(row.tags).split(/[،,]+/).map((x) => x.trim()).filter(Boolean).slice(0, 12) : []
    if (!String(row.category || '').trim()) row.category = learnedCategory(db, user.id, row.title) || suggestCategoryKeyword(row.title) || 'متفرقه'
    if (opts.autoRules && row.kind !== 'transfer') {
      const inst = row.kind === 'expense' && typeof matchInstallment === 'function' ? matchInstallment(db, user, row) : null
      if (inst) { delete row.passThrough; delete row.passBy }
      else if (row.passThrough === undefined && user.autoPassThrough && isPassThroughTitle(row.title)) { row.passThrough = true; row.passBy = 'rule' }
    }
    if (row.passThrough === false) delete row.passThrough
    db.transactions ??= []
    db.transactions.push(row)
    return row
  }
  return { recordTx }
}
