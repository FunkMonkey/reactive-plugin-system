import Rx from 'rxjs';
import _factoryLoaders from './loaders';

export const factoryLoaders = _factoryLoaders;

function digestGetFactoryResult( result ) {
  // TODO: handle plain objects & promises
  return result.first();
}

function digestFactoryResult( result ) {
  return result.first();
}

const beforeUnsubscribe = funcToCall =>
  source$ => new Rx.Observable( observer => {
    const subscription = source$.subscribe( observer );
    return () => {
      funcToCall();
      subscription.unsubscribe();
    };
  } );

function stringToPluginInfo( idOrPluginInfo ) {
  if ( typeof idOrPluginInfo === 'string' )
    return { id: idOrPluginInfo };

  return idOrPluginInfo;
}

function getID( idOrPluginInfo ) {
  if ( typeof idOrPluginInfo === 'string' )
    return idOrPluginInfo;

  return idOrPluginInfo.id;
}

/**
 *
 * @typedef {Object} PluginInfo
 * @property {string}         id           Unique id of the plugin
 * @property {pluginFactory}  [factory]    The associated plugin factory
 * @property {}               [exports]    Exports of the plugin
 */

/**
 * Factory function for plugins
 * @callback pluginFactory
 * @param   {}               data           Shared data given to all factory functions
 * @param   {PluginSystem}   pluginSystem   The plugin system that called the factory
 * @return  {Observable.<any>}              Exports of the factory - can be anything
 */


/**
 * A function that returns a factory function
 *
 * @callback getFactoryCB
 * @param   {PluginInfo}      pluginInfo   Plugin information that contains at least an `id`
 * @return  {Observable.<pluginFactory>}   The factory function
 */


/**
 * Represents the plugin system
 */
export class PluginSystem {
  /**
   * Creates a `PluginSystem` instance.
   *
   * @param    {}               data         Shared data that is passed to plugin factory functions
   * @param    {getFactoryCB}   getFactory   Callback function that is used to get a plugin factory.
   *                                         Useful to provide a way of loading the plugins.
   */
  constructor( { data, getFactory } ) {
    this.data = data;
    this.getFactory = getFactory;
    this.loaded = {};

    if ( !getFactory )
      getFactory = factoryLoaders.standard;

    /**
     * Subject that takes `PluginInfo`s or ids to load plugins
     * @type   {Rx.ReplaySubject.<PluginInfo|string>}
     */
    this.toLoad$ = new Rx.ReplaySubject();

    /**
     * Subject that takes `PluginInfo`s or ids to unload plugins
     * @type   {Rx.ReplaySubject.<PluginInfo|string>}
     */
    this.toUnload$ = new Rx.ReplaySubject();

    /**
     * Observable of loaded `PluginInfo`s
     * @type   {Rx.Observable.<PluginInfo>}
     */
    this.loaded$ = this.toLoad$
      .map( stringToPluginInfo )
      // TODO: handle already loaded plugins
      .flatMap( pluginInfo => digestGetFactoryResult( this.getFactory( pluginInfo ) ) )
      .flatMap( pluginInfo => this._loadPlugin( pluginInfo ) )
      .publishReplay()
      .refCount(); // TODO: use `shareReplay`

    /**
     * Observable of unloaded `PluginInfo`s
     * @type   {Rx.Observable.<PluginInfo>}
     */
    this.unloaded$ = this.toUnload$
      .map( stringToPluginInfo )
      .do( pluginInfo => { this.loaded[pluginInfo.id].subscription.unsubscribe(); } )
      .publishReplay()
      .refCount(); // TODO: use `shareReplay`

    // TODO: don't forward error to console here
    this.loadSubscription = this.loaded$
      .subscribe( () => {}, err => console.error( err, err.stack ) );
    this.unloadSubscription = this.unloaded$
      .subscribe( () => {}, err => console.error( err, err.stack ) )
  }

  /**
   * Destroys the plugin-system by unsubscribing.
   * If no one else subscribed to `loaded$` or `unloaded$` this will result in
   * plugins cleaning up.
   */
  destroy() {
    // TODO: force unload of all loaded plugins?
    this.loadSubscription.unsubscribe();
    this.unloadSubscription.unsubscribe();
  }

  _loadPlugin( { id, factory } ) {
    const plugin$ = digestFactoryResult( factory( this.data, this ) );

    return new Rx.Observable( observer => {
      const pluginInfo = { id, factory };

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
   * @param    {PluginInfo|string}   idOrPluginInfo   Plugin to wait for
   * @return   {Rx.Observable.<any>}                  Exports of the plugin
   */
  waitFor( idOrPluginInfo ) {
    return this.loaded$
      .filter( ( { id } ) => id === getID( idOrPluginInfo ) )
      .first()
      .map( ( { exports } ) => exports );
  }

  /**
   * Waits for a plugin and returns its exports as an Observable
   * @param    {PluginInfo|string}   idOrPluginInfo   Plugin to wait for
   * @return   {Rx.Observable.<any>}                  Exports of the plugin
   */
  waitForAll( pluginIDs ) {
    return Rx.Observable.combineLatest( pluginIDs.map( this.waitFor.bind( this ) ) );
  }

  load( idOrPluginInfo ) {
    this.toLoad$.next( idOrPluginInfo );
  }

  loadAndWaitFor( idOrPluginInfo ) {
    this.load( idOrPluginInfo );
    return this.waitFor( idOrPluginInfo );
  }

  loadAndWaitForAll( idsOrPluginInfos ) {
    idsOrPluginInfos.forEach( this.load.bind( this ) );
    return this.waitForAll( idsOrPluginInfos );
  }

  unload( idOrPluginInfo ) {
    this.toUnload$.next( idOrPluginInfo );
  }

  // unload( plugin ) {
  //   this.toUnload$.next( plugin );
  // }
}
