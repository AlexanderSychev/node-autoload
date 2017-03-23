"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const concretes_1 = require("./concretes");
/** Run Autoloader for settled directories and return created Context */
function run(dirs) {
    let loader = new concretes_1.Loader(dirs);
    let context = new concretes_1.Context(loader);
    return context;
}
exports.run = run;
