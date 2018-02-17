import { Observable, ReplaySubject, Subscriber, Subscription } from 'rxjs';
import { IPluginBaseInfo, IPluginLoadInfo, IPlugin } from './iplugininfo';
import _factoryLoaders from './loaders';

export const factoryLoaders = _factoryLoaders;

function digestGetFactoryResult( result: Observable<IPluginLoadInfo> ) {
  // TODO: handle plain objects & promises
  return result.first();
}

function digestFactoryResult( result: Observable<any> ) {
  return result.first();
}

function beforeUnsubscribe<T>( funcToCall: Function ) {
  return ( source$: Observable<T> ) => new Observable( ( observer: Subscriber<T> ) => {
    const subscription = source$.subscribe( observer );
    return () => {
      funcToCall();
      subscription.unsubscribe();
    };
  } );
}

function stringToPluginInfo( idOrPluginInfo: string | IPluginBaseInfo ) {
  if ( typeof idOrPluginInfo === 'string' )
    return { id: idOrPluginInfo };

  return idOrPluginInfo;
}

function getID( idOrPluginInfo : string | IPluginBaseInfo ) {
  if ( typeof idOrPluginInfo === 'string' )
    return idOrPluginInfo;

  return idOrPluginInfo.id;
}

export interface IGetFactoryCB {
  ( pluginInfo: IPluginBaseInfo ): Observable<IPluginLoadInfo>;
}

export interface IPluginSystemOptions {
  data: any,
  getFactory: IGetFactoryCB
 }

/**
 * Represents the plugin system
 */
export class PluginSystem {
  data: any;
  getFactory: IGetFactoryCB;
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

  loadSubscription: Subscription;
  unloadSubscription: Subscription;

  /**
   * Creates a `PluginSystem` instance.
   *
   * @param    {}               data         Shared data that is passed to plugin factory functions
   * @param    {getFactoryCB}   getFactory   Callback function that is used to get a plugin factory.
   *                                         Useful to provide a way of loading the plugins.
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
    // TODO: force unload of all loaded plugins?
    this.loadSubscription.unsubscribe();
    this.unloadSubscription.unsubscribe();
  }

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
   * @param    {PluginInfo|string}   idOrPluginInfo   Plugin to wait for
   * @return   {Rx.Observable.<any>}                  Exports of the plugin
   */
  waitFor( idOrPluginInfo: string | IPluginBaseInfo ) {
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
  waitForAll( pluginIDs: string[] | IPluginBaseInfo[] ) {
    return Observable.combineLatest( ( pluginIDs as any[] ).map( this.waitFor.bind( this ) ) );
  }

  load( idOrPluginInfo: string | IPluginBaseInfo ) {
    this.toLoad$.next( idOrPluginInfo );
  }

  loadAndWaitFor( idOrPluginInfo: string | IPluginBaseInfo ) {
    this.load( idOrPluginInfo );
    return this.waitFor( idOrPluginInfo );
  }

  loadAndWaitForAll( idsOrPluginInfos: string[] | IPluginBaseInfo[] ) {
    ( idsOrPluginInfos as any[] ).forEach( this.load.bind( this ) );
    return this.waitForAll( idsOrPluginInfos );
  }

  unload( idOrPluginInfo: string | IPluginBaseInfo ) {
    this.toUnload$.next( idOrPluginInfo );
  }

  // unload( plugin ) {
  //   this.toUnload$.next( plugin );
  // }
}
