# reactive-plugin-system

`reactive-plugin-system` is an addon / extension / plugin system for JavaScript.
It uses [RxJS5](https://github.com/ReactiveX/rxjs) to handle asynchronous loading
and unloading of plugins. Plugins can depend on each other.

## Example

A simple plugin system that uses `require` to load plugins.

### some-app.js

```js
import { PluginSystem, factoryLoaders } from 'reactive-plugin-system';

const plugins = new PluginSystem( {
  data: 'shared',
  getFactory: factoryLoaders.require
} );

plugins.loadAndWaitForAll( 'plugin-a', `plugin-b`, `plugin-c` );
  .subscribe( ( [pluginA, pluginB, pluginC] ) => {
    pluginB.doSomething();
    plugins.unload( 'pluginC' ); // unloading and cleaning up
  } );
```

### plugin-a/index.js

`PluginA` loads asynchronously and uses shared data.

```js
class PluginA {
  constructor( data ) {
    this.data = data;
  }

  printData() {
    console.log( this.data );
  }
}

export default function pluginAFactory( data ) {
  return Rx.Observable.timer( 1000 ) // wait a second
    .map( () => new PluginA( data ) );
}
```

### plugin-b/index.js

`PluginB` depends on `PluginA`.

```js
class PluginB {
  constructor( pluginA ) {
    this.pluginA = pluginA;
  }

  doSomething() {
    this.pluginA.printData();
  }
}

export default function pluginBFactory( data, pluginSystem ) {
  return pluginSystem.waitFor( 'plugin-a' )
    .map( pluginA => new PluginB( pluginA ) );
}
```

### plugin-c/index.js

`PluginC` needs to clean up in the end.

```js
import { Observable } from 'rxjs';

class PluginC {
  cleanup() {
    // do cleanup
  }
}

export default function pluginCFactory() {
  return new Observable( observer => {
    const pluginC = new PluginC();

    observer.next( pluginC );
    observer.complete();

    return () => pluginC.cleanup();
  } );
}
```

## API

### PluginSystem

#### Constructor
