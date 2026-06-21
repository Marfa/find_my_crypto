/** ponytail: derive stake1 from base addr1 (no npm) — CIP-19 bech32 */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i += 1) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function hrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function bech32Decode(addr) {
  const lower = String(addr).toLowerCase();
  const pos = lower.lastIndexOf('1');
  if (pos < 1 || pos + 7 > lower.length) return null;
  const hrp = lower.slice(0, pos);
  const data = [];
  for (const c of lower.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d < 0) return null;
    data.push(d);
  }
  if (polymod(hrpExpand(hrp).concat(data)) !== 1) return null;
  return { hrp, data: data.slice(0, -6) };
}

function convertBits(data, fromBits, toBits, pad = false) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & ((1 << toBits) - 1));
    }
  }
  if (pad && bits) ret.push((acc << (toBits - bits)) & ((1 << toBits) - 1));
  return ret;
}

function bech32Encode(hrp, data) {
  const checksum = [0, 0, 0, 0, 0, 0];
  const values = data.concat(checksum);
  const mod = polymod(hrpExpand(hrp).concat(values)) ^ 1;
  const check = Array.from({ length: 6 }, (_, i) => (mod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...check].map((d) => CHARSET[d]).join('')}`;
}

/** Base addr1/addr_test1 with stake credential → stake1/stake_test1 */
export function stakeAddressFromBase(address) {
  const decoded = bech32Decode(address);
  if (!decoded?.hrp?.startsWith('addr')) return null;
  const raw = convertBits(decoded.data, 5, 8, false);
  if (raw.length < 57) return null;
  const stakeHash = raw.slice(-28);
  const isMainnet = decoded.hrp === 'addr';
  const stakeHrp = isMainnet ? 'stake' : 'stake_test';
  const stakeHeader = 0xe0 | (isMainnet ? 1 : 0);
  const payload = convertBits([stakeHeader, ...stakeHash], 8, 5, true);
  return bech32Encode(stakeHrp, payload);
}

export function selfCheckCardanoAddress() {
  const stake = stakeAddressFromBase(
    'addr1q8909sa0jafrg0uqhc8dwgh0g7j78qt956frmclcmw4jpux9k4s36j4tlqp0nepjdgsgpas4uydh6g3upa7z45mg82eqgfmv4n',
  );
  console.assert(
    stake === 'stake1u8zm2cgaf24lsqheusex5gyq7c27zxmayg7q7lp26d5r4vspu600d',
    'stake derive',
  );
  return 'ok';
}
