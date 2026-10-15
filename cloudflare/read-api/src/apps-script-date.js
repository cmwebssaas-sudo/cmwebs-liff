// The deployed Apps Script project's local Date zone is Asia/Taipei, while
// workerd's local Date zone is UTC. Preserve its modern operational calendar.
const offset = 8 * 60 * 60 * 1000;
function localInput(value) {
  if (typeof value !== 'string') return value;
  const match=value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/);
  // ECMAScript date-only ISO strings denote UTC even in Apps Script.
  if (!match || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]||0),Number(match[5]||0),Number(match[6]||0),Number((match[7]||'').padEnd(3,'0')))-offset;
}
export function appsScriptDate(now) {
  return class AppsScriptDate extends Date {
    constructor(...args) {
      super(args.length===0 ? now : args.length>1 ? Date.UTC(...args)-offset : localInput(args[0]));
    }
    static now() { return now; }
    static parse(value) { const input=localInput(value); return typeof input==='number'?input:Date.parse(input); }
    getFullYear() { return new Date(this.getTime()+offset).getUTCFullYear(); }
    getMonth() { return new Date(this.getTime()+offset).getUTCMonth(); }
    getDate() { return new Date(this.getTime()+offset).getUTCDate(); }
    getDay() { return new Date(this.getTime()+offset).getUTCDay(); }
    getHours() { return new Date(this.getTime()+offset).getUTCHours(); }
    getMinutes() { return new Date(this.getTime()+offset).getUTCMinutes(); }
    getSeconds() { return new Date(this.getTime()+offset).getUTCSeconds(); }
    getTimezoneOffset() { return -480; }
    setHours(...args) {
      const shifted=new Date(this.getTime()+offset);
      shifted.setUTCHours(...args);
      return this.setTime(shifted.getTime()-offset);
    }
  };
}
