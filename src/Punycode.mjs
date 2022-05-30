//! Punycode converter that fully complies to RFC 3492 and RFC 5891
//!
//! Heavly based on https://github.com/bestiejs/punycode.js/
import * as List from "./List.mjs";

export {ucs2Decode};
export {ucs2Encode};
export {decode};
export {encode};
export {toASCII};
export {toUnicode};

const MAX_INT = 0x7FFFFFFF;
const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128; // 0x80
const DELIMITER = "-"; // "\x2D"
const BASE_MINUS_TMIN = BASE - T_MIN;

const punycodeRe = /^xn--/;
const nonASCIIRe = /[^\0-\x7E]/; // non-ASCII chars
const separatorsRe = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

/// Creates a list of numeric code points of each Unicode chars in str.
function ucs2Decode(str) {
    const output = [];
    let counter = 0;
    const length = str.length;

    while (counter < length) {
        const value = str.charCodeAt(counter++);
        if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
            // It"s a high surrogate, and there is a next character.
            const extra = str.charCodeAt(counter++);
            if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
                output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
            } else {
                output.push(value);
                counter--;
            }
        } else {
            output.push(value);
        }
    }
    return output;
}

/// Creates a string based on an array of numeric code points.
function ucs2Encode(list) {
    return String.fromCodePoint(...list);
}

/// Converts a Punycode string to a string of Unicode string
///
/// Converts a Punycode string of ASCII-only symbols to a string of Unicode
/// symbols.
function decode(input) {
    const output = [];
    const inputlen = input.length;

    let i = 0;
    let n = INITIAL_N;
    let bias = INITIAL_BIAS;

    // Handle the basic code points: let `basic` be the number of input code
    // points before the last delimiter, or `0` if there is none, then copy
    // the first basic code points to the output.

    let basic = input.lastIndexOf(DELIMITER);

    if (basic < 0) {
        basic = 0;
    }

    for (let j = 0; j < basic; ++j) {
        // if it"s not a basic code point
        if (input.charCodeAt(j) >= 0x80) {
            throw notBasicError();
        }
        output.push(input.charCodeAt(j));
    }

    for (let index = basic > 0 ? basic + 1 : 0; index < inputlen;) {

        // `index` is the index of the next character to be consumed.
        // Decode a generalized variable-length integer into `delta`,
        // which gets added to `i`. The overflow checking is easier
        // if we increase `i` as we go, then subtract off its starting
        // value at the end to obtain `delta`.
        let oldi = i;
        for (let w = 1, k = BASE; ; k += BASE) {

            if (index >= inputlen) {
                throw invalidInputError();
            }

            const digit = basicToDigit(input.charCodeAt(index++));

            if (digit >= BASE || digit > Math.floor((MAX_INT - i) / w)) {
                throw overflowError();
            }

            i += digit * w;
            const t = k <= bias ? T_MIN : (k >= bias + T_MAX ? T_MAX : k - bias);

            if (digit < t) {
                break;
            }

            const baseMinusT = BASE - t;
            if (w > Math.floor(MAX_INT / baseMinusT)) {
                throw overflowError();
            }

            w *= baseMinusT;

        }

        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi == 0);

        // `i` was supposed to wrap around from `out` to `0`,
        // incrementing `n` each time, so we"ll fix that now:
        if (Math.floor(i / out) > MAX_INT - n) {
            throw overflowError();
        }

        n += Math.floor(i / out);
        i %= out;

        // Insert `n` at position `i` of the output.
        output.splice(i++, 0, n);

    }

    return String.fromCodePoint(...output);
}

