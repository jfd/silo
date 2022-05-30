//! List processing functions.
//!
//!

export {all};
export {append};
export {init};
export {merge};
export {range};
export {clone};
export {head};
export {tail};
export {split};
export {last};
export {each};
export {eachl};
export {filter};
export {find};
export {map};
export {mapl};
export {some};
export {somel};
export {prepend};
export {slice};
export {foldl};
export {foldr};
export {reverse};
export {len};
export {flatten};
export {union};
export {contains};
export {clean};
export {empty};
export {sort};
export {concatMap};

function all(list, fn) {
    const len = list.length;

    for (let i = 0; i < len; i++) {
        if (fn(list[i], i, list) !== true) {
            return false;
        }
    }

    return true;
}

function append(list, elem) {
    const result = new Array(list.length + 1);

    for (let i = 0; i < list.length; i++) {
        result[i] = list[i];
    }

    result[list.length] = elem;

    return result;
}

/// Return all the elements of **list** except the last one.
///
/// # Examples
/// ```
/// import {Assert} from "//es.parts/ess/1.0.0/";
/// import {List} from "//es.parts/ess/1.0.0/";
///
/// Assert.deepEqual(List.init([1, 2, 3, 4]), [1, 2, 3]);
/// ```
function init(list) {
    const len = list.length;

    if (len === 0) {
        return [];
    }

    const list2 = new Array(len - 1);

    for (let i = 0; i < len - 1; i++) {
        list2[i] = list[i];
    }

    return list2;
}

function merge(...args) {
    const lists = filter(args, list => list.length > 0);

    if (lists.length === 0) {
        return lists;
    }

    if (lists.length === 1) {
        return head(lists);
    }

    const result = new Array(foldr(lists, 0, (_, l) => l.length));
    const len = lists.length;

    let idx = 0;

    for (let i = 0; i < len; i++) {
        const list = lists[i];
        const len2 = list.length;

        for (let i2 = 0; i2 < len2; i2++) {
            const value = list[i2];

            if (~result.indexOf(value)) {
                continue;
            }

            result[idx++] = list[i2];
        }
    }

    return result;
}

/// Creates a new List based on a range expression
///
/// Similar to pythons built-in function `range`.
///
/// # Return
/// A new List(Array).
///
/// # Examples
///
/// ```
/// import {List} from "//es.parts/ess/1.0.0/";
///
/// List.range(10);
/// //> [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
///
/// List.range(1, 11);
/// //> [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
///
/// List.range(0, 30, 5);
/// //> [0, 5, 10, 15, 20, 25]
///
/// List.range(0, 10, 3);
/// //> [0, 3, 6, 9]
///
/// List.range(0, -10, -1);
/// //> [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
///
/// List.range(0);
/// // []
///
/// List.range(1, 0);
/// // []
///
/// List.map(List.range(2), no => `No ${no}`);
/// // ["No 0", "No 1"]
/// ```
function range(start, end=null, step=null) {
    let result = [];

    if (typeof start !== "number") {
        throw new RangeError("Expected parameter 'start");
    }

    if (end === null && step === null) {
        for (let i = 0; i < start; i++) {
            result.push(i);
        }
    } else if (step === null) {
        for (let i = start; i < end; i++) {
            result.push(i);
        }
    } else if (end < 0) {
        for (let i = start; i > end; i += step) {
            result.push(i);
        }
    } else {
        for (let i = start; i < end; i += step) {
            result.push(i);
        }
    }

    return result;
}

function clone(list) {
    const len = list.length;
    const result = new Array(len);

    for (let idx = 0; idx < len; idx++) {
        result[idx] = list[idx];
    }

    return result;
}

/// Extract the first element of **list**.
function head(list) {
    return list[0] || null;
}

// Extract the elements after the head of **list**.
function tail(list) {
    const len = list.length;

    if (len === 0) {
        return [];
    }

    const list2 = new Array(len - 1);

    for (let i = 1; i < len; i++) {
        list2[i - 1] = list[i];
    }

    return list2;
}

function split(list) {
    return [head(list), tail(list)];
}

/// Extract the last element of **list**
function last(list) {
    return list[list.length - 1] || null;
}

/// Iterates over each element in list.
///
/// Calls **fn(object, idx, list)** for each `object`.
///
/// # Contracts
/// Throws an exception if **list** is incompatible, or if
/// **fn** is not a `Function`.
///
/// # Examples
/// ```
/// const numbers = [1, 2, 3, 4];
/// List.each(numbers, function(object, idx, list) {
///     Assert.ok(typeof object == "number");
///     Assert.ok(typeof idx == "number");
///     Assert.ok(numbers === list);
/// })
/// ```
function each(list, fn) {
    for (let idx = 0, len = list.length; idx < len; idx++) {
        fn(list[idx], idx, list);
    }
}

