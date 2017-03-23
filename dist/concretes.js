"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const path_1 = require("path");
const _ = require("lodash");
/** Cached "require" */
const __require = require;
/** Loader */
class Loader {
    /** Init loader by directories */
    constructor(dirs) {
        this.dirs_ = dirs ? _.uniq(_.compact(dirs)) : [];
    }
    /** Add directory to search modules */
    addDir(dir) {
        this.dirs_.push(dir);
    }
    /** Find and load all modules into Application */
    loadModules() {
        return this.modulePathsToModules_(this.filePathsToModulesPaths_(this.globsToFilePaths_(this.dirsToGlobs_(this.dirs_))));
    }
    /** Map dirs array to Glob patterns array */
    dirsToGlobs_(dirs) {
        return _.map(dirs, (dir) => path_1.join(dir, '**', '*.auto.@(js|json|node)'));
    }
    /** Converts flat Glon patterns to modules paths*/
    globsToFilePaths_(globs) {
        return _.flatten(_.map(globs, (pattern) => glob.sync(pattern)));
    }
    /** Maps raw modules files paths into correct paths for "require" */
    filePathsToModulesPaths_(filePaths) {
        return _.map(filePaths, (filePath) => ((path_1.extname(filePath) === '.js') ?
            filePath.substring(0, filePath.length - 3) :
            filePath.substring(0, filePath.length - 5)));
    }
    /** Maps modules paths to modules */
    modulePathsToModules_(modulePaths) {
        return _.map(modulePaths, (modulePath) => __require(modulePath));
    }
}
exports.Loader = Loader;
;
/** Concrete context implementation */
class Context {
    /** Context requies instance of loader */
    constructor(loader) {
        this.notInitalized_ = new Map();
        this.cache_ = new Map();
        this.otherContexts_ = new Map();
        loader.loadModules().forEach(this.baseModuleInit_, this);
    }
    /** Put other context to this */
    putContext(id, context) {
        this.otherContexts_.set(id, context);
    }
    /** Get other context, puted in this context */
    getContext(id) {
        if (!this.otherContexts_.has(id)) {
            throw new Error(`Context has no parent context with id="${id}"`);
        }
        return this.otherContexts_.get(id);
    }
    /** Get exported module object by module id */
    getModule(id) {
        let result = null;
        if (this.cache_.has(id)) {
            result = this.cache_.get(id);
        }
        else if (this.notInitalized_.has(id)) {
            result = this.notInitalized_.get(id).bootstrap(this);
            this.cache_.set(id, result);
            this.notInitalized_.delete(id);
        }
        else {
            throw new Error(`Module with id="${id} not registered by Autoloader"`);
        }
        return result;
    }
    /** Base init of all modules */
    baseModuleInit_(module) {
        if (_.isNil(module.bootstrap)) {
            this.cache_.set(module.id, module);
        }
        else {
            this.notInitalized_.set(module.id, module);
        }
    }
}
exports.Context = Context;
