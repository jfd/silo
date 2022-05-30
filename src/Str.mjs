//! String manipluation functions
//!
//! # Credits
//! Heavly based on [strings.js](http://stringjs.com) by JP Richardson

cflags: "MODE_REVAMP";

import * as List from "./List.mjs";

export {begins};
export {camelize};
export {capitalize};
export {center};
export {chompl};
export {chompr};
export {dasherize};
export {humanize};
export {underscore};
export {empty};
export {ends};
export {includes};
export {join};
export {left};
export {lower};
export {repeat};
export {replace};
export {right};
export {strip};
export {stripl};
export {stripr};
export {subl};
export {subr};
export {trim};
export {triml};
export {trimr};
export {truncate};
export {upper};
export {len};
export {bytelen};
export {matchp};

/// Indicates if `str` starts with `match`.
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/@latest";
/// import {Str} from "//es.parts/ess/@latest";
///
/// Assert.equal(Str.begins("str", "str"), true);
/// Assert.equal(Str.begins("hello world", "hello"), true);
/// Assert.equal(Str.begins("hello world", "world"), false);
/// ```
function begins(str, match) {
    return string(str).indexOf(string(match)) === 0;
}

/// Remove any underscores or dashes and convert a string into camel-casing.
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/@latest";
/// import {Str} from "//es.parts/ess/@latest";
///
/// Assert.equal(Str.camelize("data_rate"), "dataRate");
/// Assert.equal(Str.camelize("background-color"), "backgroundColor");
/// Assert.equal(Str.camelize("-moz-something"), "MozSomething");
/// Assert.equal(Str.camelize("_car_speed"), "CarSpeed");
/// ```
function camelize(str) {
    return trim(str).replace(/(\-|_|\s)+(.)?/g,
        (_m, _s, c) => c ? c.toUpperCase() : "");
}

/// Returns a string, where the first char of `str` is capitalizes.
function capitalize(str) {
    const s = string(str);
    return s.substr(0, 1).toUpperCase() + s.substring(1).toLowerCase();
}

/// Returns a string, where `str` is surrounded with `chars`.
function center(str, len=1, c="\s") {
    const s = string(str);
    const h = ~~(len / 2);
    return s.length < len ? repeat(c, h) + s + repeat(c, h) : s;
}

/// Removes prefix from start of string.
function chompl(str, prefix) {
    const s = string(str);
    const idx = s.indexOf(prefix);
    return idx === 0 ? s.substr(prefix.length) : s;
}

/// Removes prefix from end of string.
function chompr(str, suffix) {
    const s = string(str);
    const idx = s.lastIndexOf(suffix);
    const len = s.length - suffix.length;
    return idx === len ? s.substr(s.length + len) : s;
}


/// Converts a camel-cased string into a string delimited by dashes.
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/@latest";
/// import {Str} from "//es.parts/ess/@latest";
///
/// Assert.equal(Str.dasherize("CarSpeed"), "-car-speed");
/// Assert.equal(Str.dasherize("yesWeCan"), "yes-we-can");
/// Assert.equal(Str.dasherize("backgroundColor"), "background-color");
/// ```
function dasherize(str) {
    return trim(str)
        .replace(/[_\s]+/g, '-')
        .replace(/([A-Z])/g, '-$1')
        .replace(/-+/g, '-')
        .toLowerCase();
}

/// Transforms the input into a human friendly form.
///
/// # Examples
function humanize(str) {
    const str2 = underscore(str).replace(/_id$/, "").replace(/_/g, " ");
    return capitalize(trim(str2));
}

/// Returns converted camel cased string into a string delimited by underscores.
///
/// # Examples
/// import {Assert} from "//es.parts/ess/@latest";
/// import {Str} from "//es.parts/ess/@latest";
///
/// Assert.equal(Str.underscore("dataRate", "data_rate"));
/// Assert.equal(Str.underscore("CarSpeed", "car_speed"));
/// Assert.equal(Str.underscore("yesWeCan", "yes_we_can"));
function underscore(str) {
    return trim(str)
        .replace(/([a-z\d])([A-Z]+)/g, "$1_$2")
        .replace(/([A-Z\d]+)([A-Z][a-z])/g,"$1_$2")
        .replace(/[-\s]+/g, "_")
        .toLowerCase();
}


/// Indicates if string is empty or not.
function empty(str) {
    return !str;
}

/// Indicates if `match` is the ends of `str`.
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/@latest";
/// import {Str} from "//es.parts/ess/@latest";
///
/// Assert.equal(Str.ends("str", "str"), true);
/// Assert.equal(Str.ends("hello world", "hello"), false);
/// Assert.equal(Str.ends("hello world", "world"), true);
/// ```
function ends(str, match) {
    const s = string(str);
    const m = string(match);
    return s.lastIndexOf(m) === s.length - m.length;
}

/// Indicates if `match` is included in `str`.
function includes(str, match) {
    return !!~string(str).indexOf(string(match));
}

/// Returns a string based on all strings of `list`.
function join(list, sep="") {
    const last = List.len(list) - 1;
    return List.foldl(list, "", (a, s, i) => `${a}${s}${i === last ? "" : sep}`);
}

function left(str, len, c="\s") {
    const s = string(str);
    return s.length >= len ? len : s + repeat(c, len - s.length);
}

