/**
 * @module PluginSystem
 */

import { Observable, ReplaySubject, Subscriber, Subscription } from 'rxjs';
import { IPluginBaseInfo, IPluginLoadInfo, IPlugin } from './iplugininfo';
import _factoryLoaders from './loaders';

/**
 * @hidden
 */
export const factoryLoaders = _factoryLoaders;

/**
 * Takes the result of a `getFactory` call and turns it into an observable
 * @hidden
 */
function digestGetFactoryResult( result: Observable<IPluginLoadInfo> ) {
  // TODO: handle plain objects & promises
  return result.first();
}

/**
 * Takes the result of a factory and turns it into an observable
 * @hidden
 */
function digestFactoryResult( result: Observable<any> ) {
  return result.first();
}

/**
 * Operator that calls the given function right before unsubscription
 * @hidden
 */
function beforeUnsubscribe<T>( funcToCall: Function ) {
  return ( source$: Observable<T> ) => new Observable( ( observer: Subscriber<T> ) => {
    const subscription = source$.subscribe( observer );
    return () => {
      funcToCall();
      subscription.unsubscribe();
    };
  } );
}

/**
 * Retrieves a IPluginBaseInfo from a source string or object
 * @hidden
 */
function stringToPluginInfo( idOrPluginInfo: string | IPluginBaseInfo ) {
  if ( typeof idOrPluginInfo === 'string' )
    return { id: idOrPluginInfo };

  return idOrPluginInfo;
}

/**
 * Retrieves a plugin ID from a source string or object
 * @hidden
 */
function getID( idOrPluginInfo : string | IPluginBaseInfo ) {
  if ( typeof idOrPluginInfo === 'string' )
    return idOrPluginInfo;

  return idOrPluginInfo.id;
}

/**
 * A callback function that asynchronously loads a factory, which in turn can be used to
 * asynchronously instantiate the given plugin id.
 */
export interface IGetFactoryCB {
  ( pluginInfo: IPluginBaseInfo ): Observable<IPluginLoadInfo>;
}

/**
 * Options for the `PluginSystem`
 */
export interface IPluginSystemOptions {
  /**
   * Shared data between all plugins
   */
  data: any,

  /**
   * A callback function that asynchronously loads a factory, which in turn can be used to
   * asynchronously instantiate the given plugin id.
   */
  getFactory: IGetFactoryCB
 }

/**
 * Represents the plugin system
 */
export class PluginSystem {
  /**
   * Shared data between all plugins
   */
  data: any;

  /**
   * A callback function that asynchronously loads a factory, which in turn can be used to
   * asynchronously instantiate the given plugin id.
   */
  getFactory: IGetFactoryCB;

  /**
   * A dictionary of loaded plugins by `id`
   */
  loaded: { [id: string]: IPlugin };

  /**
   * Subject that takes `PluginLoadInfo`s or ids to load plugins
   */
  toLoad$: ReplaySubject<IPluginBaseInfo|string>;

  /**
   * Subject that takes `PluginLoadInfo`s or ids to unload plugins
   */
  toUnload$: ReplaySubject<IPluginBaseInfo|string>;

  /**
   * Observable of loaded `IPlugin`s
   */
  loaded$: Observable<IPlugin>;

  /**
   * Observable of unloaded `IPlugin`s
   */
  unloaded$: Observable<IPluginBaseInfo>;

  /**
   * Subscription to `loaded$`
   * @hidden
   */
  loadSubscription: Subscription;

  /**
   * Subscription to `unloaded$`
   * @hidden
   */
  unloadSubscription: Subscription;

  /**
   * Creates a `PluginSystem` instance.
   *
   * @param    data         Shared data that is passed to plugin factory functions
   * @param    getFactory   A callback function that asynchronously loads a factory,
   *                        which in turn can be used to asynchronously instantiate the
   *                        given plugin id.
   */
  constructor( { data, getFactory }: IPluginSystemOptions ) {
    this.data = data;
    this.getFactory = getFactory;
    this.loaded = {};

    if ( !getFactory )
      getFactory = factoryLoaders.standard;

    this.toLoad$ = new ReplaySubject();
    this.toUnload$ = new ReplaySubject();

    this.loaded$ = this.toLoad$
      .map( stringToPluginInfo )
      // TODO: handle already loaded plugins
      .flatMap( pluginLoadInfo => digestGetFactoryResult( this.getFactory( pluginLoadInfo ) ) )
      .flatMap( pluginLoadInfo => this._loadPlugin( pluginLoadInfo ) )
      .publishReplay()
      .refCount(); // TODO: use `shareReplay`


    this.unloaded$ = this.toUnload$
      .map( stringToPluginInfo )
      .do( pluginInfo => { this.loaded[pluginInfo.id].subscription.unsubscribe(); } )
      .publishReplay()
      .refCount(); // TODO: use `shareReplay`

    // TODO: don't forward error to console here
    this.loadSubscription = this.loaded$
      .subscribe( () => {}, err => console.error( err, err.stack ) );
    this.unloadSubscription = this.unloaded$
      .subscribe( () => {}, err => console.error( err, err.stack ) );
  }

