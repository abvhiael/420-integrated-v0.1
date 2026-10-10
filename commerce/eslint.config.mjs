export default [{
  files: ['src/**/*.mjs'],
  languageOptions: {ecmaVersion:2024,sourceType:'module',globals:Object.fromEntries(['Buffer','process','URL','fetch','crypto','console','AbortSignal','setTimeout','clearTimeout','structuredClone'].map(name=>[name,'readonly']))},
  rules: {'no-undef':'error','no-unused-vars':'error','no-eval':'error','no-implied-eval':'error','no-new-func':'error','no-script-url':'error','no-unreachable':'error','no-constant-condition':'error','no-dupe-keys':'error','no-duplicate-case':'error','valid-typeof':'error','constructor-super':'error'}
}];
