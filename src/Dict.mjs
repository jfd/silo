//! Key-value dictionary.
//!
//!

import * as List from "./List.mjs";

export {append};
export {clone};
export {create};
export {fromlist};
export {each};
export {filter};
export {map};
export {somel};
export {somer};
export {some};
export {keys};
export {values};
export {len};
export {merge};
export {pick};
export {pickby};
export {omit};
export {omitby};
export {haskey};

function append(obj, key, value) {
    const obj2 = clone(obj);
    obj2[key] = value;
    return obj2;
}

function clone(obj) {
    const obj2 = create();
    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        obj2[key] = obj[key];
    }

    return obj2;
}

function create() {
    // Make me fast
    // function EmptyDict() {}
    // EmptyDict.prototype = Object.create(null);
    // return new EmptyDict;
    return Object.create(null);
}

/// Creates a new Dict from a list.
///
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/1.0.0/";
/// import {Dict} from "//es.parts/ess/1.0.0/";
/// const list = ["a", "b", "c"];
/// const dict = Dict.fromlist(list, (item, idx) => ({[item]:idx}));
/// Assert.deepEqual(dict, {"a": 0, "b": 1, "c": 2});
/// ```
function fromlist(list, fn) {
    if (!list || !list.length) {
        return {};
    }

    let dict = create();

    List.each(list, (item, idx, obj) => {
        const result =  fn(item, idx, obj);
        dict = merge(dict, result);
    });

    return dict;
}



function each(obj, fn) {
    const keys = Object.keys(obj);
    const len = keys.length;

    for (let idx = 0; idx < len; idx++) {
        const key = keys[idx];
        const value = obj[key];
        fn(key, value, idx, obj);
    }
}

function filter(obj, fn) {
    const obj2 = Object.create(null);

    for (let key in obj) {
        const value = obj[key];
        if (fn(key, value, obj)) {
            obj2[key] = value;
        }
    }

    return obj2;
}

function map(obj, fn) {
    const list = [];

    for (let key in obj) {
        const value = obj[key];
        list.push(fn(key, value, obj));
    }

    return list;
}

function some(obj, fn) {
    for (let key in obj) {
        if (fn(key, obj[key], obj)) {
            return true;
        }
    }

    return false;
}

function somel(obj, left, fn) {
    for (let key in obj) {
        if (fn(left, key, obj[key], obj)) {
            return true;
        }
    }

    return false;
}

function somer(obj, right, fn) {
    for (let key in obj) {
        if (fn(key, obj[key], right, obj)) {
            return true;
        }
    }

    return false;
}

function keys(obj) {
    const list = [];

    for (let k in obj) {
        list.push(k);
    }

    return list;
}

function values(obj) {
    const list = [];

    for (let key in obj) {
        list.push(obj[key]);
    }

    return list;
}

/// Calculate number of key-value pairs for `obj`.
function len(obj) {
    let count = 0;

    for (let key in obj) {
        key;
        count++
    }

    return count;
}

function merge(obj1, obj2) {
    const result = create();

    for (let key in obj1) {
        result[key] = obj1[key];
    }

    for (let key in obj2) {
        result[key] = obj2[key];
    }

    return result;
}

function pick(obj, paths) {
    const obj2 = create();

    for (let i = 0; i < paths.length; i++) {
        const key = paths[i];

        if (key in obj) {
            obj2[key] = obj[key];
        }
    }

    return obj2;
}

function pickby(obj, predicate) {
    const obj2 = create();

    for (let key in obj) {
        const value = obj[key];

        if (predicate(key, value)) {
            obj2[key] = value;
        }
    }

    return obj2;
}

function omit(obj, paths) {
    return omitby(obj, (k, _) => List.find(paths, o => k === o));
}

function omitby(obj, predicate) {
    return pickby(obj, (k, v) => !predicate(k, v));
}

function haskey(obj, key) {
    return obj ? key in obj : false;
}