function eachl(list, left, fn) {
    for (let idx = 0, len = list.length; idx < len; idx++) {
        fn(left, list[idx], idx, list);
    }
}

function filter(list, fn) {
    const result = [];

    for (let idx = 0, len = list.length; idx < len; idx++) {
        if (fn(list[idx], idx, list) == true) {
            result.push(list[idx]);
        }
    }

    return result;
}

function find(list, fn) {
    for (let idx = 0, len = list.length; idx < len; idx++) {
        const item = list[idx];
        if (fn(item, idx, list) == true) {
            return item;
        }
    }

    return null;
}

function some(list, fn) {
    for (let idx = 0, len = list.length; idx < len; idx++) {
        if (fn(list[idx], idx, list) == true) {
            return true;
        }
    }

    return false;
}

function somel(list, left, fn) {
    for (let idx = 0, len = list.length; idx < len; idx++) {
        if (fn(left, list[idx], idx, list) == true) {
            return true;
        }
    }

    return false;
}

function map(list, fn) {
    const result = [];

    for (let idx = 0, len = list.length; idx < len; idx++) {
        result.push(fn(list[idx], idx, list));
    }

    return result;
}

function mapl(list, left, fn) {
    const result = [];

    for (let idx = 0, len = list.length; idx < len; idx++) {
        result.push(fn(left, list[idx], idx, list));
    }

    return result;
}

function prepend(list, elem) {
    const result = new Array(list.length + 1);

    result[0] = elem;

    for (let i = 0; i < list.length; i++) {
        result[i + 1] = list[i];
    }

    return result;
}

///
///
/// # Credits
/// Based on lodash
function slice(list, start, end) {
    let len = list == null ? 0 : list.length

    if (!len) {
        return [];
    }

    let start2 = start == null ? 0 : start
    let end2 = end === undefined ? len : end

    if (start2 < 0) {
        start2 = -start2 > len ? 0 : (len + start2);
    }

    end2 = end2 > len ? len : end2;

    if (end2 < 0) {
        end2 += len;
    }

    len = start2 > end2 ? 0 : ((end2 - start2) >>> 0);
    start >>>= 0;

    const list2 = new Array(len);

    let idx = -1;

    while (++idx < len) {
        list2[idx] = list[idx + start2];
    }

    return list2;
}

function foldl(list, initial, fn) {
    const t = Object(list);
    const len = list.length >>> 0;

    let k = 0;
    let value = initial;

    for (;k < len; k++) {
        if (k in t) {
            value = fn(value, t[k], k);
        }
    }

    return value;
}

function foldr(list, initial, fn) {
    const t = Object(list);

    let k = list.length >>> 0;
    let value = initial;

    while (k--) {
        if (k in t) {
            value = fn(value, t[k], k);
        }
    }

    return value;
}

function reverse(list) {
    let len = list.length;
    let idx = 0;

    const list2 = new Array(len);

    while (len--) {
        list2[idx++] = list[len];
    }

    return list2;


}

function len(list) {
    return list.length;
}

function flatten(lists) {
    return foldl(lists, [], (acc, list) => merge(acc, list));
}

function union(list) {
    const len = list.length;
    const result = [];

    for(let idx = 0; idx < len; idx++) {
        for(let idx2 = idx + 1; idx2 < len; idx2++) {
            if (list[idx] === list[idx2]) {
                idx2 = ++idx;
            }
        }
        result.push(list[idx]);
    }

    return result;
}

function contains(list, elem) {
    const len = list.length;

    for (let idx = 0; idx < len; idx++) {
        const comp = list[idx];
        if (comp === elem) {
            return true;
        }
    }

    return false;
}

function clean(list) {
    const result = [];
    const len = list.length;

    for (let idx = 0; idx < len; idx++) {
        const item = list[idx];
        if (item !== void(0)) {
            result.push(item);
        }
    }

    return result;
}

/// Indicates if list is empty or not
function empty(list) {
    return list.length === 0;
}

function sort(list, fn) {
    const len = list.length;
    const list2 = clone(list);

    for (let idx = 1; idx < len; idx++) {
        const elem1 = list2[idx];

        let j = idx;
        let elem2;

        while ((elem2 = list2[j - 1]) && fn(elem1, elem2)) {
            list2[j] = list2[j - 1];
            --j;
        }

        list2[j] = elem1;
    }

    return list2;
}

function concatMap(list, fn) {
    const list2 = [];

    for (let i = 0; i < list.length; i++) {
        const x = fn(list[i], i);

        if (Array.isArray(x)) {
            list2.push.apply(list2, x);
        } else {
            list2.push(x);
        }
    }

    return list2;
}
