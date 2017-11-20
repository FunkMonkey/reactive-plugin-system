import Rx from 'rxjs';

export default class PluginSystem {
  constructor( data ) {
    this.currentlyLoaded = {};

    this.toLoad$ = new Rx.ReplaySubject();
    this.currentlyLoading$ = this.toLoad$;
    this.loaded$ = this.currentlyLoading$
      .flatMap( ( { id, fn } ) =>
        fn( data, this )
          .first()
          .do( () => { this.currentlyLoaded[id] = true; } )
          .map( exports => ( { id, exports } ) ) )
      .publishReplay().refCount(); // TODO: use `shareReplay`

    this.subscription = this.loaded$.subscribe( () => {}, err => console.error( err ) );
  }

  load( plugin ) {
    this.toLoad$.next( plugin );
  }

  unload( plugin ) {
    this.toUnload$.next( plugin );
  }
}


function plugin1( data, plugins ) {
  console.log( data );
  return Rx.Observable.of( { foo: 'myplugin' } );
}

function plugin2( data, plugins ) {
  console.log( 'plugin2' );
  return plugins.loaded$
    .filter( ( { id } ) => id === 'plugin1' )
    .first()
    .map( ( { exports } ) => exports )
    .map( plug => plug.foo + ' alterted' );
}

function test() {
  const plugins = new PluginSystem( 'foobar' );
  plugins.load( { id: 'plugin1', fn: plugin1 } );
  plugins.load( { id: 'plugin2', fn: plugin2 } );

  plugins.loaded$.subscribe( plugin => console.log( 'loaded plugin', plugin ) );
}

test();
