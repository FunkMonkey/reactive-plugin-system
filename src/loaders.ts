import { Observable } from 'rxjs';
import { IPluginLoadInfo } from './iplugininfo';

export default {
  standard: ( pluginInfo: IPluginLoadInfo ) => Observable.of( pluginInfo ),
  require( { id }: IPluginLoadInfo ) {
    const mod = require( id );
    return Observable.of( { id, factory: mod.default || mod } );
  }
};