/// Converts Unicode symbols to a Puncode string
///
/// Converts a string of Unicode symbols (e.g. a domain name label) to a
/// Punycode string of ASCII-only symbols.
function encode(input) {
    const output = [];
    const input2 = ucs2Decode(input);

    let inputlen = input2.length;

    let n = INITIAL_N;
    let delta = 0;
    let bias = INITIAL_BIAS;

    // Handle the basic code points.
    for (let i = 0; i < inputlen; i++) {
        const value = input2[i];
        if (value < 0x80) {
            output.push(String.fromCharCode(value));
        }
    }

    let basicLength = output.length;
    let handledCPCount = basicLength;

    // `handledCPCount` is the number of code points that have been handled;
    // `basicLength` is the number of basic code points.

    // Finish the basic string with a delimiter unless it"s empty.
    if (basicLength) {
        output.push(DELIMITER);
    }

    while (handledCPCount < inputlen) {

        // All non-basic code points < n have been handled already. Find the
        // next larger one:
        let m = MAX_INT;

        for (let i = 0; i < inputlen; i++) {
            const value = input2[i];

            if (value >= n && value < m) {
                m = value;
            }
        }

        // Increase `delta` enough to advance the decoder"s <n,i> state to
        // <m,0>, but guard against overflow.
        const handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > Math.floor((MAX_INT - delta) / handledCPCountPlusOne)) {
            throw overflowError();
        }

        delta += (m - n) * handledCPCountPlusOne;
        n = m;

        for (let i = 0; i < inputlen; i++) {
            const value = input2[i];

            if (value < n && ++delta > MAX_INT) {
                throw overflowError();
            }

            if (value == n) {
                // Represent delta as a generalized variable-length integer.
                let q = delta;
                for (let k = BASE; ;k += BASE) {
                    const t = k <= bias ? T_MIN : (k >= bias + T_MAX ? T_MAX : k - bias);
                    if (q < t) {
                        break;
                    }
                    const qMinusT = q - t;
                    const baseMinusT = BASE - t;
                    output.push(
                        String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
                    );
                    q = Math.floor(qMinusT / baseMinusT);
                }

                output.push(String.fromCharCode(digitToBasic(q, 0)));
                bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                delta = 0;
                ++handledCPCount;
            }
        }

        ++delta;
        ++n;

    }

    return output.join("");
}

/// Converts a Punycode string to a domain name or an email address.
///
/// Converts a Punycode string representing a domain name or an email address
/// to Unicode. Only the Punycoded parts of the input will be converted, i.e.
/// it doesn"t matter if you call it on a string that has already been
/// converted to Unicode.
function toUnicode(input) {
    return mapDomain(input, function(string) {
        return punycodeRe.test(string)
            ? decode(string.slice(4).toLowerCase())
            : string;
    });
}

/// Converts a domain name or an email to Punycode.
///
/// Converts a Unicode string representing a domain name or an email address to
/// Punycode. Only the non-ASCII parts of the domain name will be converted,
/// i.e. it doesn"t matter if you call it with a domain that"s already in
/// ASCII.
function toASCII(input) {
    return mapDomain(input, function(string) {
        return nonASCIIRe.test(string)
            ? "xn--" + encode(string)
            : string;
    });
}

// Internals

function notBasicError() {
    return new RangeError("Illegal input >= 0x80 (not a basic code point)");
}

function overflowError() {
    return new RangeError("Overflow: input needs wider integers to process");
}

function invalidInputError() {
    return new RangeError("Invalid input");
}

function basicToDigit(codePoint) {
    if (codePoint - 0x30 < 0x0A) {
        return codePoint - 0x16;
    }
    if (codePoint - 0x41 < 0x1A) {
        return codePoint - 0x41;
    }
    if (codePoint - 0x61 < 0x1A) {
        return codePoint - 0x61;
    }
    return BASE;
}

function adapt(delta, numPoints, firstTime) {
    let k = 0;
    delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (/* no initialization */; delta > BASE_MINUS_TMIN * T_MAX >> 1; k += BASE) {
        delta = Math.floor(delta / BASE_MINUS_TMIN);
    }
    return Math.floor(k + (BASE_MINUS_TMIN + 1) * delta / (delta + SKEW));
}

function digitToBasic(digit, flag) {
    return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
}

function mapDomain(str, fn) {
    const parts = str.split("@");
    let result = "";

    let str1 = str;

    if (parts.length > 1) {
        // In email addresses, only the domain name should be punycoded. Leave
        // the local part (i.e. everything up to `@`) intact.
        result = parts[0] + "@";
        str1 = parts[1];
    }

    const str2 = str1.replace(separatorsRe, "\x2E");
    const labels = str2.split(".");
    const encoded = List.map(labels, fn).join(".");


    return result + encoded;
}
