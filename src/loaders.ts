import { Observable } from 'rxjs';
import { IPluginLoadInfo } from './iplugininfo';

export default {
  standard: ( pluginInfo: IPluginLoadInfo ) => Observable.of( pluginInfo ),
  require( { id }: IPluginLoadInfo ) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require( id );
    return Observable.of( { id, factory: mod.default || mod } );
  }
};
