import Rx from 'rxjs';
import _loaders from './loaders';

export const loaders = _loaders;


export class PluginSystem {
  constructor( { data, loader } ) {
    this.loaded = {};

    if ( !loader )
      loader = loaders.standard;

    this.toLoad$ = new Rx.ReplaySubject();
    this.loaded$ = this.toLoad$
      .flatMap( loadInfo => loader( loadInfo ).first() )
      .flatMap( ( { id, factory } ) =>
        factory( data, this ) // TODO: also allow plain objects
          .first()
          .do( () => { this.loaded[id] = true; } )
          .map( exports => ( { id, exports } ) ) )
      .publishReplay().refCount(); // TODO: use `shareReplay`

    // TODO: don't forward error to console here
    this.subscription = this.loaded$.subscribe( () => {}, err => console.error( err ) );
  }

  waitFor( pluginID ) {
    return this.loaded$
      .filter( ( { id } ) => id === pluginID )
      .first()
      .map( ( { exports } ) => exports );
  }

  waitForAll( pluginIDs ) {
    return Rx.Observable.combineLatest( pluginIDs.map( this.waitFor.bind( this ) ) );
  }

  load( loadInfo ) {
    this.toLoad$.next( loadInfo );
  }

  // unload( plugin ) {
  //   this.toUnload$.next( plugin );
  // }
}
