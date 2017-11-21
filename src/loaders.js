import Rx from 'rxjs';

export default {
  standard: pluginInfo => Rx.Observable.of( pluginInfo ),
  require( moduleName ) {
    const mod = require( moduleName );
    return Rx.Observable.of( mod.default || mod );
  }
};
