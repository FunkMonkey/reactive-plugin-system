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

export class PluginSystem {
  constructor( { data, getFactory } ) {
    this.data = data;
    this.getFactory = getFactory;
    this.loaded = {};

    if ( !getFactory )
      getFactory = factoryLoaders.standard;

    this.toLoad$ = new Rx.ReplaySubject();
    this.toUnload$ = new Rx.ReplaySubject();
    this.loaded$ = this.toLoad$
      .map( stringToPluginInfo )
      // TODO: handle already loaded plugins
      .flatMap( pluginInfo => digestGetFactoryResult( this.getFactory( pluginInfo ) ) )
      .flatMap( pluginInfo => this._loadPlugin( pluginInfo ) )
      .publishReplay()
      .refCount(); // TODO: use `shareReplay`

    this.unloaded$ = this.toUnload$
      .map( stringToPluginInfo )
      .do( pluginInfo => { this.loaded[pluginInfo.id].subscription.unsubscribe(); } );

    // TODO: don't forward error to console here
    this.loadSubscription = this.loaded$
      .subscribe( () => {}, err => console.error( err, err.stack ) );
    this.unloadSubscription = this.unloaded$
      .subscribe( () => {}, err => console.error( err, err.stack ) )
  }

  destroy() {
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

  waitFor( idOrPluginInfo ) {
    return this.loaded$
      .filter( ( { id } ) => id === getID( idOrPluginInfo ) )
      .first()
      .map( ( { exports } ) => exports );
  }

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
