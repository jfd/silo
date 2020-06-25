import {Path} from "//es.parts/ess/0.0.1/";

import {Docopt} from "//es.parts/docopt/0.0.1/";

const USAGE = `
Usage:
    silo-exec [options] [<path>]

Options:
    -h, --help               Print this message
`;

export default function(argv) {
    const opts = Docopt.parse(USAGE, argv);
    const loaderPath = Path.resolve(process.cwd(), "./loader.mjs");
    const nodePath = `${process.execPath} ----experimental-loader ${loaderPath}`;

    let targetPath;

    if (opts["<path>"]) {
        targetPath = Path.resolve(process.cwd(), opts["<path>"]);
    } else {
        targetPath = Path.resolve(process.cwd(), "index.mjs");
    }

    console.log(`${nodePath} ${targetPath}`);

    return internalExec(targetPath);
}

// Internals

function internalExec(execPath) {
    throw new Error(`internalExec(${execPath}) - NOT IMPLEMENTED`);
}
