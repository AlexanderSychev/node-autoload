/*
 * Copyright 2017 Alexander Sychev
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *     1. Redistributions of source code must retain the above copyright notice,
 *        this list of conditions and the following disclaimer.
 *     2. Redistributions in binary form must reproduce the above copyright
 *        notice, this list of conditions and the following disclaimer in the
 *        documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 * OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import * as glob from 'glob';
import {join as pathJoin, extname, isAbsolute as isPathAbsolute} from 'path';
import * as _ from 'lodash';
import {IContext, IModule} from './abstractions';

/** Cached "require" */
const __require: NodeRequire = require;

/**
 * Common concrete implementation of module to autoload
 */
export abstract class Module<EXPORTS> implements IModule {
    /** Module id */
    public id: string;
    /** Is module need lazy bootstraping */
    public lazy: boolean;
    /** Internal boostrap function (defines by user) */
    private bootstrapInternal_: (context?: IContext) => EXPORTS;

    public constructor(
        id: string,
        bootstrapInternal: (context?: IContext) => EXPORTS,
        opt_lazy?: boolean
    ) {
        this.id = id;
        this.lazy = opt_lazy || false;
        this.bootstrapInternal_ = bootstrapInternal;
    }

    /** Outer bootstrap wrapper method */
    public bootstrap(context?: IContext): EXPORTS {
        return this.bootstrapInternal_(context);
    }
}

/** Loader */
export class Loader {

    /** Array of directories to search autoloads */
    private dirs_: string[];

    /** Init loader by directories */
    public constructor(dirs?: string[]) {
        _.forEach(dirs, this.lintDir_);
        this.dirs_ = dirs ? _.uniq(_.compact(dirs)) : [];
    }

    /** Add directory to search modules */
    public addDir(dir: string): void {
        this.lintDir_(dir);
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

    /** Lind directory path (check that path is absolute) */
    private lintDir_(dir: string): void {
        if (!isPathAbsolute(dir)) {
            throw new Error(
                `"${dir}" <== Root autoload directory path must be absolute!`
            );
        }
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
        this.bootstrapIfNotLazy_();
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
                `Module with id="${id}" not registered by Autoloader`
            );
        }
        return result;
    }

    /** Base init of all modules */
    private baseModuleInit_(module: IModule): void {
        if (_.isNil(module.id)) {
            throw new Error(
                'Autoloadable module must export "id" field at least!'
            );
        }

        if (_.isNil(module.bootstrap)) {
            this.cache_.set(module.id, module);
        } else {
            this.notInitalized_.set(module.id, module);
        }
    }

    /** Automatic bootstrap module if it is not lazy */
    private bootstrapIfNotLazy_(): void {
        for (let id of this.notInitalized_.keys()) {
            let isLazy = Boolean(this.notInitalized_.get(id).lazy);
            if (!isLazy) this.getModule(id);
        }
    }
}