  /**
   * Destroys the plugin-system by unsubscribing.
   * If no one else subscribed to `loaded$` or `unloaded$` this will result in
   * plugins cleaning up.
   */
  destroy() {
    // TODO: force unload of all loaded plugins? -> add param
    this.loadSubscription.unsubscribe();
    this.unloadSubscription.unsubscribe();
  }

  /**
   * @hidden
   */
  _loadPlugin( { id, factory }: IPluginLoadInfo ) {
    const plugin$ = digestFactoryResult( factory( this.data, this ) );

    return new Observable( ( observer: Subscriber<IPlugin> ) => {
      const pluginInfo: IPlugin = {
        id, factory, exports: null, subscription: null
      };

      // subscribe and keep subscription for later unloading
      const self = this;
      pluginInfo.subscription = plugin$
        .let( beforeUnsubscribe( () => delete this.loaded[pluginInfo.id] ) )
        .subscribe( {
          next( pluginExports ) {
            pluginInfo.exports = pluginExports;
            self.loaded[pluginInfo.id] = pluginInfo;
            observer.next( pluginInfo );
          },
          error( err ) { observer.error( err ); },
          complete() { observer.complete(); }
        } );

      // final cleanup
      return () => pluginInfo.subscription.unsubscribe();
    } );
  }

  /**
   * Waits for a plugin and returns its exports as an Observable
   * @param    idOrPluginInfo   Plugin to wait for
   * @return                    Observable of exports of the plugin
   */
  waitFor( idOrPluginInfo: string | IPluginBaseInfo ) {
    return this.loaded$
      .filter( ( { id } ) => id === getID( idOrPluginInfo ) )
      .first()
      .map( ( { exports } ) => exports );
  }

  /**
   * Waits for all given plugins and returns their exports as an `Observable`
   * @param    idOrPluginInfo   Plugins to load and wait for
   * @return                    Observable of exports of the plugins
   */
  waitForAll( idsOrPluginInfos: string[] | IPluginBaseInfo[] ) {
    return Observable.combineLatest( ( idsOrPluginInfos as any[] ).map( this.waitFor.bind( this ) ) );
  }

  /**
   * Loads a plugin, either by string or an object with an id.
   * Same as `pluginSystem.toLoad$.next(id)`.
   * @param    idOrPluginInfo   Plugin to load
   */
  load( idOrPluginInfo: string | IPluginBaseInfo ) {
    this.toLoad$.next( idOrPluginInfo );
  }

  /**
   * Loads a plugin, either by string or an object with an id and returns an observable
   * that contains the plugin's exports.
   * @param    idOrPluginInfo   Plugin to load
   * @return                    Observable with exports of the plugin
   */
  loadAndWaitFor( idOrPluginInfo: string | IPluginBaseInfo ) {
    this.load( idOrPluginInfo );
    return this.waitFor( idOrPluginInfo );
  }

  /**
   * Loads all plugins in parallel, either by strings or objects with an id and
   * returns an observable that contains the plugins' exports.
   * @param    idsOrPluginInfos   Plugins to load
   * @return                      Observable with exports of the plugins
   */
  loadAndWaitForAll( idsOrPluginInfos: string[] | IPluginBaseInfo[] ) {
    ( idsOrPluginInfos as any[] ).forEach( this.load.bind( this ) );
    return this.waitForAll( idsOrPluginInfos );
  }

  /**
   * Unloads a plugin, either by string or an object with an id.
   * Same as `pluginSystem.toUnload$.next(id)`.
   * @param    idOrPluginInfo   Plugin to unload
   */
  unload( idOrPluginInfo: string | IPluginBaseInfo ) {
    this.toUnload$.next( idOrPluginInfo );
  }

  // unload( plugin ) {
  //   this.toUnload$.next( plugin );
  // }
}
