import Rx from 'rxjs';

export default {
  standard: pluginInfo => Rx.Observable.of( pluginInfo ),
  require: moduleName => Rx.Observable.of( require( moduleName ) )
};
