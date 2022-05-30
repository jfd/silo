//! # QueryString
//!
import * as Dict from "./Dict.mjs";
import * as List from "./List.mjs";
import * as Str from "./Str.mjs";

const hexTable = [
    "%00","%01","%02","%03","%04","%05","%06","%07",
    "%08","%09","%0A","%0B","%0C","%0D","%0E","%0F",
    "%10","%11","%12","%13","%14","%15","%16","%17",
    "%18","%19","%1A","%1B","%1C","%1D","%1E","%1F",
    "%20","%21","%22","%23","%24","%25","%26","%27",
    "%28","%29","%2A","%2B","%2C","%2D","%2E","%2F",
    "%30","%31","%32","%33","%34","%35","%36","%37",
    "%38","%39","%3A","%3B","%3C","%3D","%3E","%3F",
    "%40","%41","%42","%43","%44","%45","%46","%47",
    "%48","%49","%4A","%4B","%4C","%4D","%4E","%4F",
    "%50","%51","%52","%53","%54","%55","%56","%57",
    "%58","%59","%5A","%5B","%5C","%5D","%5E","%5F",
    "%60","%61","%62","%63","%64","%65","%66","%67",
    "%68","%69","%6A","%6B","%6C","%6D","%6E","%6F",
    "%70","%71","%72","%73","%74","%75","%76","%77",
    "%78","%79","%7A","%7B","%7C","%7D","%7E","%7F",
    "%80","%81","%82","%83","%84","%85","%86","%87",
    "%88","%89","%8A","%8B","%8C","%8D","%8E","%8F",
    "%90","%91","%92","%93","%94","%95","%96","%97",
    "%98","%99","%9A","%9B","%9C","%9D","%9E","%9F",
    "%A0","%A1","%A2","%A3","%A4","%A5","%A6","%A7",
    "%A8","%A9","%AA","%AB","%AC","%AD","%AE","%AF",
    "%B0","%B1","%B2","%B3","%B4","%B5","%B6","%B7",
    "%B8","%B9","%BA","%BB","%BC","%BD","%BE","%BF",
    "%C0","%C1","%C2","%C3","%C4","%C5","%C6","%C7",
    "%C8","%C9","%CA","%CB","%CC","%CD","%CE","%CF",
    "%D0","%D1","%D2","%D3","%D4","%D5","%D6","%D7",
    "%D8","%D9","%DA","%DB","%DC","%DD","%DE","%DF",
    "%E0","%E1","%E2","%E3","%E4","%E5","%E6","%E7",
    "%E8","%E9","%EA","%EB","%EC","%ED","%EE","%EF",
    "%F0","%F1","%F2","%F3","%F4","%F5","%F6","%F7",
    "%F8","%F9","%FA","%FB","%FC","%FD","%FE","%FF",
];

export {encode};
export {decode};

const ARRAY_LIMIT = 20;
const MAX_DEPTH = 5;

function encode(obj, opts) {
    const delimiter = opts && opts.delimiter || "&";

    if (!obj) {
        return "";
    }

    const obj2 = Dict.filter(obj, (_, v) => v!== void(0));
    const obj3 = Dict.map(obj2, (k, v) => encodepair(k, v));

    if (List.empty(obj3)) {
        return "";
    }

    return Str.join(obj3, delimiter);
}

function decode(str, options) {
    const delimiter = options && options.delimiter || "&";

    if (!str || str.length === 0) {
        return Dict.create();
    }

    const obj = Dict.create();

    Dict.each(decodeValues(str, delimiter), (k, v) => {
        const obj2 = decodeKeys(k, v);;
        mergeObjects(obj, obj2);
    });

    return obj;
}

// Internals

function encodepair(k, v) {
    if (v === void(0)) {
        return "";
    }

    if (typeof v === "string" || typeof v === "number" ||
        typeof v === "boolean") {
        return `${encodestr(k)}=${encodestr(v)}`;
    }

    // TODO encode array and complexe objects
    return "";
}

