import {IContext, IModule} from './abstractions';
import {Loader, Context, Module} from './concretes';

export {IContext, IModule, Module};

/** Run Autoloader for settled directories and return created Context */
export function run(dirs: string[]): IContext {
    let loader: Loader = new Loader(dirs);
    let context: Context = new Context(loader);
    return context;
}
