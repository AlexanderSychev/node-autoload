import * as glob from 'glob';
import {join as pathJoin, extname} from 'path';
import * as _ from 'lodash';
import {IContext, IModule} from './abstractions';

/** Cached "require" */
const __require: NodeRequire = require;

/** Loader */
export class Loader {

    /** Array of directories to search autoloads */
    private dirs_: string[];

    /** Init loader by directories */
    public constructor(dirs?: string[]) {
        this.dirs_ = dirs ? _.uniq(_.compact(dirs)) : [];
    }

    /** Add directory to search modules */
    public addDir(dir: string): void {
        this.dirs_.push(dir);
    }

    /** Find and load all modules into Application */
    public loadModules(): IModule[] {
        return this.modulePathsToModules_(
            this.filePathsToModulesPaths_(
                this.globsToFilePaths_(
                    this.dirsToGlobs_(this.dirs_)
                )
            )
        );
    }

    /** Map dirs array to Glob patterns array */
    private dirsToGlobs_(dirs: string[]): string[] {
        return _.map(
            dirs,
            (dir: string) => pathJoin(dir, '**', '*.auto.@(js|json|node)')
        );
    }

    /** Converts flat Glon patterns to modules paths*/
    private globsToFilePaths_(globs: string[]): string[] {
        return _.flatten(
            _.map(globs, (pattern) => glob.sync(pattern))
        );
    }

    /** Maps raw modules files paths into correct paths for "require" */
    private filePathsToModulesPaths_(filePaths: string[]) : string[] {
        return _.map(
            filePaths,
            (filePath) => (
                (extname(filePath) === '.js') ?
                filePath.substring(0, filePath.length - 3) :
                filePath.substring(0, filePath.length - 5)
            )
        );
    }

    /** Maps modules paths to modules */
    private modulePathsToModules_(modulePaths: string[]): IModule[] {
        return _.map(
            modulePaths,
            (modulePath) => <IModule>__require(modulePath)
        );
    }
};

/** Concrete context implementation */
export class Context implements IContext {
    /** Not initalized containers array */
    private notInitalized_: Map<string, IModule>;

    /** All initalized modules */
    private cache_: Map<string, any>;

    /** Other Autoloader Contexts, attached to this */
    private otherContexts_: Map<string, IContext>;

    /** Context requies instance of loader */
    public constructor(loader: Loader) {
        this.notInitalized_ = new Map<string, IModule>();
        this.cache_ = new Map<string, any>();
        this.otherContexts_ = new Map<string, IContext>();

        loader.loadModules().forEach(this.baseModuleInit_, this);
    }

    /** Put other context to this */
    public putContext(id: string, context: IContext) {
        this.otherContexts_.set(id, context);
    }

    /** Get other context, puted in this context */
    public getContext(id: string): IContext {
        if (!this.otherContexts_.has(id)) {
            throw new Error(`Context has no parent context with id="${id}"`);
        }
        return this.otherContexts_.get(id);
    }

    /** Get exported module object by module id */
    public getModule(id: string): any {
        let result: any = null;
        if (this.cache_.has(id)) {
            result = this.cache_.get(id);
        } else if (this.notInitalized_.has(id)) {
            result = this.notInitalized_.get(id).bootstrap(this);
            this.cache_.set(id, result);
            this.notInitalized_.delete(id);
        } else {
            throw new Error(
                `Module with id="${id} not registered by Autoloader"`
            );
        }
        return result;
    }

    /** Base init of all modules */
    private baseModuleInit_(module: IModule): void {
        if (_.isNil(module.bootstrap)) {
            this.cache_.set(module.id, module);
        } else {
            this.notInitalized_.set(module.id, module);
        }
    }
}