function encodestr(str) {
    // This code was originally written by Brian White (mscdex) for the io.js
    // core querystring library.
    // It has been adapted here for stricter adherence to RFC 3986
    if (str.length === 0) {
        return str;
    }

    const string = typeof str === "string" ? str : String(str);

    let out = "";

    for (let i = 0; i < string.length; ++i) {
        let c = string.charCodeAt(i);

        if (c === 0x2D || // -
            c === 0x2E || // .
            c === 0x5F || // _
            c === 0x7E || // ~
            (c >= 0x30 && c <= 0x39) || // 0-9
            (c >= 0x41 && c <= 0x5A) || // a-z
            (c >= 0x61 && c <= 0x7A) // A-Z
        ) {
            out += string.charAt(i);
            continue;
        }

        if (c < 0x80) {
            out = out + hexTable[c];
            continue;
        }

        if (c < 0x800) {
            out = out + (hexTable[0xC0 | (c >> 6)] +
                         hexTable[0x80 | (c & 0x3F)]);
            continue;
        }

        if (c < 0xD800 || c >= 0xE000) {
            out = out + (hexTable[0xE0 | (c >> 12)] +
                         hexTable[0x80 | ((c >> 6) & 0x3F)] +
                        hexTable[0x80 | (c & 0x3F)]);
            continue;
        }

        i += 1;
        c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF));
        out += hexTable[0xF0 | (c >> 18)] +
               hexTable[0x80 | ((c >> 12) & 0x3F)] +
               hexTable[0x80 | ((c >> 6) & 0x3F)] +
               hexTable[0x80 | (c & 0x3F)];
    }

    return out;
}

function decodestr(str) {
    return decodeURIComponent(str.replace(/\+/g, " "));
}

function decodeValues(str, delimiter) {
    const obj = Dict.create();

    List.each(str.split(delimiter), (part) => {
        const arrayIdx = part.indexOf("]=");
        const pos = arrayIdx === -1 ? part.indexOf("=") : arrayIdx + 1;

        let key, value;

        if (pos === -1) {
            key = decodestr(part);
            value = null;
        } else {
            key = decodestr(part.slice(0, pos));
            value = decodestr(part.slice(pos + 1));
        }

        if (key in obj) {
            if (Array.isArray(obj[key])) {
                obj[key] = List.append(obj[key], value);
            } else {
                obj[key] = [obj[key], value];
            }
        } else {
            obj[key] = value;
        }
    });

    return obj;
}

function decodeKeys(key, value) {
    if (!key) {
        return null;
    }

    // Transform dot notation to bracket notation
    // var key = options.allowDots ? givenKey.replace(/\.([^\.\[]+)/g, '[$1]') : givenKey;

    const parentRe = /^([^\[\]]*)/;
    const childRe = /(\[[^\[\]]*\])/g;

    const keys = [];

    const parentSegment = parentRe.exec(key);

    if (parentSegment[1]) {
        keys.push(parentSegment[1]);
    }

    let i = 0;
    let seg;

    while ((seg = childRe.exec(key)) && i++ < MAX_DEPTH) keys.push(seg[1]);

    // If there's a remainder, just add whatever is left

    if (seg) {
        keys.push('[' + key.slice(seg.index) + ']');
    }

    return decodeObject(keys, value);
}


function decodeObject(keys, value) {
    if (!keys.length) {
        return value;
    }

    const root = keys.shift();

    let obj;

    if (root === '[]') {
        obj = List.merge([], decodeObject(keys, value));
    } else {

        const cleanRoot = root[0] === '[' && root[root.length - 1] === ']' ?
                root.slice(1, root.length - 1) : root;

        let index = parseInt(cleanRoot, 10);

        if (!isNaN(index) &&
            root !== cleanRoot &&
            String(index) === cleanRoot &&
            index >= 0 &&
            index <= ARRAY_LIMIT) {
            obj = [];
            obj[index] = decodeObject(keys, value);
        } else {
            obj = Dict.create();
            obj[cleanRoot] = decodeObject(keys, value);
        }
    }

    return obj;
}

function mergeObjects(target, source) {
    if (!source) {
        return target;
    }

    if (typeof source !== "object") {
        if (Array.isArray(target)) {
            target.push(source);
        } else if (typeof target === "object") {
            target[source] = true;
        } else {
            return [target, source];
        }

        return target;
    }

    if (typeof target !== "object") {
        return [target, source];
    }

    const mergeTarget = Array.isArray(target) && !Array.isArray(source) ?
                            listToDict(target) : target;

    if (Array.isArray(target) && Array.isArray(source)) {
        List.each(source, (elem, idx) => {
            if (idx in target) {
                if (target[idx] && typeof target[idx] === "object") {
                    target[idx] = mergeObjects(target[idx], elem);
                } else {
                    target.push(elem);
                }
            } else {
                target[idx] = elem;
            }
        });
        return target;
    }

    return List.foldl(Object.keys(source), mergeTarget, (acc, key) => {
        const value = source[key];

        if (key in acc) {
            acc[key] = mergeObjects(acc[key], value);
        } else {
            acc[key] = value;
        }

        return acc;
    });
}

function listToDict(source) {
    var obj = Dict.create();

    for (let idx = 0; idx < source.length; idx++) {
        if (typeof source[idx] !== "undefined") {
            obj[idx] = source[idx];
        }
    }

    return obj;
};
