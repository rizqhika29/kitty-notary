/**
 * GenLayer custom calldata encoder/decoder.
 *
 * Implements the ULEB128-based tagged binary format used by GenLayer
 * for encoding smart contract call parameters.
 */

const TAG_SPECIAL = 0;
const TAG_PINT = 1;
const TAG_NINT = 2;
const TAG_BYTES = 3;
const TAG_STR = 4;
const TAG_ARR = 5;
const TAG_MAP = 6;

const SPECIAL_NULL = 0;
const SPECIAL_FALSE = 8;
const SPECIAL_TRUE = 16;
const SPECIAL_ADDR = 24;

export type CalldataValue =
  | null
  | boolean
  | string
  | number
  | bigint
  | Uint8Array
  | CalldataValue[]
  | { [key: string]: CalldataValue };

function uleb128Encode(value: number): number[] {
  if (value === 0) return [0];
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v > 0) byte |= 0x80;
    bytes.push(byte);
  }
  return bytes;
}

function uleb128Decode(data: Uint8Array, offset: number): { value: number; newOffset: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, newOffset: pos };
}

function addressToBytes(addr: string): Uint8Array {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function stringToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function calldataEncode(value: CalldataValue): Uint8Array {
  if (value === null || value === undefined) {
    return new Uint8Array([SPECIAL_NULL]);
  }

  if (value === false) {
    return new Uint8Array([SPECIAL_FALSE]);
  }

  if (value === true) {
    return new Uint8Array([SPECIAL_TRUE]);
  }

  if (typeof value === "string") {
    if (value.startsWith("0x") && value.length === 42) {
      const addrBytes = addressToBytes(value);
      const header = uleb128Encode((20 << 3) | TAG_SPECIAL);
      return new Uint8Array([...header, SPECIAL_ADDR, ...addrBytes]);
    }
    const strBytes = stringToBytes(value);
    const header = uleb128Encode((strBytes.length << 3) | TAG_STR);
    return new Uint8Array([...header, ...strBytes]);
  }

  if (typeof value === "number") {
    if (value >= 0) {
      const header = uleb128Encode((value << 3) | TAG_PINT);
      return new Uint8Array(header);
    } {
      const header = uleb128Encode(((-value - 1) << 3) | TAG_NINT);
      return new Uint8Array(header);
    }
  }

  if (typeof value === "bigint") {
    if (value >= BigInt(0)) {
      const header = uleb128Encode(Number(value) << 3 | TAG_PINT);
      return new Uint8Array(header);
    } {
      const header = uleb128Encode((Number(-value - BigInt(1)) << 3) | TAG_NINT);
      return new Uint8Array(header);
    }
  }

  if (value instanceof Uint8Array) {
    const header = uleb128Encode((value.length << 3) | TAG_BYTES);
    return new Uint8Array([...header, ...value]);
  }

  if (Array.isArray(value)) {
    const header = uleb128Encode((value.length << 3) | TAG_ARR);
    const parts: number[] = [...header];
    for (const item of value) {
      const encoded = calldataEncode(item);
      parts.push(...encoded);
    }
    return new Uint8Array(parts);
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const header = uleb128Encode((keys.length << 3) | TAG_MAP);
    const parts: number[] = [...header];
    for (const key of keys) {
      const keyBytes = stringToBytes(key);
      const keyLen = uleb128Encode(keyBytes.length);
      parts.push(...keyLen, ...keyBytes);
      const valEncoded = calldataEncode(value[key]);
      parts.push(...valEncoded);
    }
    return new Uint8Array(parts);
  }

  throw new Error(`Unsupported calldata type: ${typeof value}`);
}

export function calldataDecode(data: Uint8Array, offset = 0): { value: CalldataValue; newOffset: number } {
  if (offset >= data.length) return { value: null, newOffset: offset };

  const byte0 = data[offset];

  if (byte0 === SPECIAL_NULL) return { value: null, newOffset: offset + 1 };
  if (byte0 === SPECIAL_FALSE) return { value: false, newOffset: offset + 1 };
  if (byte0 === SPECIAL_TRUE) return { value: true, newOffset: offset + 1 };

  if (byte0 === SPECIAL_ADDR) {
    const addr = bytesToHex(data.slice(offset + 1, offset + 21));
    return { value: addr, newOffset: offset + 21 };
  }

  const { value: raw, newOffset } = uleb128Decode(data, offset);
  const tag = raw & 0x07;
  const len = raw >> 3;

  switch (tag) {
    case TAG_PINT:
      return { value: len, newOffset };
    case TAG_NINT:
      return { value: -(len + 1), newOffset };
    case TAG_BYTES:
      return { value: data.slice(newOffset, newOffset + len), newOffset: newOffset + len };
    case TAG_STR:
      return { value: new TextDecoder().decode(data.slice(newOffset, newOffset + len)), newOffset: newOffset + len };
    case TAG_ARR: {
      const items: CalldataValue[] = [];
      let pos = newOffset;
      for (let i = 0; i < len; i++) {
        const decoded = calldataDecode(data, pos);
        items.push(decoded.value);
        pos = decoded.newOffset;
      }
      return { value: items, newOffset: pos };
    }
    case TAG_MAP: {
      const obj: { [key: string]: CalldataValue } = {};
      let pos = newOffset;
      for (let i = 0; i < len; i++) {
        const { value: keyLen, newOffset: keyLenEnd } = uleb128Decode(data, pos);
        pos = keyLenEnd;
        const key = new TextDecoder().decode(data.slice(pos, pos + keyLen));
        pos += keyLen;
        const decoded = calldataDecode(data, pos);
        obj[key] = decoded.value;
        pos = decoded.newOffset;
      }
      return { value: obj, newOffset: pos };
    }
    default:
      throw new Error(`Unknown calldata tag: ${tag}`);
  }
}

export function encodeCalldataObject(
  method: string,
  args: CalldataValue[] = [],
  kwargs: { [key: string]: CalldataValue } | null = null
): Uint8Array {
  const obj: { [key: string]: CalldataValue } = { method };
  if (args.length > 0) obj.args = args;
  if (kwargs) obj.kwargs = kwargs;
  return calldataEncode(obj);
}
