/** ponytail: merge multiple staking delegations to the same validator */

function addAmounts(a, b) {
  const sum = (Number(a) || 0) + (Number(b) || 0);
  if (Number.isInteger(sum) || sum >= 1) return String(sum);
  return sum.toFixed(9).replace(/\.?0+$/, '');
}

function mergeKey(row) {
  const v = (row.validator || row.validatorUrl || row.contract || '').toLowerCase();
  return `${row.chainId}|${row.symbol}|${v}`;
}

/** @param {object[]} rows */
export function mergeStakingRows(rows) {
  const wallet = rows.filter((r) => r.kind !== 'staking');
  const groups = new Map();

  for (const row of rows.filter((r) => r.kind === 'staking')) {
    const key = mergeKey(row);
    const prev = groups.get(key);
    if (!prev) {
      groups.set(key, { ...row });
      continue;
    }
    prev.amountNum += row.amountNum;
    prev.amount = addAmounts(prev.amount, row.amount);
    if (row.usd != null) prev.usd = (prev.usd ?? 0) + row.usd;
    prev.usdEstimated = prev.usdEstimated || row.usdEstimated;
  }

  return [...wallet, ...groups.values()];
}
