/**
 * @module PluginSystem
 */

import { Observable, Subscription } from 'rxjs';
import { PluginSystem } from './index';

export interface IPluginFactory {
  ( data: any, plugins: PluginSystem ): Observable<any>;
}

/**
 * Minimum info for loading a plugin. Only contains an identifier.
 */
export interface IPluginBaseInfo {
  id: string;
}

/**
 * Extends IPluginBaseInfo with factory for loading and instantiating plugins.
 */
export interface IPluginLoadInfo extends IPluginBaseInfo {
  factory: IPluginFactory;
}

/**
 * Contains all information of a successfully loaded plugin.
 */
export interface IPlugin extends IPluginLoadInfo {
  exports: any;
  subscription: Subscription;
}
