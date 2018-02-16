import Rx from 'rxjs';

export default {
  standard: pluginInfo => Rx.Observable.of( pluginInfo ),
  require( { id } ) {
    const mod = require( id );
    return Rx.Observable.of( { id, factory: mod.default || mod } );
  }
};
