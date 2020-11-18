import ChildProcess from "child_process";

import {Path} from "//es.parts/ess/0.0.1/";
import {Str} from "//es.parts/ess/0.0.1/";
import {Url} from "//es.parts/ess/0.0.1/";

import {Docopt} from "//es.parts/docopt/0.0.1/";

const USAGE = `
Usage:
    silo-build [options] [<path>]

Options:
    -h, --help               Print this message
`;

export default function(argv) {
    const opts = Docopt.parse(USAGE, argv);

    let inputPath;

    if (opts["<path>"]) {
        inputPath = Path.resolve(process.cwd(), opts["<path>"]);
    } else {
        inputPath = Path.resolve(process.cwd(), "index.mjs");
    }

    return internalExec(inputPath, "dist/bundle.js", "iife");
}

// Internals

async function internalExec(inputPath, outputPath, format) {
    const url = Url.parse(import.meta.url);
    const rootdir = Path.dirname(Path.dirname(url.pathname));
    const rollupPath = Path.resolve(rootdir, "./node_modules/rollup/dist/bin/rollup");
    const loaderPath = Path.resolve(rootdir, "./src/RollupModuleLoader.js");

    const args = [
        rollupPath,
        inputPath,
        `--file ${outputPath}`,
        `--format ${format}`,
        `--plugin ${loaderPath}`
    ];

    try {
        const result = await promiseExec(Str.join(args, " "));
        console.log(result);
    } catch (error) {
        console.error(error);
    }

    console.log("all done!");
    // const nodePath = `${process.execPath} ----experimental-loader ${loaderPath}`;

    // rollup packages/pdbackend/index.mjs --file dist/bundle.js --format iife --plugin ./rollup-plugin-silo.js

    // throw new Error(`internalExec(${execPath}) - NOT IMPLEMENTED`);
}

function promiseExec(cmd) {
    return new Promise((resolve, reject) => {
        ChildProcess.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            resolve(stdout);
            // console.log(`stdout: ${stdout}`);
            // console.error(`stderr: ${stderr}`);
        });
    });
}
