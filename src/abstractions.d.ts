/**
 * Common application context - entity which provides modules dependencies
 * resolving and bootstraping
 */
export interface IContext {
    getModule<EXPORTS>(id: string): EXPORTS;
}

/**
 * Most base module abstraction - pure module without dependencies and
 * bootstraping support
 */
export interface IModule {
    id: string;
    bootstrap?<EXPORTS>(context?: IContext): EXPORTS;
}
