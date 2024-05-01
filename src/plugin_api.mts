/**
 * @fileOverview プラグインAPIの型定義
 */

export type NakoVariables = Map<string, any>;
export type NakoCallback = Function|string;

// NakoSystem
export interface NakoSystem {
  isDebug: boolean;
  tags: any;
  __namespaceList: string[];
  __varslist: NakoVariables[]; // [0]はシステム変数 / [1]はグローバル変数 [2] 以降はローカル変数
  __getSysVar (name: string, defaultValue?: any): any;
  __setSysVar (name: string, value: any): void;
  __findVar (name: NakoCallback, defaultValue?: any): any;
  __findFunc (nameStr: any, parentFunc: string): any;
  __exec (func: string, params: any[]): any;
  __zero (s: string, keta: number): string;
  __formatDate (t: Date): string;
  __formatTime (t: Date): string;
}
