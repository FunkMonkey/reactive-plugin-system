/**
 * @module PluginSystem
 */

import { Observable } from 'rxjs';
import { IPluginLoadInfo } from './iplugininfo';

export default {
  /**
   * Returns the given argument as an Observable with a single element.
   */
  standard: ( pluginInfo: IPluginLoadInfo ) => Observable.of( pluginInfo ),

  /**
   * Loads a plugin factory using `require`
   * @param    {IPluginLoadInfo}   {id}   [description]
   * @return   {[type]}                   [description]
   */
  require( { id }: IPluginLoadInfo ) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require( id );
    return Observable.of( { id, factory: mod.default || mod } );
  }
};