/// Converts all chars to lower-case.
function lower(str) {
    return string(str).toLowerCase();
}

/// Repeats `str` `n`-times.
function repeat(str, n=0) {
    let s = "";

    for (let i = 0; i < n; i++) {
        s += str;
    }

    return s;
}

function replace(str, match, replacement="") {
    return string(str).split(string(match)).join(replacement);
}

function right(str, len, c="\s") {
    const s = string(str);
    return s.length >= len ? len : repeat(c, len - s.length) + s;
}

function strip(str, c="\s") {
    return stripr(stripl(str, c), c);
}

function stripl(str, c="\s") {
    let pattern;

    if (c === "\s") {
        pattern = /^\s+/g;
    } else {
        pattern = new RegExp("^[" + escapere(c) + "]+", "g");
    }

    return string(str).replace(pattern, "");
}

function stripr(str, c="\s") {
    let pattern;

    if (c === "\s") {
        pattern = /\s+$/g;
    } else {
        pattern = new RegExp("[" + escapere(c) + "]+$", "g")
    }

    return string(str).replace(pattern, "");
}

function subl(str, idx=0) {
    return string(str).slice(idx);
}

function subr(str, idx=0) {
    return string(str).slice(-idx);
}

/// Removes both leading and trailing whitespace.
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/@latest";
/// import {Str} from "//es.parts/ess/@latest";
///
/// Assert.equal(Str.trim("hello "), "hello");
/// Assert.equal(Str.trim(" hello "), "hello");
/// Assert.equal(Str.trim("\nhello"), "hello");
/// Assert.equal(Str.trim("\nhello\r\n"), "hello");
/// Assert.equal(Str.trim("\thello\t"), "hello");
/// ```
function trim(str) {
    return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
}

/// Removes all leading whitespace.
function triml(str) {
    return str.replace(/^[\s\uFEFF\xA0]+|/g, "");
}

/// Removes all trailing whitespace.
function trimr(str) {
    return str.replace(/[\s\uFEFF\xA0]+$/g, "");
}

function truncate(str, len) {
    return str.length < len ? str : str.slice(0, len);
}

/// Converts all chars to upper-case.
function upper(str) {
    return string(str).toUpperCase();
}

function len(str) {
    return string(str).length || 0;
}

/// Returns the actual number of bytes in an UTf8 string.
function bytelen(str) {
    const str2 = String(str);

    let len = 0;

    for (let i = 0; i < str2.length; i++) {
        const c = str2.charCodeAt(i);
        len += c < (1 <<  7) ? 1 :
               c < (1 << 11) ? 2 :
               c < (1 << 16) ? 3 :
               c < (1 << 21) ? 4 :
               c < (1 << 26) ? 5 :
               c < (1 << 31) ? 6 : Number.NaN;
    }
    return len;
}

/// Match balanced string pairs, like `{` and `}` or `<b>` and `</b>`.
///
/// # Result
/// ```
/// {
///     start: 0,       // Start position of match
///     end: 12,        // End position of match
///     pre: "",        // The predicate before match
///     body: "",       // Body of the containing result
///     post: "",       // The post match
/// }
/// ```
///
/// # Credits
/// Based on https://github.com/juliangruber/balanced-match
///
function matchp(str, start, end) {
    const a = start instanceof RegExp ? matchpMaybeMatch(start, str) : start;
    const b = end instanceof RegExp ? matchpMaybeMatch(end, str) : end;

    const r = matchpRange(str, a, b);

    if (!r) {
        return null;
    }

    return {
        start: r[0],
        end: r[1],
        pre: str.slice(0, r[0]),
        body: str.slice(r[0] + a.length, r[1]),
        post: str.slice(r[1] + b.length)
    };

}

// Internals

function string(input) {
    return (typeof input === "string" ? input : String(input));
}

function escapere(re) {
    const result = [];

    for (let i = 0; i < re.length; ++i) {
        const ch = re.charAt(i);

        if ((ch >= "a" && ch <= "z") ||
            (ch >= "A" && ch <= "Z") ||
            (ch >= "0" && ch <= "9")) {
            result.push(ch);
        } else if (ch === "\\000") {
            result.push("\\000");
        } else {
            result.push("\\" + ch);
        }
    }

    return result.join("");
}

function matchpMaybeMatch(reg, str) {
    const m = str.match(reg);
    return m ? m[0] : null;
}

function matchpRange(str, start, end) {
    let begs, beg, left, right, result;
    let ai = str.indexOf(start);
    let bi = str.indexOf(end, ai + 1);
    let i = ai;

    if (ai >= 0 && bi > 0) {
        begs = [];
        left = str.length;

        while (i >= 0 && !result) {
            if (i == ai) {
                begs.push(i);
                ai = str.indexOf(start, i + 1);
            } else if (begs.length == 1) {
                result = [ begs.pop(), bi ];
            } else {
                beg = begs.pop();
                if (beg < left) {
                    left = beg;
                    right = bi;
                }

                bi = str.indexOf(end, i + 1);
            }

            i = ai < bi && ai >= 0 ? ai : bi;
        }

        if (begs.length) {
            result = [ left, right ];
        }
    }

    return result;
}
