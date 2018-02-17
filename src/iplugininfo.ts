import { Observable, Subscription } from 'rxjs';
import { PluginSystem } from './index';

export interface IPluginFactory {
  ( data: any, plugins: PluginSystem ): Observable<any>;
}

export interface IPluginBaseInfo {
  id: string;
}

export interface IPluginLoadInfo extends IPluginBaseInfo {
  factory: IPluginFactory;
}

export interface IPlugin extends IPluginLoadInfo {
  exports: any;
  subscription: Subscription;
}
