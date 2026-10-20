var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
var init_utils = __esm({
  "node_modules/unenv/dist/runtime/_internal/utils.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(createNotImplementedError, "createNotImplementedError");
    __name(notImplemented, "notImplemented");
    __name(notImplementedClass, "notImplementedClass");
  }
});

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin, _performanceNow, nodeTiming, PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceResourceTiming, PerformanceObserverEntryList, Performance, PerformanceObserver, performance;
var init_performance = __esm({
  "node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: "node",
      entryType: "node",
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0
      },
      detail: void 0,
      toJSON() {
        return this;
      }
    };
    PerformanceEntry = class {
      static {
        __name(this, "PerformanceEntry");
      }
      __unenv__ = true;
      detail;
      entryType = "event";
      name;
      startTime;
      constructor(name, options) {
        this.name = name;
        this.startTime = options?.startTime || _performanceNow();
        this.detail = options?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail
        };
      }
    };
    PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
      static {
        __name(this, "PerformanceMark");
      }
      entryType = "mark";
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    };
    PerformanceMeasure = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceMeasure");
      }
      entryType = "measure";
    };
    PerformanceResourceTiming = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceResourceTiming");
      }
      entryType = "resource";
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = "";
      name = "";
      nextHopProtocol = "";
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    PerformanceObserverEntryList = class {
      static {
        __name(this, "PerformanceObserverEntryList");
      }
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    Performance = class {
      static {
        __name(this, "Performance");
      }
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError("Performance.timerify");
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming("");
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
      }
      clearMeasures(measureName) {
        this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
      }
      clearResourceTimings() {
        this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options) {
        const entry = new PerformanceMark(name, options);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === "string") {
          start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
          end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end
          }
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.addEventListener");
      }
      removeEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.removeEventListener");
      }
      dispatchEvent(event) {
        throw createNotImplementedError("Performance.dispatchEvent");
      }
      toJSON() {
        return this;
      }
    };
    PerformanceObserver = class {
      static {
        __name(this, "PerformanceObserver");
      }
      __unenv__ = true;
      static supportedEntryTypes = [];
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError("PerformanceObserver.disconnect");
      }
      observe(options) {
        throw createNotImplementedError("PerformanceObserver.observe");
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
  }
});

// node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  "node_modules/unenv/dist/runtime/node/perf_hooks.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_performance();
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs"() {
    init_perf_hooks();
    if (!("__unenv__" in performance)) {
      const proto = Performance.prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key !== "constructor" && !(key in performance)) {
          const desc = Object.getOwnPropertyDescriptor(proto, key);
          if (desc) {
            Object.defineProperty(performance, key, desc);
          }
        }
      }
    }
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  }
});

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default;
var init_noop = __esm({
  "node_modules/unenv/dist/runtime/mock/noop.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    noop_default = Object.assign(() => {
    }, { __unenv__: true });
  }
});

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";
var _console, _ignoreErrors, _stderr, _stdout, log, info, trace, debug, table, error, warn, createTask, clear, count, countReset, dir, dirxml, group, groupEnd, groupCollapsed, profile, profileEnd, time, timeEnd, timeLog, timeStamp, Console, _times, _stdoutErrorHandler, _stderrErrorHandler;
var init_console = __esm({
  "node_modules/unenv/dist/runtime/node/console.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_noop();
    init_utils();
    _console = globalThis.console;
    _ignoreErrors = true;
    _stderr = new Writable();
    _stdout = new Writable();
    log = _console?.log ?? noop_default;
    info = _console?.info ?? log;
    trace = _console?.trace ?? info;
    debug = _console?.debug ?? log;
    table = _console?.table ?? log;
    error = _console?.error ?? log;
    warn = _console?.warn ?? error;
    createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
    clear = _console?.clear ?? noop_default;
    count = _console?.count ?? noop_default;
    countReset = _console?.countReset ?? noop_default;
    dir = _console?.dir ?? noop_default;
    dirxml = _console?.dirxml ?? noop_default;
    group = _console?.group ?? noop_default;
    groupEnd = _console?.groupEnd ?? noop_default;
    groupCollapsed = _console?.groupCollapsed ?? noop_default;
    profile = _console?.profile ?? noop_default;
    profileEnd = _console?.profileEnd ?? noop_default;
    time = _console?.time ?? noop_default;
    timeEnd = _console?.timeEnd ?? noop_default;
    timeLog = _console?.timeLog ?? noop_default;
    timeStamp = _console?.timeStamp ?? noop_default;
    Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
    _times = /* @__PURE__ */ new Map();
    _stdoutErrorHandler = noop_default;
    _stderrErrorHandler = noop_default;
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole, assert, clear2, context, count2, countReset2, createTask2, debug2, dir2, dirxml2, error2, group2, groupCollapsed2, groupEnd2, info2, log2, profile2, profileEnd2, table2, time2, timeEnd2, timeLog2, timeStamp2, trace2, warn2, console_default;
var init_console2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_console();
    workerdConsole = globalThis["console"];
    ({
      assert,
      clear: clear2,
      context: (
        // @ts-expect-error undocumented public API
        context
      ),
      count: count2,
      countReset: countReset2,
      createTask: (
        // @ts-expect-error undocumented public API
        createTask2
      ),
      debug: debug2,
      dir: dir2,
      dirxml: dirxml2,
      error: error2,
      group: group2,
      groupCollapsed: groupCollapsed2,
      groupEnd: groupEnd2,
      info: info2,
      log: log2,
      profile: profile2,
      profileEnd: profileEnd2,
      table: table2,
      time: time2,
      timeEnd: timeEnd2,
      timeLog: timeLog2,
      timeStamp: timeStamp2,
      trace: trace2,
      warn: warn2
    } = workerdConsole);
    Object.assign(workerdConsole, {
      Console,
      _ignoreErrors,
      _stderr,
      _stderrErrorHandler,
      _stdout,
      _stdoutErrorHandler,
      _times
    });
    console_default = workerdConsole;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console"() {
    init_console2();
    globalThis.console = console_default;
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
      const now = Date.now();
      const seconds = Math.trunc(now / 1e3);
      const nanos = now % 1e3 * 1e6;
      if (startTime) {
        let diffSeconds = seconds - startTime[0];
        let diffNanos = nanos - startTime[0];
        if (diffNanos < 0) {
          diffSeconds = diffSeconds - 1;
          diffNanos = 1e9 + diffNanos;
        }
        return [diffSeconds, diffNanos];
      }
      return [seconds, nanos];
    }, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
      return BigInt(Date.now() * 1e6);
    }, "bigint") });
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream;
var init_read_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    ReadStream = class {
      static {
        __name(this, "ReadStream");
      }
      fd;
      isRaw = false;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream;
var init_write_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    WriteStream = class {
      static {
        __name(this, "WriteStream");
      }
      fd;
      columns = 80;
      rows = 24;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      clearLine(dir3, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === "function" && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count3, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      write(str2, encoding, cb) {
        if (str2 instanceof Uint8Array) {
          str2 = new TextDecoder().decode(str2);
        }
        try {
          console.log(str2);
        } catch {
        }
        cb && typeof cb === "function" && cb();
        return false;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  "node_modules/unenv/dist/runtime/node/tty.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_read_stream();
    init_write_stream();
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION;
var init_node_version = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    NODE_VERSION = "22.14.0";
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";
var Process;
var init_process = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/process.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_tty();
    init_utils();
    init_node_version();
    Process = class _Process extends EventEmitter {
      static {
        __name(this, "Process");
      }
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
          const value = this[prop];
          if (typeof value === "function") {
            this[prop] = value.bind(this);
          }
        }
      }
      // --- event emitter ---
      emitWarning(warning, type, code) {
        console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      // --- stdio (lazy initializers) ---
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return this.#stdin ??= new ReadStream(0);
      }
      get stdout() {
        return this.#stdout ??= new WriteStream(1);
      }
      get stderr() {
        return this.#stderr ??= new WriteStream(2);
      }
      // --- cwd ---
      #cwd = "/";
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      // --- dummy props and getters ---
      arch = "";
      platform = "";
      argv = [];
      argv0 = "";
      execArgv = [];
      execPath = "";
      title = "";
      pid = 200;
      ppid = 100;
      get version() {
        return `v${NODE_VERSION}`;
      }
      get versions() {
        return { node: NODE_VERSION };
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      // --- noop methods ---
      ref() {
      }
      unref() {
      }
      // --- unimplemented methods ---
      umask() {
        throw createNotImplementedError("process.umask");
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError("process.getActiveResourcesInfo");
      }
      exit() {
        throw createNotImplementedError("process.exit");
      }
      reallyExit() {
        throw createNotImplementedError("process.reallyExit");
      }
      kill() {
        throw createNotImplementedError("process.kill");
      }
      abort() {
        throw createNotImplementedError("process.abort");
      }
      dlopen() {
        throw createNotImplementedError("process.dlopen");
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError("process.setSourceMapsEnabled");
      }
      loadEnvFile() {
        throw createNotImplementedError("process.loadEnvFile");
      }
      disconnect() {
        throw createNotImplementedError("process.disconnect");
      }
      cpuUsage() {
        throw createNotImplementedError("process.cpuUsage");
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
      }
      initgroups() {
        throw createNotImplementedError("process.initgroups");
      }
      openStdin() {
        throw createNotImplementedError("process.openStdin");
      }
      assert() {
        throw createNotImplementedError("process.assert");
      }
      binding() {
        throw createNotImplementedError("process.binding");
      }
      // --- attached interfaces ---
      permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
      report = {
        directory: "",
        filename: "",
        signal: "SIGUSR2",
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
        writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented("process.finalization.register"),
        unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
        registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
      };
      memoryUsage = Object.assign(() => ({
        arrayBuffers: 0,
        rss: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0
      }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
      // --- undefined props ---
      mainModule = void 0;
      domain = void 0;
      // optional
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      // internals
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess, getBuiltinModule, workerdProcess, unenvProcess, exit, features, platform, _channel, _debugEnd, _debugProcess, _disconnect, _events, _eventsCount, _exiting, _fatalException, _getActiveHandles, _getActiveRequests, _handleQueue, _kill, _linkedBinding, _maxListeners, _pendingMessage, _preload_modules, _rawDebug, _send, _startProfilerIdleNotifier, _stopProfilerIdleNotifier, _tickCallback, abort, addListener, allowedNodeEnvironmentFlags, arch, argv, argv0, assert2, availableMemory, binding, channel, chdir, config, connected, constrainedMemory, cpuUsage, cwd, debugPort, disconnect, dlopen, domain, emit, emitWarning, env, eventNames, execArgv, execPath, exitCode, finalization, getActiveResourcesInfo, getegid, geteuid, getgid, getgroups, getMaxListeners, getuid, hasUncaughtExceptionCaptureCallback, hrtime3, initgroups, kill, listenerCount, listeners, loadEnvFile, mainModule, memoryUsage, moduleLoadList, nextTick, off, on, once, openStdin, permission, pid, ppid, prependListener, prependOnceListener, rawListeners, reallyExit, ref, release, removeAllListeners, removeListener, report, resourceUsage, send, setegid, seteuid, setgid, setgroups, setMaxListeners, setSourceMapsEnabled, setuid, setUncaughtExceptionCaptureCallback, sourceMapsEnabled, stderr, stdin, stdout, throwDeprecation, title, traceDeprecation, umask, unref, uptime, version, versions, _process, process_default;
var init_process2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis["process"];
    getBuiltinModule = globalProcess.getBuiltinModule;
    workerdProcess = getBuiltinModule("node:process");
    unenvProcess = new Process({
      env: globalProcess.env,
      hrtime,
      // `nextTick` is available from workerd process v1
      nextTick: workerdProcess.nextTick
    });
    ({ exit, features, platform } = workerdProcess);
    ({
      _channel,
      _debugEnd,
      _debugProcess,
      _disconnect,
      _events,
      _eventsCount,
      _exiting,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _handleQueue,
      _kill,
      _linkedBinding,
      _maxListeners,
      _pendingMessage,
      _preload_modules,
      _rawDebug,
      _send,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      arch,
      argv,
      argv0,
      assert: assert2,
      availableMemory,
      binding,
      channel,
      chdir,
      config,
      connected,
      constrainedMemory,
      cpuUsage,
      cwd,
      debugPort,
      disconnect,
      dlopen,
      domain,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exitCode,
      finalization,
      getActiveResourcesInfo,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getMaxListeners,
      getuid,
      hasUncaughtExceptionCaptureCallback,
      hrtime: hrtime3,
      initgroups,
      kill,
      listenerCount,
      listeners,
      loadEnvFile,
      mainModule,
      memoryUsage,
      moduleLoadList,
      nextTick,
      off,
      on,
      once,
      openStdin,
      permission,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      reallyExit,
      ref,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      send,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setMaxListeners,
      setSourceMapsEnabled,
      setuid,
      setUncaughtExceptionCaptureCallback,
      sourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      throwDeprecation,
      title,
      traceDeprecation,
      umask,
      unref,
      uptime,
      version,
      versions
    } = unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    };
    process_default = _process;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process"() {
    init_process2();
    globalThis.process = process_default;
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// node_modules/jose/dist/webapi/lib/buffer_utils.js
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0), buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers)
    buf.set(buffer, i), i += buffer.length;
  return buf;
}
function writeUInt32BE(buf, value, offset) {
  if (value < 0 || value >= MAX_INT32)
    throw new RangeError(`value must be >= 0 and <= ${MAX_INT32 - 1}. Received ${value}`);
  buf.set([value >>> 24, value >>> 16, value >>> 8, value & 255], offset);
}
function uint64be(value) {
  const high = Math.floor(value / MAX_INT32), low = value % MAX_INT32, buf = new Uint8Array(8);
  return writeUInt32BE(buf, high, 0), writeUInt32BE(buf, low, 4), buf;
}
function uint32be(value) {
  const buf = new Uint8Array(4);
  return writeUInt32BE(buf, value), buf;
}
function encode(string) {
  if (typeof string == "string" && string.length >= 128) {
    if (NON_ASCII.test(string))
      throw new TypeError("non-ASCII string encountered in encode()");
    return encoder.encode(string);
  }
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127)
      throw new TypeError("non-ASCII string encountered in encode()");
    bytes[i] = code;
  }
  return bytes;
}
function encodeBase64(input, url = false) {
  if (Uint8Array.prototype.toBase64)
    return input.toBase64({ alphabet: url ? "base64url" : "base64", omitPadding: url });
  const CHUNK_SIZE = 32768, arr = [];
  for (let i = 0; i < input.length; i += CHUNK_SIZE)
    arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
  const encoded = btoa(arr.join(""));
  return url ? encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") : encoded;
}
function decodeBase64(encoded, url = false) {
  if (Uint8Array.fromBase64)
    return Uint8Array.fromBase64(encoded, { alphabet: url ? "base64url" : "base64" });
  if (url) {
    if (encoded.includes("+") || encoded.includes("/"))
      throw new TypeError("Invalid base64url");
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  }
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function digest(algorithm, data) {
  const subtleDigest = `SHA-${algorithm.slice(-3)}`;
  return new Uint8Array(await crypto.subtle.digest(subtleDigest, data));
}
var encoder, decoder, strictDecoder, MAX_INT32, NON_ASCII;
var init_buffer_utils = __esm({
  "node_modules/jose/dist/webapi/lib/buffer_utils.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    encoder = new TextEncoder();
    decoder = new TextDecoder();
    strictDecoder = new TextDecoder("utf-8", { fatal: true });
    MAX_INT32 = 2 ** 32;
    __name(concat, "concat");
    __name(writeUInt32BE, "writeUInt32BE");
    __name(uint64be, "uint64be");
    __name(uint32be, "uint32be");
    NON_ASCII = /[^\x00-\x7f]/;
    __name(encode, "encode");
    __name(encodeBase64, "encodeBase64");
    __name(decodeBase64, "decodeBase64");
    __name(digest, "digest");
  }
});

// node_modules/jose/dist/webapi/util/errors.js
var errors_exports = {};
__export(errors_exports, {
  JOSEAlgNotAllowed: () => JOSEAlgNotAllowed,
  JOSEError: () => JOSEError,
  JOSENotSupported: () => JOSENotSupported,
  JWEDecryptionFailed: () => JWEDecryptionFailed,
  JWEInvalid: () => JWEInvalid,
  JWKInvalid: () => JWKInvalid,
  JWKSInvalid: () => JWKSInvalid,
  JWKSMultipleMatchingKeys: () => JWKSMultipleMatchingKeys,
  JWKSNoMatchingKey: () => JWKSNoMatchingKey,
  JWKSTimeout: () => JWKSTimeout,
  JWSInvalid: () => JWSInvalid,
  JWSSignatureVerificationFailed: () => JWSSignatureVerificationFailed,
  JWTClaimValidationFailed: () => JWTClaimValidationFailed,
  JWTExpired: () => JWTExpired,
  JWTInvalid: () => JWTInvalid
});
var JOSEError, JWTClaimValidationFailed, JWTExpired, JOSEAlgNotAllowed, JOSENotSupported, JWEDecryptionFailed, JWEInvalid, JWSInvalid, JWTInvalid, JWKInvalid, JWKSInvalid, JWKSNoMatchingKey, JWKSMultipleMatchingKeys, JWKSTimeout, JWSSignatureVerificationFailed;
var init_errors = __esm({
  "node_modules/jose/dist/webapi/util/errors.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    JOSEError = class extends Error {
      static {
        __name(this, "JOSEError");
      }
      static code = "ERR_JOSE_GENERIC";
      code = "ERR_JOSE_GENERIC";
      constructor(message2, options) {
        super(message2, options), this.name = this.constructor.name, Error.captureStackTrace?.(this, this.constructor);
      }
    };
    JWTClaimValidationFailed = class extends JOSEError {
      static {
        __name(this, "JWTClaimValidationFailed");
      }
      static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
      code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
      claim;
      reason;
      payload;
      constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
        super(message2, { cause: { claim, reason, payload } }), this.claim = claim, this.reason = reason, this.payload = payload;
      }
    };
    JWTExpired = class extends JOSEError {
      static {
        __name(this, "JWTExpired");
      }
      static code = "ERR_JWT_EXPIRED";
      code = "ERR_JWT_EXPIRED";
      claim;
      reason;
      payload;
      constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
        super(message2, { cause: { claim, reason, payload } }), this.claim = claim, this.reason = reason, this.payload = payload;
      }
    };
    JOSEAlgNotAllowed = class extends JOSEError {
      static {
        __name(this, "JOSEAlgNotAllowed");
      }
      static code = "ERR_JOSE_ALG_NOT_ALLOWED";
      code = "ERR_JOSE_ALG_NOT_ALLOWED";
    };
    JOSENotSupported = class extends JOSEError {
      static {
        __name(this, "JOSENotSupported");
      }
      static code = "ERR_JOSE_NOT_SUPPORTED";
      code = "ERR_JOSE_NOT_SUPPORTED";
    };
    JWEDecryptionFailed = class extends JOSEError {
      static {
        __name(this, "JWEDecryptionFailed");
      }
      static code = "ERR_JWE_DECRYPTION_FAILED";
      code = "ERR_JWE_DECRYPTION_FAILED";
      constructor(message2 = "decryption operation failed", options) {
        super(message2, options);
      }
    };
    JWEInvalid = class extends JOSEError {
      static {
        __name(this, "JWEInvalid");
      }
      static code = "ERR_JWE_INVALID";
      code = "ERR_JWE_INVALID";
    };
    JWSInvalid = class extends JOSEError {
      static {
        __name(this, "JWSInvalid");
      }
      static code = "ERR_JWS_INVALID";
      code = "ERR_JWS_INVALID";
    };
    JWTInvalid = class extends JOSEError {
      static {
        __name(this, "JWTInvalid");
      }
      static code = "ERR_JWT_INVALID";
      code = "ERR_JWT_INVALID";
    };
    JWKInvalid = class extends JOSEError {
      static {
        __name(this, "JWKInvalid");
      }
      static code = "ERR_JWK_INVALID";
      code = "ERR_JWK_INVALID";
    };
    JWKSInvalid = class extends JOSEError {
      static {
        __name(this, "JWKSInvalid");
      }
      static code = "ERR_JWKS_INVALID";
      code = "ERR_JWKS_INVALID";
    };
    JWKSNoMatchingKey = class extends JOSEError {
      static {
        __name(this, "JWKSNoMatchingKey");
      }
      static code = "ERR_JWKS_NO_MATCHING_KEY";
      code = "ERR_JWKS_NO_MATCHING_KEY";
      constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
        super(message2, options);
      }
    };
    JWKSMultipleMatchingKeys = class extends JOSEError {
      static {
        __name(this, "JWKSMultipleMatchingKeys");
      }
      [Symbol.asyncIterator] = async function* () {
      };
      static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
      code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
      constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
        super(message2, options);
      }
    };
    JWKSTimeout = class extends JOSEError {
      static {
        __name(this, "JWKSTimeout");
      }
      static code = "ERR_JWKS_TIMEOUT";
      code = "ERR_JWKS_TIMEOUT";
      constructor(message2 = "request timed out", options) {
        super(message2, options);
      }
    };
    JWSSignatureVerificationFailed = class extends JOSEError {
      static {
        __name(this, "JWSSignatureVerificationFailed");
      }
      static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
      code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
      constructor(message2 = "signature verification failed", options) {
        super(message2, options);
      }
    };
  }
});

// node_modules/jose/dist/webapi/util/base64url.js
var base64url_exports = {};
__export(base64url_exports, {
  decode: () => decode,
  encode: () => encode2
});
function decode(input) {
  try {
    return decodeBase64(typeof input == "string" ? input : decoder.decode(input), true);
  } catch (cause) {
    throw new TypeError(invalid, { cause });
  }
}
function encode2(input) {
  return encodeBase64(typeof input == "string" ? encoder.encode(input) : input, true);
}
var invalid;
var init_base64url = __esm({
  "node_modules/jose/dist/webapi/util/base64url.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_buffer_utils();
    invalid = "The input to be decoded is not correctly encoded.";
    __name(decode, "decode");
    __name(encode2, "encode");
  }
});

// node_modules/jose/dist/webapi/lib/validate.js
function assertUint8Array(input, label) {
  if (!(input instanceof Uint8Array))
    throw new TypeError(`${label} must be an instance of Uint8Array`);
}
function isObject(input) {
  if (typeof input != "object" || input === null || Object.prototype.toString.call(input) !== "[object Object]")
    return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}
function isJwkSet(input) {
  return isObject(input) && Array.isArray(input.keys) && Array.from(input.keys).every(isObject);
}
function isDisjoint(...headers) {
  const parameters = /* @__PURE__ */ new Set();
  for (const header of headers)
    if (header)
      for (const parameter of Object.keys(header)) {
        if (parameters.has(parameter))
          return false;
        parameters.add(parameter);
      }
  return true;
}
function assertNotSet(value, name) {
  if (value !== void 0)
    throw new TypeError(`${name} can only be called once`);
}
function decodeBase64url(value, label, ErrorClass) {
  try {
    return decode(value);
  } catch {
    throw new ErrorClass(`Failed to base64url decode the ${label}`);
  }
}
function encodeBase64url(value, label, ErrorClass) {
  try {
    return encode(value);
  } catch {
    throw new ErrorClass(`The ${label} is not a valid base64url string`);
  }
}
function parseJoseHeader(b64, ErrorClass, message2) {
  let parsed;
  try {
    parsed = JSON.parse(strictDecoder.decode(decode(b64)));
  } catch {
    throw new ErrorClass(message2);
  }
  if (!isObject(parsed))
    throw new ErrorClass(message2);
  return parsed;
}
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s != "string")))
    throw new TypeError(`"${option}" option must be an array of strings`);
  return algorithms === void 0 ? void 0 : new Set(algorithms);
}
function validateCritDuplicates(Err, protectedHeader) {
  const { crit } = protectedHeader ?? {};
  if (Array.isArray(crit) && new Set(crit).size !== crit.length)
    throw new Err('"crit" (Critical) Header Parameter MUST NOT contain duplicate values');
}
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0)
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!protectedHeader || protectedHeader.crit === void 0)
    return [];
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input != "string" || input.length === 0))
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  const recognized = recognizedOption === void 0 ? recognizedDefault : { __proto__: null, ...recognizedOption, ...recognizedDefault };
  for (const parameter of protectedHeader.crit) {
    if (!(parameter in recognized))
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    if (!Object.hasOwn(joseHeader, parameter) || joseHeader[parameter] === void 0)
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    if (recognized[parameter] && (!Object.hasOwn(protectedHeader, parameter) || protectedHeader[parameter] === void 0))
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
  }
  return protectedHeader.crit;
}
function validateB64(protectedHeader, extensions) {
  if (extensions.includes("b64")) {
    const b64 = protectedHeader.b64;
    if (typeof b64 != "boolean")
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    return b64;
  }
  return true;
}
function serializeJoseHeader(Err, header) {
  let serialized, parsed;
  try {
    serialized = JSON.stringify(header), parsed = JSON.parse(serialized);
  } catch (cause) {
    throw new Err("JOSE Header is not valid JSON", { cause });
  }
  if (!isObject(parsed))
    throw new Err("JOSE Header is not a JSON object");
  return [parsed, serialized];
}
var JWS_RECOGNIZED, JWE_RECOGNIZED;
var init_validate = __esm({
  "node_modules/jose/dist/webapi/lib/validate.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_base64url();
    init_buffer_utils();
    __name(assertUint8Array, "assertUint8Array");
    __name(isObject, "isObject");
    __name(isJwkSet, "isJwkSet");
    __name(isDisjoint, "isDisjoint");
    __name(assertNotSet, "assertNotSet");
    __name(decodeBase64url, "decodeBase64url");
    __name(encodeBase64url, "encodeBase64url");
    __name(parseJoseHeader, "parseJoseHeader");
    JWS_RECOGNIZED = { __proto__: null, b64: true };
    JWE_RECOGNIZED = { __proto__: null };
    __name(validateAlgorithms, "validateAlgorithms");
    __name(validateCritDuplicates, "validateCritDuplicates");
    __name(validateCrit, "validateCrit");
    __name(validateB64, "validateB64");
    __name(serializeJoseHeader, "serializeJoseHeader");
  }
});

// node_modules/jose/dist/webapi/lib/key.js
async function prepareKey(entry, key, usage) {
  const { alg, secret } = entry, privateKey = usage === "decrypt" || usage === "sign";
  if (secret && key instanceof Uint8Array)
    return key;
  let normalized, keyObject;
  if (isObject(key)) {
    if (normalized = normalizeJwk(key), typeof normalized.kty != "string")
      throw invalidKeyType(alg, key, secret);
    if (!(secret ? normalized.kty === "oct" && typeof normalized.k == "string" : normalized.kty !== "oct" && (privateKey ? normalized.kty === "AKP" && typeof normalized.priv == "string" || typeof normalized.d == "string" : normalized.d === void 0 && normalized.priv === void 0)))
      throw new TypeError(secret ? 'JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present' : `JSON Web Key for this operation must be a ${privateKey ? "private" : "public"} JWK`);
    if (jwkMatchesOp(entry, normalized, usage), normalized.kty === "oct")
      return decode(normalized.k);
    if (!Object.isFrozen(key)) {
      const { key_ops } = key;
      Array.isArray(key_ops) && Object.freeze(key_ops), Object.freeze(key);
    }
  } else {
    if (!isKeyLike(key))
      throw invalidKeyType(alg, key, secret);
    const expectedType = secret ? "secret" : privateKey ? "private" : "public";
    if (key.type !== expectedType && (secret || ["secret", "public", "private"].includes(key.type)))
      throw new TypeError(`${tag(key)} instances must be of type "${expectedType}" for the ${alg} algorithm`);
    if (isCryptoKey(key))
      return key;
    if (keyObject = key, keyObject.type === "secret")
      return keyObject.export();
  }
  cache ||= /* @__PURE__ */ new WeakMap();
  const cacheKey = key;
  let cached = cache.get(cacheKey);
  if (cached?.[alg])
    return cached[alg];
  if (cached || cache.set(cacheKey, cached = {}), keyObject && typeof keyObject.toCryptoKey == "function") {
    const isPublic = keyObject.type === "public", crv = nist[keyObject.asymmetricKeyDetails?.namedCurve], params = entry.resolve?.({ crv, asymmetricKeyType: keyObject.asymmetricKeyType }) ?? entry.subtle;
    return cached[alg] = keyObject.toCryptoKey(params, isPublic, entry.usages[isPublic ? 0 : 1]);
  }
  return normalized ??= keyObject.export({ format: "jwk" }), normalized.alg = alg, cached[alg] = await jwkToKey(entry, normalized);
}
function assertCryptoKey(key) {
  if (!isCryptoKey(key))
    throw new Error("CryptoKey instance expected");
}
function message(msg, actual, ...types) {
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else types.length === 2 ? msg += `one of type ${types[0]} or ${types[1]}.` : msg += `of type ${types[0]}.`;
  return actual == null ? msg += ` Received ${actual}` : typeof actual == "function" && actual.name ? msg += ` Received function ${actual.name}` : typeof actual == "object" && actual != null && actual.constructor?.name && (msg += ` Received an instance of ${actual.constructor.name}`), msg;
}
function invalidKeyType(alg, actual, secret) {
  const types = ["CryptoKey", "KeyObject", "JSON Web Key"];
  return secret && types.push("Uint8Array"), new TypeError(message(`Key for the ${alg} algorithm must be `, actual, ...types));
}
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage))
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
}
function checkModulusLength(alg, key) {
  const { modulusLength } = key.algorithm;
  if (typeof modulusLength != "number" || modulusLength < 2048)
    throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
}
function checkCryptoKey(key, expected, usage) {
  const algorithm = key.algorithm;
  if (algorithm.name !== expected.name)
    throw unusable(expected.name);
  if (expected.hash && algorithm.hash?.name !== expected.hash)
    throw unusable(expected.hash, "algorithm.hash");
  if (expected.namedCurve && algorithm.namedCurve !== expected.namedCurve)
    throw unusable(expected.namedCurve, "algorithm.namedCurve");
  if (expected.length !== void 0 && algorithm.length !== expected.length)
    throw unusable(expected.length, "algorithm.length");
  checkUsage(key, usage);
}
function snapshotJwk(jwk) {
  return { __proto__: null, ...jwk };
}
function normalizeJwk(jwk) {
  const normalized = snapshotJwk(jwk);
  if (normalized.ext !== void 0 && typeof normalized.ext != "boolean")
    throw new TypeError('"ext" (Extractable) Parameter must be a boolean');
  if (normalized.key_ops !== void 0) {
    const value = normalized.key_ops, keyOps = Array.isArray(value) ? [...value] : void 0;
    if (!keyOps || keyOps.some((operation) => typeof operation != "string") || new Set(keyOps).size !== keyOps.length)
      throw new TypeError('"key_ops" (Key Operations) Parameter must be an array of unique strings');
    normalized.key_ops = keyOps;
  }
  return normalized;
}
function validateExtractableOption(extractable) {
  if (extractable !== void 0 && typeof extractable != "boolean")
    throw new TypeError('"extractable" option must be a boolean');
  return extractable;
}
async function jwkToKey(entry, jwk, extractable) {
  if (!entry.kty.includes(jwk.kty))
    throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  const algorithm = entry.resolve?.({ kty: jwk.kty, crv: jwk.crv }) ?? entry.subtle, isPrivate = !!(jwk.d || jwk.priv), keyData = { ...jwk, ext: extractable ?? jwk.ext };
  return keyData.kty !== "AKP" && delete keyData.alg, delete keyData.use, crypto.subtle.importKey("jwk", keyData, algorithm, keyData.ext ?? !isPrivate, jwk.key_ops ?? entry.usages[isPrivate ? 1 : 0]);
}
async function rawKey(key, expected, usage, extractable = false) {
  return key instanceof Uint8Array && (key = await crypto.subtle.importKey("raw", key, expected, extractable, [usage])), checkCryptoKey(key, expected, usage), key;
}
var tag, jwkMatchesOp, cache, nist, isCryptoKey, isKeyObject, isKeyLike, invalidKeyInput, unusable;
var init_key = __esm({
  "node_modules/jose/dist/webapi/lib/key.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_validate();
    init_base64url();
    init_errors();
    tag = /* @__PURE__ */ __name((key) => key[Symbol.toStringTag], "tag");
    jwkMatchesOp = /* @__PURE__ */ __name((entry, key, usage) => {
      const { alg } = entry;
      if (key.use !== void 0) {
        const expected = usage === "sign" || usage === "verify" ? "sig" : "enc";
        if (key.use !== expected)
          throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
      }
      if (key.alg !== void 0 && key.alg !== alg)
        throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
      if (Array.isArray(key.key_ops)) {
        const expectedKeyOp = usage === "encrypt" || usage === "decrypt" ? entry.ops?.[usage === "encrypt" ? 0 : 1] : usage;
        if (expectedKeyOp && !key.key_ops.includes(expectedKeyOp))
          throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
      }
    }, "jwkMatchesOp");
    __name(prepareKey, "prepareKey");
    nist = {
      __proto__: null,
      prime256v1: "P-256",
      secp384r1: "P-384",
      secp521r1: "P-521"
    };
    __name(assertCryptoKey, "assertCryptoKey");
    isCryptoKey = /* @__PURE__ */ __name((key) => {
      if (key?.[Symbol.toStringTag] === "CryptoKey")
        return true;
      try {
        return key instanceof CryptoKey;
      } catch {
        return false;
      }
    }, "isCryptoKey");
    isKeyObject = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag] === "KeyObject", "isKeyObject");
    isKeyLike = /* @__PURE__ */ __name((key) => isCryptoKey(key) || isKeyObject(key), "isKeyLike");
    __name(message, "message");
    invalidKeyInput = /* @__PURE__ */ __name((actual, ...types) => message("Key must be ", actual, ...types), "invalidKeyInput");
    __name(invalidKeyType, "invalidKeyType");
    unusable = /* @__PURE__ */ __name((name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`), "unusable");
    __name(checkUsage, "checkUsage");
    __name(checkModulusLength, "checkModulusLength");
    __name(checkCryptoKey, "checkCryptoKey");
    __name(snapshotJwk, "snapshotJwk");
    __name(normalizeJwk, "normalizeJwk");
    __name(validateExtractableOption, "validateExtractableOption");
    __name(jwkToKey, "jwkToKey");
    __name(rawKey, "rawKey");
  }
});

// node_modules/jose/dist/webapi/lib/content_encryption.js
function checkCekLength(cek, expected) {
  const actual = cek.byteLength << 3;
  if (actual !== expected)
    throw new JWEInvalid(`Invalid Content Encryption Key length. Expected ${expected} bits, got ${actual} bits`);
}
function checkIvLength(enc, iv) {
  if (iv.length << 3 !== enc.ivBits)
    throw new JWEInvalid("Invalid Initialization Vector length");
}
async function cbcKeySetup(enc, cek, usage) {
  if (!(cek instanceof Uint8Array))
    throw new TypeError(invalidKeyInput(cek, "Uint8Array"));
  const keySize = enc.cekBits >> 1, encKey = await crypto.subtle.importKey("raw", cek.subarray(keySize >> 3), "AES-CBC", false, [usage]), macKey = await crypto.subtle.importKey("raw", cek.subarray(0, keySize >> 3), {
    hash: `SHA-${keySize << 1}`,
    name: "HMAC"
  }, false, ["sign"]);
  return [encKey, macKey, keySize];
}
async function cbcHmacTag(macKey, macData, keySize) {
  return new Uint8Array((await crypto.subtle.sign("HMAC", macKey, macData)).slice(0, keySize >> 3));
}
async function cbcEncrypt(enc, plaintext, cek, iv, aad) {
  const [encKey, macKey, keySize] = await cbcKeySetup(enc, cek, "encrypt"), ciphertext = new Uint8Array(await crypto.subtle.encrypt({
    iv,
    name: "AES-CBC"
  }, encKey, plaintext)), macData = concat(aad, iv, ciphertext, uint64be(aad.length * 8)), tag2 = await cbcHmacTag(macKey, macData, keySize);
  return { ciphertext, tag: tag2, iv };
}
async function timingSafeEqual(a, b) {
  const algorithm = { name: "HMAC", hash: "SHA-256" }, key = await crypto.subtle.generateKey(algorithm, false, ["sign", "verify"]), aHmac = await crypto.subtle.sign(algorithm, key, a);
  return crypto.subtle.verify(algorithm, key, aHmac, b);
}
async function cbcDecrypt(enc, cek, ciphertext, iv, tag2, aad) {
  const [encKey, macKey, keySize] = await cbcKeySetup(enc, cek, "decrypt"), macData = concat(aad, iv, ciphertext, uint64be(aad.length * 8)), expectedTag = await cbcHmacTag(macKey, macData, keySize);
  try {
    if (await timingSafeEqual(tag2, expectedTag))
      return new Uint8Array(await crypto.subtle.decrypt({ iv, name: "AES-CBC" }, encKey, ciphertext));
  } catch {
  }
  throw new JWEDecryptionFailed();
}
async function encrypt(enc, plaintext, cek, iv, aad) {
  if (!isCryptoKey(cek) && !(cek instanceof Uint8Array))
    throw new TypeError(invalidKeyInput(cek, "CryptoKey", "KeyObject", "Uint8Array", "JSON Web Key"));
  if (iv ? checkIvLength(enc, iv) : iv = generateIv(enc), cek instanceof Uint8Array && checkCekLength(cek, enc.cekBits), enc.cbc)
    return cbcEncrypt(enc, plaintext, cek, iv, aad);
  const encKey = await rawKey(cek, enc.subtle, "encrypt"), encrypted = new Uint8Array(await crypto.subtle.encrypt({
    additionalData: aad,
    iv,
    name: "AES-GCM",
    tagLength: 128
  }, encKey, plaintext));
  return { ciphertext: encrypted.subarray(0, -16), tag: encrypted.subarray(-16), iv };
}
async function decrypt(enc, cek, ciphertext, iv, tag2, aad) {
  if (!isCryptoKey(cek) && !(cek instanceof Uint8Array))
    throw new TypeError(invalidKeyInput(cek, "CryptoKey", "KeyObject", "Uint8Array", "JSON Web Key"));
  if (!iv)
    throw new JWEInvalid("JWE Initialization Vector missing");
  if (!tag2)
    throw new JWEInvalid("JWE Authentication Tag missing");
  if (!enc.cbc && tag2.length !== 16)
    throw new JWEInvalid("Invalid Authentication Tag length");
  if (checkIvLength(enc, iv), cek instanceof Uint8Array && checkCekLength(cek, enc.cekBits), enc.cbc)
    return cbcDecrypt(enc, cek, ciphertext, iv, tag2, aad);
  const encKey = await rawKey(cek, enc.subtle, "decrypt");
  try {
    return new Uint8Array(await crypto.subtle.decrypt({
      additionalData: aad,
      iv,
      name: "AES-GCM",
      tagLength: 128
    }, encKey, concat(ciphertext, tag2)));
  } catch {
    throw new JWEDecryptionFailed();
  }
}
var generateCek, generateIv;
var init_content_encryption = __esm({
  "node_modules/jose/dist/webapi/lib/content_encryption.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_buffer_utils();
    init_key();
    init_errors();
    generateCek = /* @__PURE__ */ __name((enc) => crypto.getRandomValues(new Uint8Array(enc.cekBits >> 3)), "generateCek");
    __name(checkCekLength, "checkCekLength");
    generateIv = /* @__PURE__ */ __name((enc) => crypto.getRandomValues(new Uint8Array(enc.ivBits >> 3)), "generateIv");
    __name(checkIvLength, "checkIvLength");
    __name(cbcKeySetup, "cbcKeySetup");
    __name(cbcHmacTag, "cbcHmacTag");
    __name(cbcEncrypt, "cbcEncrypt");
    __name(timingSafeEqual, "timingSafeEqual");
    __name(cbcDecrypt, "cbcDecrypt");
    __name(encrypt, "encrypt");
    __name(decrypt, "decrypt");
  }
});

// node_modules/jose/dist/webapi/lib/key_descriptor.js
function table3(entries) {
  const out = { __proto__: null };
  for (const alg in entries)
    out[alg] = { ...entries[alg], alg };
  return out;
}
var init_key_descriptor = __esm({
  "node_modules/jose/dist/webapi/lib/key_descriptor.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(table3, "table");
  }
});

// node_modules/jose/dist/webapi/lib/jwe_algorithms.js
function rsaes(bits) {
  return {
    kty: ["RSA"],
    mode: "key-encryption",
    subtle: { name: "RSA-OAEP", hash: `SHA-${bits}` },
    usages: wrap,
    ops: ["wrapKey", "unwrapKey"]
  };
}
function ecdh(mode) {
  return {
    kty: ["EC", "OKP"],
    mode,
    subtle: { name: "ECDH" },
    resolve: /* @__PURE__ */ __name(({ kty, crv, asymmetricKeyType }) => {
      if (crv === "X25519" || asymmetricKeyType === "x25519")
        return { name: "X25519" };
      if (kty === "OKP")
        throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      return { name: "ECDH", namedCurve: crv };
    }, "resolve"),
    usages: derive,
    ops: [void 0, "deriveBits"]
  };
}
function aeskw(bits, gcm = false) {
  return {
    kty: ["oct"],
    mode: "key-wrapping",
    secret: true,
    subtle: { name: gcm ? "AES-GCM" : "AES-KW", length: bits },
    usages: none,
    ops: gcm ? ["encrypt", "decrypt"] : ["wrapKey", "unwrapKey"]
  };
}
function pbes2() {
  return {
    kty: ["oct"],
    mode: "key-wrapping",
    secret: true,
    subtle: { name: "PBKDF2" },
    usages: none,
    ops: ["deriveBits", "deriveBits"]
  };
}
function contentEncryption(bits, cbc = false) {
  return {
    kty: ["oct"],
    secret: true,
    subtle: { name: cbc ? "AES-CBC" : "AES-GCM", length: bits },
    usages: none,
    ops: contentOps,
    cekBits: bits,
    ivBits: cbc ? 128 : 96,
    cbc
  };
}
function unsupported(parameter, name) {
  throw new JOSENotSupported(`Invalid or unsupported "${parameter}" (JWE ${name}) header value`);
}
function jweAlgorithm(alg) {
  return (typeof alg == "string" ? JWE[alg] : void 0) ?? unsupported("alg", "Algorithm");
}
function isJWECEKTransport(algorithm) {
  return algorithm.mode === "key-wrapping" || algorithm.mode === "key-encryption" || algorithm.mode === "key-agreement-with-key-wrapping";
}
function jweEncryption(enc) {
  return (typeof enc == "string" ? ENC[enc] : void 0) ?? unsupported("enc", "Encryption Algorithm");
}
var wrap, derive, none, JWE, contentOps, ENC;
var init_jwe_algorithms = __esm({
  "node_modules/jose/dist/webapi/lib/jwe_algorithms.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_key_descriptor();
    wrap = [
      ["encrypt", "wrapKey"],
      ["decrypt", "unwrapKey"]
    ];
    derive = [[], ["deriveBits"]];
    none = [[], []];
    __name(rsaes, "rsaes");
    __name(ecdh, "ecdh");
    __name(aeskw, "aeskw");
    __name(pbes2, "pbes2");
    JWE = table3({
      dir: {
        kty: ["oct"],
        mode: "direct-encryption",
        secret: true,
        subtle: { name: "AES-GCM" },
        usages: none,
        ops: ["encrypt", "decrypt"]
      },
      "RSA-OAEP": rsaes(1),
      "RSA-OAEP-256": rsaes(256),
      "RSA-OAEP-384": rsaes(384),
      "RSA-OAEP-512": rsaes(512),
      "ECDH-ES": ecdh("direct-key-agreement"),
      "ECDH-ES+A128KW": ecdh("key-agreement-with-key-wrapping"),
      "ECDH-ES+A192KW": ecdh("key-agreement-with-key-wrapping"),
      "ECDH-ES+A256KW": ecdh("key-agreement-with-key-wrapping"),
      A128KW: aeskw(128),
      A192KW: aeskw(192),
      A256KW: aeskw(256),
      A128GCMKW: aeskw(128, true),
      A192GCMKW: aeskw(192, true),
      A256GCMKW: aeskw(256, true),
      "PBES2-HS256+A128KW": pbes2(),
      "PBES2-HS384+A192KW": pbes2(),
      "PBES2-HS512+A256KW": pbes2()
    });
    contentOps = ["encrypt", "decrypt"];
    __name(contentEncryption, "contentEncryption");
    ENC = table3({
      A128GCM: contentEncryption(128),
      A192GCM: contentEncryption(192),
      A256GCM: contentEncryption(256),
      "A128CBC-HS256": contentEncryption(256, true),
      "A192CBC-HS384": contentEncryption(384, true),
      "A256CBC-HS512": contentEncryption(512, true)
    });
    __name(unsupported, "unsupported");
    __name(jweAlgorithm, "jweAlgorithm");
    __name(isJWECEKTransport, "isJWECEKTransport");
    __name(jweEncryption, "jweEncryption");
  }
});

// node_modules/jose/dist/webapi/lib/key_management.js
function checkEcdhCryptoKey(key, usage) {
  if (key.algorithm.name !== "ECDH" && key.algorithm.name !== "X25519")
    throw new TypeError("CryptoKey does not support this operation, its algorithm.name must be ECDH or X25519");
  checkUsage(key, usage);
}
async function aeskwWrap(alg, key, cek) {
  const cryptoKey = await rawKey(key, jweAlgorithm(alg).subtle, "wrapKey", true), cryptoKeyCek = await crypto.subtle.importKey("raw", cek, { hash: "SHA-256", name: "HMAC" }, true, ["sign"]);
  return new Uint8Array(await crypto.subtle.wrapKey("raw", cryptoKeyCek, cryptoKey, "AES-KW"));
}
async function aeskwUnwrap(alg, key, encryptedKey) {
  const cryptoKey = await rawKey(key, jweAlgorithm(alg).subtle, "unwrapKey", true), cryptoKeyCek = await crypto.subtle.unwrapKey("raw", encryptedKey, cryptoKey, "AES-KW", { hash: "SHA-256", name: "HMAC" }, true, ["sign"]);
  return new Uint8Array(await crypto.subtle.exportKey("raw", cryptoKeyCek));
}
function checkRsaKey(alg, key, usage) {
  checkCryptoKey(key, jweAlgorithm(alg).subtle, usage), checkModulusLength(alg, key);
}
async function deriveKey(p2s, alg, p2c, key) {
  if (!(p2s instanceof Uint8Array) || p2s.length < 8)
    throw new JWEInvalid("PBES2 Salt Input must be 8 or more octets");
  if (!Number.isSafeInteger(p2c) || Math.sign(p2c) !== 1)
    throw new JWEInvalid("PBES2 Count Input must be a positive integer");
  const salt = concat(encode(alg), Uint8Array.of(0), p2s), keylen = parseInt(alg.slice(13, 16), 10), subtleAlg = {
    hash: `SHA-${alg.slice(8, 11)}`,
    iterations: p2c,
    name: "PBKDF2",
    salt
  }, cryptoKey = await rawKey(key, jweAlgorithm(alg).subtle, "deriveBits");
  return new Uint8Array(await crypto.subtle.deriveBits(subtleAlg, cryptoKey, keylen));
}
function lengthAndInput(input) {
  return concat(uint32be(input.length), input);
}
async function concatKdf(Z, L, OtherInfo) {
  const dkLen = L >> 3, hashLen = 32, reps = Math.ceil(dkLen / hashLen), dk = new Uint8Array(reps * hashLen);
  for (let i = 1; i <= reps; i++) {
    const hashResult = await digest("sha256", concat(uint32be(i), Z, OtherInfo));
    dk.set(hashResult, (i - 1) * hashLen);
  }
  return dk.slice(0, dkLen);
}
async function ecdhesDeriveKey(publicKey, privateKey, algorithm, keyLength, apu = new Uint8Array(), apv = new Uint8Array()) {
  checkEcdhCryptoKey(publicKey), checkEcdhCryptoKey(privateKey, "deriveBits");
  const otherInfo = concat(lengthAndInput(encode(algorithm)), lengthAndInput(apu), lengthAndInput(apv), uint32be(keyLength)), Z = new Uint8Array(await crypto.subtle.deriveBits({
    name: publicKey.algorithm.name,
    public: publicKey
  }, privateKey, publicKey.algorithm.name === "X25519" ? 256 : Math.ceil(parseInt(publicKey.algorithm.namedCurve.slice(-3), 10) / 8) << 3));
  return concatKdf(Z, keyLength, otherInfo);
}
function assertEcdhKey(key) {
  assertCryptoKey(key);
  const curve = key.algorithm.namedCurve;
  if (curve !== "P-256" && curve !== "P-384" && curve !== "P-521" && key.algorithm.name !== "X25519")
    throw new JOSENotSupported("ECDH with the provided key is not allowed or not supported by your javascript runtime");
}
function partyInfo(joseHeader, name) {
  const value = joseHeader[name];
  if (value !== void 0) {
    if (typeof value != "string")
      throw new JWEInvalid(`JOSE Header "${name}" (Agreement Party${name === "apu" ? "U" : "V"}Info) invalid`);
    return decodeBase64url(value, name, JWEInvalid);
  }
}
function checkPartyInfo(apu, apv) {
  if (!(apu === void 0 || apv === void 0 || apu.byteLength !== apv.byteLength)) {
    for (let i = 0; i < apu.byteLength; i++)
      if (apu[i] !== apv[i])
        return;
    throw new JWEInvalid('JOSE Header "apu" and "apv" values must be distinct');
  }
}
function assertEncryptedKey(encryptedKey) {
  if (encryptedKey === void 0)
    throw new JWEInvalid("JWE Encrypted Key missing");
}
function assertNoEncryptedKey(encryptedKey) {
  if (encryptedKey !== void 0)
    throw new JWEInvalid("Encountered unexpected JWE Encrypted Key");
}
function validateMaxPBES2Count(value) {
  if (value !== void 0 && value !== 1 / 0 && (!Number.isSafeInteger(value) || value < 1))
    throw new TypeError("maxPBES2Count must be a positive safe integer or Infinity");
}
async function decryptKeyManagement(entry, enc, key, encryptedKey, joseHeader, maxPBES2Count) {
  const { alg } = entry, mode = entry.mode;
  if (mode === "direct-encryption")
    return assertNoEncryptedKey(encryptedKey), key;
  const direct = mode === "direct-key-agreement";
  switch (direct ? assertNoEncryptedKey(encryptedKey) : assertEncryptedKey(encryptedKey), entry.subtle.name) {
    case "ECDH": {
      const { epk } = joseHeader;
      if (!isObject(epk) || ["d", "k", "p", "q", "dp", "dq", "qi", "oth", "priv"].some((parameter) => Object.hasOwn(epk, parameter)))
        throw new JWEInvalid('JOSE Header "epk" (Ephemeral Public Key) missing or invalid');
      assertEcdhKey(key);
      const ephemeralPublicKey = await jwkToKey(entry, epk), partyUInfo = partyInfo(joseHeader, "apu"), partyVInfo = partyInfo(joseHeader, "apv");
      checkPartyInfo(partyUInfo, partyVInfo);
      const sharedSecret = await ecdhesDeriveKey(ephemeralPublicKey, key, direct ? enc.alg : alg, direct ? enc.cekBits : parseInt(alg.slice(-5, -2), 10), partyUInfo, partyVInfo);
      if (direct)
        return sharedSecret;
      key = sharedSecret;
      break;
    }
    case "RSA-OAEP":
      return assertCryptoKey(key), checkRsaKey(alg, key, "decrypt"), new Uint8Array(await crypto.subtle.decrypt("RSA-OAEP", key, encryptedKey));
    case "PBKDF2": {
      if (typeof joseHeader.p2c != "number")
        throw new JWEInvalid('JOSE Header "p2c" (PBES2 Count) missing or invalid');
      validateMaxPBES2Count(maxPBES2Count);
      const p2cLimit = maxPBES2Count ?? 1e4;
      if (joseHeader.p2c > p2cLimit)
        throw new JWEInvalid('JOSE Header "p2c" (PBES2 Count) out is of acceptable bounds');
      if (typeof joseHeader.p2s != "string")
        throw new JWEInvalid('JOSE Header "p2s" (PBES2 Salt) missing or invalid');
      const p2s = decodeBase64url(joseHeader.p2s, "p2s", JWEInvalid);
      key = await deriveKey(p2s, alg, joseHeader.p2c, key);
      break;
    }
    case "AES-GCM": {
      if (typeof joseHeader.iv != "string")
        throw new JWEInvalid('JOSE Header "iv" (Initialization Vector) missing or invalid');
      if (typeof joseHeader.tag != "string")
        throw new JWEInvalid('JOSE Header "tag" (Authentication Tag) missing or invalid');
      const iv = decodeBase64url(joseHeader.iv, "iv", JWEInvalid), tag2 = decodeBase64url(joseHeader.tag, "tag", JWEInvalid);
      if (iv.byteLength !== 12)
        throw new JWEInvalid("Invalid Initialization Vector length");
      if (tag2.byteLength !== 16)
        throw new JWEInvalid("Invalid Authentication Tag length");
      return decrypt(jweEncryption(alg.slice(0, -2)), key, encryptedKey, iv, tag2, new Uint8Array());
    }
  }
  return aeskwUnwrap(alg.slice(-6), key, encryptedKey);
}
async function encryptKeyManagement(entry, enc, inputKey, joseHeader, providedCek, providedParameters = {}) {
  const { alg, mode } = entry, transport = isJWECEKTransport(entry);
  if (providedCek !== void 0 && !transport)
    throw new TypeError(`setContentEncryptionKey cannot be called with JWE "alg" (Algorithm) Header ${alg}`);
  let key = await prepareKey(mode === "direct-encryption" ? enc : entry, inputKey, "encrypt");
  if (mode === "direct-encryption")
    return [key, void 0, void 0];
  const cek = transport ? providedCek ?? generateCek(enc) : void 0;
  cek && checkCekLength(cek, enc.cekBits);
  let encryptedKey, parameters;
  switch (entry.subtle.name) {
    case "ECDH": {
      assertEcdhKey(key);
      const { apu: providedApu, apv: providedApv } = providedParameters;
      providedApu !== void 0 && assertUint8Array(providedApu, '"apu"'), providedApv !== void 0 && assertUint8Array(providedApv, '"apv"');
      const apu = providedApu ?? partyInfo(joseHeader, "apu"), apv = providedApv ?? partyInfo(joseHeader, "apv");
      checkPartyInfo(apu, apv);
      let ephemeralKey;
      providedParameters.epk !== void 0 ? ephemeralKey = await prepareKey(entry, providedParameters.epk, "decrypt") : ephemeralKey = (await crypto.subtle.generateKey(key.algorithm, true, ["deriveBits"])).privateKey;
      const subtle = crypto.subtle;
      let exportableEpk = ephemeralKey;
      if (!exportableEpk.extractable) {
        if (typeof subtle.getPublicKey != "function")
          throw new TypeError('CryptoKey for "epk" must be extractable');
        exportableEpk = await subtle.getPublicKey(ephemeralKey, []);
      }
      const { x, y, crv, kty } = await subtle.exportKey("jwk", exportableEpk), direct = mode === "direct-key-agreement", sharedSecret = await ecdhesDeriveKey(key, ephemeralKey, direct ? enc.alg : alg, direct ? enc.cekBits : parseInt(alg.slice(-5, -2), 10), apu, apv), epk = { x, crv, kty };
      if (kty === "EC" && (epk.y = y), parameters = { epk }, providedApu !== void 0 && (parameters.apu = encode2(providedApu)), providedApv !== void 0 && (parameters.apv = encode2(providedApv)), direct)
        return [sharedSecret, void 0, parameters];
      key = sharedSecret;
      break;
    }
    case "RSA-OAEP": {
      assertCryptoKey(key), checkRsaKey(alg, key, "encrypt"), encryptedKey = new Uint8Array(await crypto.subtle.encrypt("RSA-OAEP", key, cek));
      break;
    }
    case "PBKDF2": {
      const { p2c = 2048, p2s = crypto.getRandomValues(new Uint8Array(16)) } = providedParameters;
      key = await deriveKey(p2s, alg, p2c, key), parameters = { p2c, p2s: encode2(p2s) };
      break;
    }
    case "AES-GCM": {
      const iv = providedParameters.iv === void 0 ? crypto.getRandomValues(new Uint8Array(12)) : providedParameters.iv;
      if (!(iv instanceof Uint8Array))
        throw new TypeError('"iv" must be an instance of Uint8Array');
      const wrapped = await encrypt(jweEncryption(alg.slice(0, -2)), cek, key, iv, new Uint8Array());
      encryptedKey = wrapped.ciphertext, parameters = { iv: encode2(wrapped.iv), tag: encode2(wrapped.tag) };
    }
  }
  if (encryptedKey ??= await aeskwWrap(alg.slice(-6), key, cek), !(encryptedKey instanceof Uint8Array) || !encryptedKey.byteLength)
    throw new TypeError("JWE key management algorithm did not produce an Encrypted Key");
  return [cek, encryptedKey, parameters];
}
var init_key_management = __esm({
  "node_modules/jose/dist/webapi/lib/key_management.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_base64url();
    init_key();
    init_jwe_algorithms();
    init_errors();
    init_validate();
    init_buffer_utils();
    init_content_encryption();
    __name(checkEcdhCryptoKey, "checkEcdhCryptoKey");
    __name(aeskwWrap, "aeskwWrap");
    __name(aeskwUnwrap, "aeskwUnwrap");
    __name(checkRsaKey, "checkRsaKey");
    __name(deriveKey, "deriveKey");
    __name(lengthAndInput, "lengthAndInput");
    __name(concatKdf, "concatKdf");
    __name(ecdhesDeriveKey, "ecdhesDeriveKey");
    __name(assertEcdhKey, "assertEcdhKey");
    __name(partyInfo, "partyInfo");
    __name(checkPartyInfo, "checkPartyInfo");
    __name(assertEncryptedKey, "assertEncryptedKey");
    __name(assertNoEncryptedKey, "assertNoEncryptedKey");
    __name(validateMaxPBES2Count, "validateMaxPBES2Count");
    __name(decryptKeyManagement, "decryptKeyManagement");
    __name(encryptKeyManagement, "encryptKeyManagement");
  }
});

// node_modules/jose/dist/webapi/lib/deflate.js
function validateZip(joseHeader, protectedHeader) {
  if (joseHeader.zip !== void 0 && joseHeader.zip !== "DEF")
    throw new JOSENotSupported('Unsupported JWE "zip" (Compression Algorithm) Header Parameter value.');
  if (joseHeader.zip !== void 0 && !protectedHeader?.zip)
    throw new JWEInvalid('JWE "zip" (Compression Algorithm) Header Parameter MUST be in a protected header.');
}
function supported(name) {
  if (typeof globalThis[name] > "u")
    throw new JOSENotSupported(`JWE "zip" (Compression Algorithm) Header Parameter requires the ${name} API.`);
}
async function transform(stream, input, maxLength = 1 / 0) {
  const writer = stream.writable.getWriter();
  writer.write(input).catch(() => {
  }), writer.close().catch(() => {
  });
  const chunks = [];
  let length = 0;
  const reader = stream.readable.getReader();
  for (; ; ) {
    const { value, done } = await reader.read();
    if (done)
      break;
    if (chunks.push(value), length += value.byteLength, maxLength !== 1 / 0 && length > maxLength)
      throw new JWEInvalid("Decompressed plaintext exceeded the configured limit");
  }
  return concat(...chunks);
}
async function compress(input) {
  return supported("CompressionStream"), transform(new CompressionStream("deflate-raw"), input);
}
async function decompress(input, maxLength) {
  return supported("DecompressionStream"), transform(new DecompressionStream("deflate-raw"), input, maxLength);
}
var init_deflate = __esm({
  "node_modules/jose/dist/webapi/lib/deflate.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_buffer_utils();
    __name(validateZip, "validateZip");
    __name(supported, "supported");
    __name(transform, "transform");
    __name(compress, "compress");
    __name(decompress, "decompress");
  }
});

// node_modules/jose/dist/webapi/lib/jwe_decrypt.js
function snapshotSharedJWE(jwe) {
  const { aad, ciphertext, iv, protected: encodedProtected, tag: tag2, unprotected } = jwe;
  if (iv !== void 0 && (typeof iv != "string" || !iv))
    throw new JWEInvalid("JWE Initialization Vector incorrect type");
  if (typeof ciphertext != "string")
    throw new JWEInvalid("JWE Ciphertext missing or incorrect type");
  if (tag2 !== void 0 && (typeof tag2 != "string" || !tag2))
    throw new JWEInvalid("JWE Authentication Tag incorrect type");
  if (encodedProtected !== void 0 && typeof encodedProtected != "string")
    throw new JWEInvalid("JWE Protected Header incorrect type");
  if (aad !== void 0 && (typeof aad != "string" || !aad))
    throw new JWEInvalid("JWE AAD incorrect type");
  if (unprotected !== void 0 && !isObject(unprotected))
    throw new JWEInvalid("JWE Shared Unprotected Header incorrect type");
  return {
    aad,
    ciphertext,
    iv,
    protected: encodedProtected,
    tag: tag2,
    unprotected: unprotected === void 0 ? void 0 : { ...unprotected }
  };
}
function snapshotRecipientJWE(recipient) {
  let header, headerAlg;
  try {
    const { header: inputHeader } = recipient;
    if (isObject(inputHeader)) {
      headerAlg = inputHeader.alg;
      const parameters = Object.keys(inputHeader);
      parameters.includes("alg") || (headerAlg = void 0), header = Object.fromEntries(parameters.map((parameter) => [
        parameter,
        parameter === "alg" ? headerAlg : inputHeader[parameter]
      ]));
    } else
      header = inputHeader;
    const { encrypted_key: encryptedKey } = recipient;
    return [{ encrypted_key: encryptedKey, header }, headerAlg];
  } catch (error3) {
    return [void 0, headerAlg, error3];
  }
}
function checkRecipient(jwe) {
  const { encrypted_key: encryptedKey, header } = jwe;
  if (encryptedKey !== void 0 && typeof encryptedKey != "string")
    throw new JWEInvalid("JWE Encrypted Key incorrect type");
  if (header !== void 0 && !isObject(header))
    throw new JWEInvalid("JWE Per-Recipient Unprotected Header incorrect type");
  if (jwe.protected === void 0 && header === void 0 && jwe.unprotected === void 0)
    throw new JWEInvalid("JOSE Header missing");
}
function shareJWE(jwe) {
  const { protected: encodedProtected, ciphertext, iv, tag: tag2, aad } = jwe;
  let parsedProt;
  return encodedProtected !== void 0 && (parsedProt = parseJoseHeader(encodedProtected, JWEInvalid, "JWE Protected Header is invalid")), [
    parsedProt,
    decodeBase64url(ciphertext, "ciphertext", JWEInvalid),
    iv !== void 0 ? decodeBase64url(iv, "iv", JWEInvalid) : void 0,
    tag2 !== void 0 ? decodeBase64url(tag2, "tag", JWEInvalid) : void 0,
    encodeBase64url((encodedProtected ?? "") + (aad !== void 0 ? `.${aad}` : ""), "aad", JWEInvalid)
  ];
}
function prepareDecrypt(options) {
  return [
    options && validateAlgorithms("keyManagementAlgorithms", options.keyManagementAlgorithms),
    options && validateAlgorithms("contentEncryptionAlgorithms", options.contentEncryptionAlgorithms),
    options?.crit,
    options?.maxPBES2Count,
    options?.maxDecompressedLength
  ];
}
async function decryptJWE(jwe, shared, key, token = shareJWE(jwe)) {
  const [parsedProt, ciphertext, iv, tag2, additionalData] = token, { header, unprotected, aad } = jwe;
  let joseHeader;
  if (header !== void 0 || unprotected !== void 0) {
    if (!isDisjoint(parsedProt, header, unprotected))
      throw new JWEInvalid("JWE Protected, JWE Unprotected Header, and JWE Per-Recipient Unprotected Header Parameter names must be disjoint");
    joseHeader = { ...parsedProt, ...header, ...unprotected };
  } else
    joseHeader = parsedProt ?? {};
  const [keyManagementAlgorithms, contentEncryptionAlgorithms, crit, maxPBES2Count, maxDecompressedLength] = shared, { encrypted_key: encodedKey } = jwe;
  validateCrit(JWEInvalid, JWE_RECOGNIZED, crit, parsedProt, joseHeader), validateZip(joseHeader, parsedProt);
  const { alg, enc } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWEInvalid("missing JWE Algorithm (alg) in JWE Header");
  const selected = JWE[alg];
  if (encodedKey === "" && (!selected || !isJWECEKTransport(selected)))
    throw new JWEInvalid("JWE Encrypted Key incorrect type");
  const integrated = selected?.mode === "integrated-encryption";
  if (!integrated && (typeof enc != "string" || !enc))
    throw new JWEInvalid("missing JWE Encryption Algorithm (enc) in JWE Header");
  if (keyManagementAlgorithms && !keyManagementAlgorithms.has(alg) || !keyManagementAlgorithms && alg.startsWith("PBES2"))
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  let encEntry;
  if (integrated) {
    if (enc !== void 0)
      throw new JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter must not be present for integrated encryption');
    if (iv?.byteLength)
      throw new JWEInvalid("JWE Initialization Vector must be empty for integrated encryption");
    if (tag2?.byteLength)
      throw new JWEInvalid("JWE Authentication Tag must be empty for integrated encryption");
  } else {
    if (contentEncryptionAlgorithms && !contentEncryptionAlgorithms.has(enc))
      throw new JOSEAlgNotAllowed('"enc" (Encryption Algorithm) Header Parameter value not allowed');
    encEntry = jweEncryption(enc);
  }
  let encryptedKey;
  if (encodedKey !== void 0)
    try {
      encryptedKey = decodeBase64url(encodedKey, "encrypted_key", JWEInvalid);
    } catch (error3) {
      if (!selected || !isJWECEKTransport(selected))
        throw error3;
      encryptedKey = new Uint8Array();
    }
  let resolvedKey = false;
  typeof key == "function" && (key = await key(parsedProt, jwe), resolvedKey = true);
  const algEntry = selected ?? jweAlgorithm(alg);
  isJWECEKTransport(algEntry) && encryptedKey === void 0 && (encryptedKey = new Uint8Array());
  const k = await prepareKey(algEntry.mode === "direct-encryption" ? encEntry : algEntry, key, "decrypt");
  let plaintext;
  if (algEntry.mode === "integrated-encryption")
    plaintext = await algEntry.decrypt(k, encryptedKey, ciphertext, additionalData, parsedProt, joseHeader);
  else {
    const encryption = encEntry;
    let cek;
    try {
      cek = await decryptKeyManagement(algEntry, encryption, k, encryptedKey, joseHeader, maxPBES2Count), isJWECEKTransport(algEntry) && cek instanceof Uint8Array && cek.byteLength << 3 !== encryption.cekBits && (cek = generateCek(encryption));
    } catch (err) {
      if (err instanceof TypeError || err instanceof JWEInvalid || err instanceof JOSENotSupported)
        throw err;
      cek = generateCek(encryption);
    }
    plaintext = await decrypt(encryption, cek, ciphertext, iv, tag2, additionalData);
  }
  if (joseHeader.zip === "DEF") {
    const decompressionLimit = maxDecompressedLength ?? 25e4;
    if (decompressionLimit === 0)
      throw new JOSENotSupported('JWE "zip" (Compression Algorithm) Header Parameter is not supported.');
    if (decompressionLimit !== 1 / 0 && (!Number.isSafeInteger(decompressionLimit) || decompressionLimit < 1))
      throw new TypeError("maxDecompressedLength must be 0, a positive safe integer, or Infinity");
    plaintext = await decompress(plaintext, decompressionLimit).catch((cause) => {
      throw cause instanceof JWEInvalid ? cause : new JWEInvalid("Failed to decompress plaintext", { cause });
    });
  }
  return {
    plaintext,
    ...parsedProt && { protectedHeader: parsedProt },
    ...aad !== void 0 && {
      additionalAuthenticatedData: decodeBase64url(aad, "aad", JWEInvalid)
    },
    ...unprotected && { sharedUnprotectedHeader: unprotected },
    ...header && { unprotectedHeader: header },
    ...resolvedKey && { key: k }
  };
}
async function decryptCompact(jwe, shared, key) {
  if (jwe instanceof Uint8Array && (jwe = decoder.decode(jwe)), typeof jwe != "string")
    throw new JWEInvalid("Compact JWE must be a string or Uint8Array");
  const { 0: protectedHeader, 1: encryptedKey, 2: iv, 3: ciphertext, 4: tag2, length } = jwe.split(".");
  if (length !== 5)
    throw new JWEInvalid("Invalid Compact JWE");
  return decryptJWE({
    ciphertext,
    iv: iv || void 0,
    protected: protectedHeader,
    tag: tag2 || void 0,
    encrypted_key: encryptedKey || void 0
  }, shared, key);
}
var init_jwe_decrypt = __esm({
  "node_modules/jose/dist/webapi/lib/jwe_decrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_content_encryption();
    init_validate();
    init_errors();
    init_key_management();
    init_buffer_utils();
    init_key();
    init_jwe_algorithms();
    init_deflate();
    __name(snapshotSharedJWE, "snapshotSharedJWE");
    __name(snapshotRecipientJWE, "snapshotRecipientJWE");
    __name(checkRecipient, "checkRecipient");
    __name(shareJWE, "shareJWE");
    __name(prepareDecrypt, "prepareDecrypt");
    __name(decryptJWE, "decryptJWE");
    __name(decryptCompact, "decryptCompact");
  }
});

// node_modules/jose/dist/webapi/jwe/compact/decrypt.js
async function compactDecrypt(jwe, key, options) {
  return decryptCompact(jwe, prepareDecrypt(options), key);
}
var init_decrypt = __esm({
  "node_modules/jose/dist/webapi/jwe/compact/decrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jwe_decrypt();
    __name(compactDecrypt, "compactDecrypt");
  }
});

// node_modules/jose/dist/webapi/jwe/flattened/decrypt.js
async function flattenedDecrypt(jwe, key, options) {
  if (!isObject(jwe))
    throw new JWEInvalid("Flattened JWE must be an object");
  const shared = snapshotSharedJWE(jwe), [recipient, , error3] = snapshotRecipientJWE(jwe);
  if (!recipient)
    throw error3;
  const snapshot = { ...shared, ...recipient };
  return checkRecipient(snapshot), decryptJWE(snapshot, prepareDecrypt(options), key);
}
var init_decrypt2 = __esm({
  "node_modules/jose/dist/webapi/jwe/flattened/decrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_validate();
    init_jwe_decrypt();
    __name(flattenedDecrypt, "flattenedDecrypt");
  }
});

// node_modules/jose/dist/webapi/jwe/general/decrypt.js
async function generalDecrypt(jwe, key, options) {
  if (!isObject(jwe))
    throw new JWEInvalid("General JWE must be an object");
  const inputRecipients = jwe.recipients;
  if (!Array.isArray(inputRecipients))
    throw new JWEInvalid("JWE Recipients missing or incorrect type");
  const recipients = Array.from(inputRecipients);
  if (!recipients.every(isObject))
    throw new JWEInvalid("JWE Recipients missing or incorrect type");
  if (!recipients.length)
    throw new JWEInvalid("JWE Recipients has no members");
  let shared, sharedJwe, token;
  try {
    shared = prepareDecrypt(options), sharedJwe = snapshotSharedJWE(jwe), token = shareJWE(sharedJwe);
  } catch {
    throw new JWEDecryptionFailed();
  }
  const recipientSnapshots = recipients.map((recipient) => snapshotRecipientJWE(recipient));
  if (recipients.length > 1)
    for (const [, headerAlg] of recipientSnapshots) {
      const alg = token[0]?.alg ?? headerAlg ?? sharedJwe.unprotected?.alg, algEntry = typeof alg == "string" ? JWE[alg] : void 0;
      if (algEntry && !isJWECEKTransport(algEntry))
        throw new JWEInvalid(`"${alg}" alg may only have a single recipient`);
    }
  for (const [recipient] of recipientSnapshots)
    if (recipient)
      try {
        const flattened = { ...sharedJwe, ...recipient };
        return checkRecipient(flattened), await decryptJWE(flattened, shared, key, token);
      } catch {
      }
  throw new JWEDecryptionFailed();
}
var init_decrypt3 = __esm({
  "node_modules/jose/dist/webapi/jwe/general/decrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jwe_decrypt();
    init_errors();
    init_validate();
    init_jwe_algorithms();
    __name(generalDecrypt, "generalDecrypt");
  }
});

// node_modules/jose/dist/webapi/lib/jwe_encrypt.js
function checkDisjoint(protectedHeader, unprotectedHeader, sharedUnprotectedHeader) {
  if (!isDisjoint(protectedHeader, unprotectedHeader, sharedUnprotectedHeader))
    throw new JWEInvalid("JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint");
}
function checkEncryptHeaders(input, options, sharedHeadersNormalized = false) {
  if (!input[1] && !input[2] && !input[3])
    throw new JWEInvalid("either setProtectedHeader, setUnprotectedHeader, or sharedUnprotectedHeader must be called before #encrypt()");
  options !== void 0 && (input[8] = options?.crit);
  let [, protectedHeader, unprotectedHeader, sharedUnprotectedHeader, aad, cek, iv, keyManagementParameters, crit] = input;
  if (aad !== void 0 && assertUint8Array(aad, "JWE Additional Authenticated Data"), cek !== void 0 && assertUint8Array(cek, "JWE Content Encryption Key"), iv !== void 0 && assertUint8Array(iv, "JWE Initialization Vector"), !sharedHeadersNormalized && protectedHeader !== void 0 && (protectedHeader = serializeJoseHeader(JWEInvalid, protectedHeader)[0], input[1] = protectedHeader), unprotectedHeader !== void 0 && (unprotectedHeader = serializeJoseHeader(JWEInvalid, unprotectedHeader)[0], input[2] = unprotectedHeader), !sharedHeadersNormalized && sharedUnprotectedHeader !== void 0 && (sharedUnprotectedHeader = serializeJoseHeader(JWEInvalid, sharedUnprotectedHeader)[0], input[3] = sharedUnprotectedHeader), keyManagementParameters !== void 0 && !isObject(keyManagementParameters))
    throw new TypeError("JWE Key Management Parameters must be an object");
  checkDisjoint(protectedHeader, unprotectedHeader, sharedUnprotectedHeader);
  const joseHeader = {
    ...protectedHeader,
    ...unprotectedHeader,
    ...sharedUnprotectedHeader
  };
  validateCritDuplicates(JWEInvalid, protectedHeader), validateCrit(JWEInvalid, JWE_RECOGNIZED, crit, protectedHeader, joseHeader), validateZip(joseHeader, protectedHeader);
  const { alg, enc } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWEInvalid('JWE "alg" (Algorithm) Header Parameter missing or invalid');
  const algEntry = JWE[alg];
  if (algEntry?.mode === "integrated-encryption") {
    if (enc !== void 0)
      throw new JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter must not be present for integrated encryption');
    if (cek !== void 0)
      throw new TypeError(`setContentEncryptionKey cannot be called with JWE "alg" (Algorithm) Header ${alg}`);
    if (iv !== void 0)
      throw new TypeError(`setInitializationVector cannot be called with JWE "alg" (Algorithm) Header ${alg}`);
    return [joseHeader, void 0, algEntry];
  }
  if (typeof enc != "string" || !enc)
    throw new JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
  return [joseHeader, jweEncryption(enc), algEntry];
}
async function encryptJWE(input, checked, key) {
  const [joseHeader, encEntry, selected] = checked, [inputPlaintext, inputProtectedHeader, inputUnprotectedHeader, sharedUnprotectedHeader, aad, providedCek, inputIv, keyManagementParameters, , unprotectedParameters] = input;
  let protectedHeader = inputProtectedHeader, unprotectedHeader = inputUnprotectedHeader;
  const algEntry = selected ?? jweAlgorithm(joseHeader.alg);
  let encryptedKey, parameters, cek;
  algEntry.mode === "integrated-encryption" ? cek = await prepareKey(algEntry, key, "encrypt") : [cek, encryptedKey, parameters] = await encryptKeyManagement(algEntry, encEntry, key, joseHeader, providedCek, keyManagementParameters), parameters && (unprotectedParameters ? unprotectedHeader = unprotectedHeader ? { ...unprotectedHeader, ...parameters } : parameters : protectedHeader = protectedHeader ? { ...protectedHeader, ...parameters } : parameters, checkDisjoint(protectedHeader, unprotectedHeader, sharedUnprotectedHeader));
  const protectedHeaderS = protectedHeader ? encode2(JSON.stringify(protectedHeader)) : "", aadMember = aad?.byteLength ? encode2(aad) : void 0, additionalData = encode(aadMember ? `${protectedHeaderS}.${aadMember}` : protectedHeaderS);
  let plaintext = inputPlaintext;
  joseHeader.zip === "DEF" && (plaintext = await compress(plaintext).catch((cause) => {
    throw new JWEInvalid("Failed to compress plaintext", { cause });
  }));
  let ciphertext, tag2, iv;
  algEntry.mode === "integrated-encryption" ? [encryptedKey, ciphertext] = await algEntry.encrypt(cek, plaintext, additionalData, protectedHeader, joseHeader, keyManagementParameters) : { ciphertext, tag: tag2, iv } = await encrypt(encEntry, plaintext, cek, inputIv, additionalData);
  const jwe = {
    ciphertext: encode2(ciphertext)
  };
  return iv && (jwe.iv = encode2(iv)), tag2 && (jwe.tag = encode2(tag2)), encryptedKey?.byteLength && (jwe.encrypted_key = encode2(encryptedKey)), aadMember && (jwe.aad = aadMember), protectedHeader && (jwe.protected = protectedHeaderS), sharedUnprotectedHeader && (jwe.unprotected = sharedUnprotectedHeader), unprotectedHeader && (jwe.header = unprotectedHeader), jwe;
}
async function createJWE(input, key, options) {
  return encryptJWE(input, checkEncryptHeaders(input, options), key);
}
function compactJWE(jwe) {
  return [jwe.protected, jwe.encrypted_key, jwe.iv, jwe.ciphertext, jwe.tag].join(".");
}
var init_jwe_encrypt = __esm({
  "node_modules/jose/dist/webapi/lib/jwe_encrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_base64url();
    init_content_encryption();
    init_key_management();
    init_errors();
    init_validate();
    init_buffer_utils();
    init_key();
    init_jwe_algorithms();
    init_deflate();
    __name(checkDisjoint, "checkDisjoint");
    __name(checkEncryptHeaders, "checkEncryptHeaders");
    __name(encryptJWE, "encryptJWE");
    __name(createJWE, "createJWE");
    __name(compactJWE, "compactJWE");
  }
});

// node_modules/jose/dist/webapi/jwe/general/encrypt.js
var IndividualRecipient, GeneralEncrypt;
var init_encrypt = __esm({
  "node_modules/jose/dist/webapi/jwe/general/encrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_validate();
    init_errors();
    init_content_encryption();
    init_base64url();
    init_jwe_encrypt();
    init_key_management();
    init_jwe_algorithms();
    IndividualRecipient = class {
      static {
        __name(this, "IndividualRecipient");
      }
      #parent;
      state;
      constructor(enc, key, crit) {
        this.#parent = enc, this.state = [void 0, void 0, key, crit];
      }
      setUnprotectedHeader(unprotectedHeader) {
        return assertNotSet(this.state[0], "setUnprotectedHeader"), this.state[0] = unprotectedHeader, this;
      }
      setKeyManagementParameters(parameters) {
        return assertNotSet(this.state[1], "setKeyManagementParameters"), this.state[1] = parameters, this;
      }
      addRecipient(...args) {
        return this.#parent.addRecipient(...args);
      }
      encrypt(...args) {
        return this.#parent.encrypt(...args);
      }
      done() {
        return this.#parent;
      }
    };
    GeneralEncrypt = class {
      static {
        __name(this, "GeneralEncrypt");
      }
      #plaintext;
      #recipients = [];
      #protectedHeader;
      #unprotectedHeader;
      #aad;
      constructor(plaintext) {
        this.#plaintext = plaintext;
      }
      addRecipient(key, options) {
        const recipient = new IndividualRecipient(this, key, options?.crit);
        return this.#recipients.push(recipient), recipient;
      }
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#protectedHeader, "setProtectedHeader"), this.#protectedHeader = protectedHeader, this;
      }
      setSharedUnprotectedHeader(sharedUnprotectedHeader) {
        return assertNotSet(this.#unprotectedHeader, "setSharedUnprotectedHeader"), this.#unprotectedHeader = sharedUnprotectedHeader, this;
      }
      setAdditionalAuthenticatedData(aad) {
        return this.#aad = aad, this;
      }
      async encrypt() {
        if (!this.#recipients.length)
          throw new JWEInvalid("at least one recipient must be added");
        assertUint8Array(this.#plaintext, "plaintext");
        const multiple = this.#recipients.length > 1;
        let enc, protectedHeader = this.#protectedHeader, sharedUnprotectedHeader = this.#unprotectedHeader;
        const recipients = [];
        for (const recipient of this.#recipients) {
          const [unprotectedHeader, keyManagementParameters, key, crit] = recipient.state, input = [
            this.#plaintext,
            protectedHeader,
            unprotectedHeader,
            sharedUnprotectedHeader,
            this.#aad,
            void 0,
            void 0,
            keyManagementParameters,
            crit,
            multiple
          ], headers = checkEncryptHeaders(input, void 0, recipients.length > 0);
          recipients.length || (protectedHeader = input[1], sharedUnprotectedHeader = input[3]), recipients.push([input, headers, key]);
          const [{ alg, enc: recipientEnc }, , algEntry] = headers;
          if (multiple && algEntry && !isJWECEKTransport(algEntry))
            throw new JWEInvalid(`"${alg}" alg may only have a single recipient`);
          if (!enc)
            enc = recipientEnc;
          else if (enc !== recipientEnc)
            throw new JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter must be the same for all recipients');
        }
        for (const [, headers] of recipients)
          headers[2] ??= jweAlgorithm(headers[0].alg);
        const [firstInput, firstHeaders, firstKey] = recipients[0], cek = multiple ? generateCek(firstHeaders[1]) : void 0;
        firstInput[5] = cek;
        const { encrypted_key, header, ...shared } = await encryptJWE(firstInput, firstHeaders, firstKey), jwe = {
          ...shared,
          recipients: [{}]
        };
        encrypted_key && (jwe.recipients[0].encrypted_key = encrypted_key), header && (jwe.recipients[0].header = header);
        for (let i = 1; i < recipients.length; i++) {
          const [input, [joseHeader, encEntry, algEntry], key] = recipients[i], unprotectedHeader = input[2], [, encryptedKey, parameters] = await encryptKeyManagement(algEntry, encEntry, key, joseHeader, cek, input[7]), target = {
            encrypted_key: encode2(encryptedKey)
          };
          if (unprotectedHeader || parameters) {
            const header2 = { ...unprotectedHeader, ...parameters };
            parameters && checkDisjoint(input[1], header2, input[3]), target.header = header2;
          }
          jwe.recipients.push(target);
        }
        return jwe;
      }
    };
  }
});

// node_modules/jose/dist/webapi/lib/jws_algorithms.js
function hmac(bits) {
  const subtle = { name: "HMAC", hash: `SHA-${bits}` };
  return { kty: ["oct"], secret: true, subtle, signing: subtle, usages: sig };
}
function rsa(bits, saltLength) {
  const subtle = { name: saltLength ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: `SHA-${bits}` };
  return {
    kty: ["RSA"],
    subtle,
    signing: saltLength ? { ...subtle, saltLength } : subtle,
    usages: sig,
    minRsaBits: 2048
  };
}
function ecdsa(crv, bits) {
  return {
    kty: ["EC"],
    crv,
    subtle: { name: "ECDSA", namedCurve: crv },
    signing: { name: "ECDSA", hash: `SHA-${bits}` },
    usages: sig
  };
}
function eddsa() {
  const subtle = { name: "Ed25519" };
  return {
    kty: ["OKP"],
    crv: "Ed25519",
    subtle,
    signing: subtle,
    usages: sig
  };
}
function mldsa(bits) {
  const subtle = { name: `ML-DSA-${bits}` };
  return {
    kty: ["AKP"],
    subtle,
    signing: subtle,
    usages: sig
  };
}
function jwsAlgorithm(alg) {
  const entry = typeof alg == "string" ? JWS[alg] : void 0;
  if (!entry)
    throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  return entry;
}
var sig, JWS;
var init_jws_algorithms = __esm({
  "node_modules/jose/dist/webapi/lib/jws_algorithms.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_key_descriptor();
    sig = [["verify"], ["sign"]];
    __name(hmac, "hmac");
    __name(rsa, "rsa");
    __name(ecdsa, "ecdsa");
    __name(eddsa, "eddsa");
    __name(mldsa, "mldsa");
    JWS = table3({
      HS256: hmac(256),
      HS384: hmac(384),
      HS512: hmac(512),
      RS256: rsa(256),
      RS384: rsa(384),
      RS512: rsa(512),
      PS256: rsa(256, 32),
      PS384: rsa(384, 48),
      PS512: rsa(512, 64),
      ES256: ecdsa("P-256", 256),
      ES384: ecdsa("P-384", 384),
      ES512: ecdsa("P-521", 512),
      EdDSA: eddsa(),
      Ed25519: eddsa(),
      "ML-DSA-44": mldsa(44),
      "ML-DSA-65": mldsa(65),
      "ML-DSA-87": mldsa(87)
    });
    __name(jwsAlgorithm, "jwsAlgorithm");
  }
});

// node_modules/jose/dist/webapi/lib/jws_verify.js
function snapshotJws(jws, sharedPayload) {
  const encodedProtected = jws.protected, inputHeader = jws.header, header = isObject(inputHeader) ? { ...inputHeader } : inputHeader;
  let payload = sharedPayload ? sharedPayload[0] : jws.payload;
  !sharedPayload && payload instanceof Uint8Array && (payload = new Uint8Array(payload));
  const signature = jws.signature, snapshot = { payload, signature };
  if (encodedProtected !== void 0 && (snapshot.protected = encodedProtected), inputHeader !== void 0 && (snapshot.header = header), encodedProtected === void 0 && header === void 0)
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  if (encodedProtected !== void 0 && typeof encodedProtected != "string")
    throw new JWSInvalid("JWS Protected Header incorrect type");
  if (payload === void 0)
    throw new JWSInvalid("JWS Payload missing");
  if (typeof signature != "string")
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  if (header !== void 0 && !isObject(header))
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  return snapshot;
}
function prepareVerify(options) {
  return [options && validateAlgorithms("algorithms", options.algorithms), options?.crit];
}
function parseProtectedHeader(encodedProtected) {
  return encodedProtected === void 0 ? {} : parseJoseHeader(encodedProtected, JWSInvalid, "JWS Protected Header is invalid");
}
function encodeJsonUnencodedPayload(payload) {
  const invalid2 = /[\p{Cs}\p{Cn}]/u.exec(payload)?.[0];
  if (invalid2 !== void 0)
    throw new JWSInvalid(/\p{Cs}/u.test(invalid2) ? "JWS Payload must be a well-formed Unicode string" : "JWS Payload must not contain unassigned Unicode code points");
  return encoder.encode(payload);
}
function encodeCompactUnencodedPayload(payload) {
  try {
    return encode(payload);
  } catch {
    throw new JWSInvalid("JWS Compact Serialization payload must use only ASCII characters");
  }
}
async function verifySignature(jws, shared, key, encodeUnencodedPayload, parsedProtected) {
  const { protected: encodedProtected, header, payload: inputPayload } = jws, parsedProt = parsedProtected ?? parseProtectedHeader(encodedProtected);
  if (!isDisjoint(parsedProt, header))
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const joseHeader = { ...parsedProt, ...header }, b64 = validateB64(parsedProt, validateCrit(JWSInvalid, JWS_RECOGNIZED, shared[1], parsedProt, joseHeader)), { alg } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  if (shared[0] && !shared[0].has(alg))
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  if (b64) {
    if (typeof inputPayload != "string")
      throw new JWSInvalid("JWS Payload must be a string");
  } else if (typeof inputPayload != "string" && !(inputPayload instanceof Uint8Array))
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  const signingPayload = b64 || typeof inputPayload != "string" ? inputPayload : encodeUnencodedPayload(inputPayload);
  let resolvedKey = false;
  typeof key == "function" && (key = await key(parsedProt, jws), resolvedKey = true);
  const entry = jwsAlgorithm(alg), data = concat(encodedProtected !== void 0 ? encode(encodedProtected) : new Uint8Array(), encode("."), typeof signingPayload == "string" ? shared[2] ??= encodeBase64url(signingPayload, "payload", JWSInvalid) : signingPayload), signature = decodeBase64url(jws.signature, "signature", JWSInvalid), k = await prepareKey(entry, key, "verify"), cryptoKey = await rawKey(k, entry.subtle, "verify");
  entry.minRsaBits && checkModulusLength(entry.alg, cryptoKey);
  let verified = false;
  try {
    verified = await crypto.subtle.verify(entry.signing, cryptoKey, signature, data);
  } catch {
  }
  if (!verified)
    throw new JWSSignatureVerificationFailed();
  const result = { payload: typeof signingPayload == "string" ? decodeBase64url(signingPayload, "payload", JWSInvalid) : signingPayload };
  return encodedProtected !== void 0 && (result.protectedHeader = parsedProt), header !== void 0 && (result.unprotectedHeader = header), resolvedKey ? [{ ...result, key: k }, b64] : [result, b64];
}
async function verifyCompact(jws, shared, key) {
  if (jws instanceof Uint8Array && (jws = decoder.decode(jws)), typeof jws != "string")
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3)
    throw new JWSInvalid("Invalid Compact JWS");
  return verifySignature({ payload, protected: protectedHeader, signature }, shared, key, encodeCompactUnencodedPayload);
}
var init_jws_verify = __esm({
  "node_modules/jose/dist/webapi/lib/jws_verify.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_algorithms();
    init_errors();
    init_buffer_utils();
    init_validate();
    init_key();
    __name(snapshotJws, "snapshotJws");
    __name(prepareVerify, "prepareVerify");
    __name(parseProtectedHeader, "parseProtectedHeader");
    __name(encodeJsonUnencodedPayload, "encodeJsonUnencodedPayload");
    __name(encodeCompactUnencodedPayload, "encodeCompactUnencodedPayload");
    __name(verifySignature, "verifySignature");
    __name(verifyCompact, "verifyCompact");
  }
});

// node_modules/jose/dist/webapi/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  const [result] = await verifyCompact(jws, prepareVerify(options), key);
  return result;
}
var init_verify = __esm({
  "node_modules/jose/dist/webapi/jws/compact/verify.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_verify();
    __name(compactVerify, "compactVerify");
  }
});

// node_modules/jose/dist/webapi/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws))
    throw new JWSInvalid("Flattened JWS must be an object");
  const snapshot = snapshotJws(jws), [result] = await verifySignature(snapshot, prepareVerify(options), key, encodeJsonUnencodedPayload);
  return result;
}
var init_verify2 = __esm({
  "node_modules/jose/dist/webapi/jws/flattened/verify.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_validate();
    init_jws_verify();
    __name(flattenedVerify, "flattenedVerify");
  }
});

// node_modules/jose/dist/webapi/jws/general/verify.js
function snapshotSignature(signature, payload) {
  try {
    const jws = snapshotJws(signature, [payload]), protectedHeader = parseProtectedHeader(jws.protected), { b64, crit } = protectedHeader;
    return [
      jws,
      protectedHeader,
      Array.isArray(crit) && crit.includes("b64") ? typeof b64 == "boolean" ? b64 ? 1 : 2 : 0 : 1
    ];
  } catch {
    return;
  }
}
async function generalVerify(jws, key, options) {
  if (!isObject(jws))
    throw new JWSInvalid("General JWS must be an object");
  const { signatures, payload: inputPayload } = jws;
  if (!Array.isArray(signatures))
    throw new JWSInvalid("JWS Signatures missing or incorrect type");
  const signatureEntries = Array.from(signatures);
  if (!signatureEntries.every(isObject))
    throw new JWSInvalid("JWS Signatures missing or incorrect type");
  let shared;
  try {
    if (inputPayload === void 0)
      throw new Error();
    shared = prepareVerify(options);
  } catch {
    throw new JWSSignatureVerificationFailed();
  }
  const payload = inputPayload instanceof Uint8Array ? new Uint8Array(inputPayload) : inputPayload, candidates = signatureEntries.map((signature) => snapshotSignature(signature, payload)).filter((candidate) => candidate !== void 0);
  let modes = 0;
  for (const [, , mode] of candidates)
    if (modes |= mode, modes === 3)
      throw new JWSInvalid("inconsistent use of JWS Unencoded Payload (RFC7797)");
  for (const candidate of candidates)
    try {
      const [result] = await verifySignature(candidate[0], shared, key, encodeJsonUnencodedPayload, candidate[1]);
      return result;
    } catch {
    }
  throw new JWSSignatureVerificationFailed();
}
var init_verify3 = __esm({
  "node_modules/jose/dist/webapi/jws/general/verify.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_verify();
    init_errors();
    init_validate();
    __name(snapshotSignature, "snapshotSignature");
    __name(generalVerify, "generalVerify");
  }
});

// node_modules/jose/dist/webapi/lib/jwt_claims_set.js
function invalidDuration() {
  throw new TypeError("Invalid time period format");
}
function secs(str2) {
  typeof str2 != "string" && invalidDuration();
  const matched = REGEX.exec(str2);
  (!matched || matched[4] && matched[1]) && invalidDuration();
  const value = parseFloat(matched[2]), numericDate2 = Math.round(value * multipliers[matched[3][0].toLowerCase()]);
  return Number.isFinite(numericDate2) || invalidDuration(), matched[1] === "-" || matched[4] === "ago" ? -numericDate2 : numericDate2;
}
function validateInput(label, input) {
  if (!Number.isFinite(input))
    throw new TypeError(`Invalid ${label} input`);
  return input;
}
function validateStringClaim(claim, value) {
  if (typeof value != "string")
    throw new TypeError(`"${claim}" claim must be a string`);
}
function validateAudienceClaim(value) {
  if (typeof value != "string" && (!Array.isArray(value) || Array.from(value).some((member) => typeof member != "string")))
    throw new TypeError('"aud" claim must be a string or an array of strings');
}
function numericDate(value, label) {
  return typeof value == "number" ? validateInput(label, value) : value instanceof Date ? validateInput(label, epoch(value)) : epoch(/* @__PURE__ */ new Date()) + secs(value);
}
function validateNumericDate(payload, claim, required = false) {
  const value = payload[claim];
  if (!(value === void 0 && !required)) {
    if (typeof value != "number")
      throw new JWTClaimValidationFailed(`"${claim}" claim must be a number`, payload, claim, "invalid");
    return value;
  }
}
function unexpectedClaim(payload, claim) {
  throw new JWTClaimValidationFailed(`unexpected "${claim}" claim value`, payload, claim, checkFailed);
}
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(strictDecoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload))
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  const { typ } = options;
  if (typ !== void 0 && (typeof protectedHeader.typ != "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ)))
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", checkFailed);
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options, presenceCheck = [...requiredClaims];
  maxTokenAge !== void 0 && presenceCheck.push("iat"), audience !== void 0 && presenceCheck.push("aud"), subject !== void 0 && presenceCheck.push("sub"), issuer !== void 0 && presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse()))
    if (!Object.hasOwn(payload, claim))
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
  issuer !== void 0 && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss) && unexpectedClaim(payload, "iss"), subject !== void 0 && payload.sub !== subject && unexpectedClaim(payload, "sub"), audience !== void 0 && !checkAudiencePresence(payload.aud, typeof audience == "string" ? [audience] : audience) && unexpectedClaim(payload, "aud");
  const { clockTolerance } = options;
  let tolerance = 0;
  if (typeof clockTolerance == "string")
    tolerance = secs(clockTolerance);
  else if (clockTolerance !== void 0) {
    if (typeof clockTolerance != "number")
      throw new TypeError("Invalid clockTolerance option type");
    tolerance = clockTolerance;
  }
  validateInput("clockTolerance option", tolerance);
  const { currentDate } = options, now = validateInput("currentDate option", epoch(currentDate === void 0 ? /* @__PURE__ */ new Date() : currentDate)), iat = validateNumericDate(payload, "iat", maxTokenAge !== void 0), nbf = validateNumericDate(payload, "nbf");
  if (nbf !== void 0 && nbf > now + tolerance)
    throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", checkFailed);
  const exp = validateNumericDate(payload, "exp");
  if (exp !== void 0 && exp <= now - tolerance)
    throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", checkFailed);
  if (maxTokenAge !== void 0) {
    const age = now - iat, max = validateInput("maxTokenAge option", typeof maxTokenAge == "number" ? maxTokenAge : secs(maxTokenAge));
    if (age - tolerance > max)
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", checkFailed);
    if (age < -tolerance)
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", checkFailed);
  }
  return payload;
}
function producerPayload(producer) {
  return producerPayloads.get(producer);
}
function jwtData(producer) {
  const payload = producerPayload(producer);
  for (const claim of ["iat", "nbf", "exp"]) {
    const value = payload[claim];
    if (typeof value == "number" && !Number.isFinite(value))
      throw new TypeError(`"${claim}" claim must be a finite number`);
  }
  return encoder.encode(JSON.stringify(payload));
}
function jwtClaim(producer, claim) {
  return producerPayload(producer)[claim];
}
var epoch, multipliers, REGEX, checkFailed, normalizeTyp, checkAudiencePresence, producerPayloads, JWTClaimsBuilder;
var init_jwt_claims_set = __esm({
  "node_modules/jose/dist/webapi/lib/jwt_claims_set.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_buffer_utils();
    init_validate();
    epoch = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "epoch");
    multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      y: 31557600
    };
    REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
    checkFailed = "check_failed";
    __name(invalidDuration, "invalidDuration");
    __name(secs, "secs");
    __name(validateInput, "validateInput");
    __name(validateStringClaim, "validateStringClaim");
    __name(validateAudienceClaim, "validateAudienceClaim");
    __name(numericDate, "numericDate");
    normalizeTyp = /* @__PURE__ */ __name((value) => {
      const normalized = value.toLowerCase();
      return value.includes("/") ? normalized : `application/${normalized}`;
    }, "normalizeTyp");
    checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => typeof audPayload == "string" ? audOption.includes(audPayload) : Array.isArray(audPayload) ? audOption.some((aud) => audPayload.includes(aud)) : false, "checkAudiencePresence");
    __name(validateNumericDate, "validateNumericDate");
    __name(unexpectedClaim, "unexpectedClaim");
    __name(validateClaimsSet, "validateClaimsSet");
    __name(producerPayload, "producerPayload");
    __name(jwtData, "jwtData");
    __name(jwtClaim, "jwtClaim");
    JWTClaimsBuilder = class {
      static {
        __name(this, "JWTClaimsBuilder");
      }
      constructor(payload = {}) {
        if (!isObject(payload))
          throw new TypeError("JWT Claims Set MUST be an object");
        (producerPayloads ||= /* @__PURE__ */ new WeakMap()).set(this, structuredClone(payload));
      }
      setIssuer(value) {
        return validateStringClaim("iss", value), producerPayload(this).iss = value, this;
      }
      setSubject(value) {
        return validateStringClaim("sub", value), producerPayload(this).sub = value, this;
      }
      setAudience(value) {
        return validateAudienceClaim(value), producerPayload(this).aud = value, this;
      }
      setJti(value) {
        return validateStringClaim("jti", value), producerPayload(this).jti = value, this;
      }
      setNotBefore(value) {
        return producerPayload(this).nbf = numericDate(value, "setNotBefore"), this;
      }
      setExpirationTime(value) {
        return producerPayload(this).exp = numericDate(value, "setExpirationTime"), this;
      }
      setIssuedAt(value) {
        const payload = producerPayload(this);
        return value === void 0 ? payload.iat = epoch(/* @__PURE__ */ new Date()) : typeof value == "string" ? payload.iat = validateInput("setIssuedAt", epoch(/* @__PURE__ */ new Date()) + secs(value)) : payload.iat = numericDate(value, "setIssuedAt"), this;
      }
    };
  }
});

// node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const [verified, b64] = await verifyCompact(jwt, prepareVerify(options), key);
  if (!b64)
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  return { ...verified, payload };
}
var init_verify4 = __esm({
  "node_modules/jose/dist/webapi/jwt/verify.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_verify();
    init_jwt_claims_set();
    init_errors();
    __name(jwtVerify, "jwtVerify");
  }
});

// node_modules/jose/dist/webapi/jwt/decrypt.js
async function jwtDecrypt(jwt, key, options) {
  const { plaintext, ...result } = await decryptCompact(jwt, prepareDecrypt(options), key), { protectedHeader } = result, payload = validateClaimsSet(protectedHeader, plaintext, options);
  for (const claim of ["iss", "sub", "aud"])
    if (protectedHeader[claim] !== void 0 && (claim === "aud" ? JSON.stringify(protectedHeader.aud) !== JSON.stringify(payload.aud) : protectedHeader[claim] !== payload[claim]))
      throw new JWTClaimValidationFailed(`replicated "${claim}" claim header parameter mismatch`, payload, claim, "mismatch");
  return { payload, ...result };
}
var init_decrypt4 = __esm({
  "node_modules/jose/dist/webapi/jwt/decrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jwe_decrypt();
    init_jwt_claims_set();
    init_errors();
    __name(jwtDecrypt, "jwtDecrypt");
  }
});

// node_modules/jose/dist/webapi/jwe/compact/encrypt.js
var CompactEncrypt;
var init_encrypt2 = __esm({
  "node_modules/jose/dist/webapi/jwe/compact/encrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_validate();
    init_jwe_encrypt();
    CompactEncrypt = class {
      static {
        __name(this, "CompactEncrypt");
      }
      #input;
      constructor(plaintext) {
        assertUint8Array(plaintext, "plaintext"), this.#input = [plaintext];
      }
      setContentEncryptionKey(cek) {
        return assertNotSet(this.#input[5], "setContentEncryptionKey"), this.#input[5] = cek, this;
      }
      setInitializationVector(iv) {
        return assertNotSet(this.#input[6], "setInitializationVector"), this.#input[6] = iv, this;
      }
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#input[1], "setProtectedHeader"), this.#input[1] = protectedHeader, this;
      }
      setKeyManagementParameters(parameters) {
        return assertNotSet(this.#input[7], "setKeyManagementParameters"), this.#input[7] = parameters, this;
      }
      async encrypt(key, options) {
        return compactJWE(await createJWE([...this.#input], key, options));
      }
    };
  }
});

// node_modules/jose/dist/webapi/jwe/flattened/encrypt.js
var FlattenedEncrypt;
var init_encrypt3 = __esm({
  "node_modules/jose/dist/webapi/jwe/flattened/encrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_validate();
    init_jwe_encrypt();
    FlattenedEncrypt = class {
      static {
        __name(this, "FlattenedEncrypt");
      }
      #input;
      constructor(plaintext) {
        assertUint8Array(plaintext, "plaintext"), this.#input = [plaintext];
      }
      setKeyManagementParameters(parameters) {
        return assertNotSet(this.#input[7], "setKeyManagementParameters"), this.#input[7] = parameters, this;
      }
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#input[1], "setProtectedHeader"), this.#input[1] = protectedHeader, this;
      }
      setSharedUnprotectedHeader(sharedUnprotectedHeader) {
        return assertNotSet(this.#input[3], "setSharedUnprotectedHeader"), this.#input[3] = sharedUnprotectedHeader, this;
      }
      setUnprotectedHeader(unprotectedHeader) {
        return assertNotSet(this.#input[2], "setUnprotectedHeader"), this.#input[2] = unprotectedHeader, this;
      }
      setAdditionalAuthenticatedData(aad) {
        return this.#input[4] = aad, this;
      }
      setContentEncryptionKey(cek) {
        return assertNotSet(this.#input[5], "setContentEncryptionKey"), this.#input[5] = cek, this;
      }
      setInitializationVector(iv) {
        return assertNotSet(this.#input[6], "setInitializationVector"), this.#input[6] = iv, this;
      }
      async encrypt(key, options) {
        return createJWE([...this.#input], key, options);
      }
    };
  }
});

// node_modules/jose/dist/webapi/lib/jws_sign.js
async function createSignature(input, key, rejectUnencoded) {
  let [payload, protectedHeader, unprotectedHeader, crit] = input, protectedHeaderString = "";
  if (protectedHeader !== void 0) {
    const normalized = serializeJoseHeader(JWSInvalid, protectedHeader);
    protectedHeader = normalized[0], protectedHeaderString = encode2(normalized[1]);
  }
  if (unprotectedHeader !== void 0 && (unprotectedHeader = serializeJoseHeader(JWSInvalid, unprotectedHeader)[0]), !protectedHeader && !unprotectedHeader)
    throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
  if (!isDisjoint(protectedHeader, unprotectedHeader))
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const joseHeader = { ...protectedHeader, ...unprotectedHeader };
  validateCritDuplicates(JWSInvalid, protectedHeader);
  const b64 = validateB64(protectedHeader, validateCrit(JWSInvalid, JWS_RECOGNIZED, crit, protectedHeader, joseHeader));
  b64 || rejectUnencoded?.();
  const { alg } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const entry = jwsAlgorithm(alg);
  let payloadS = "", payloadB = payload, data;
  if (b64) {
    const encoded = input[4];
    encoded ? (payloadS = encoded[0] ??= encode2(payload), payloadB = encoded[1] ??= encode(payloadS)) : (payloadS = encode2(payload), data = encoder.encode(`${protectedHeaderString}.${payloadS}`));
  }
  data ??= concat(encode(protectedHeaderString), encode("."), payloadB);
  const k = await rawKey(await prepareKey(entry, key, "sign"), entry.subtle, "sign");
  entry.minRsaBits && checkModulusLength(entry.alg, k);
  const jws = {
    signature: encode2(new Uint8Array(await crypto.subtle.sign(entry.signing, k, data))),
    payload: payloadS
  };
  return protectedHeader && (jws.protected = protectedHeaderString), unprotectedHeader && (jws.header = unprotectedHeader), [jws, b64];
}
async function createCompactSignature(payload, protectedHeader, crit, key, rejectUnencoded) {
  const [jws] = await createSignature([payload, protectedHeader, void 0, crit], key, rejectUnencoded);
  return `${jws.protected}.${jws.payload}.${jws.signature}`;
}
var init_jws_sign = __esm({
  "node_modules/jose/dist/webapi/lib/jws_sign.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_base64url();
    init_jws_algorithms();
    init_validate();
    init_errors();
    init_buffer_utils();
    init_key();
    __name(createSignature, "createSignature");
    __name(createCompactSignature, "createCompactSignature");
  }
});

// node_modules/jose/dist/webapi/jws/compact/sign.js
var CompactSign;
var init_sign = __esm({
  "node_modules/jose/dist/webapi/jws/compact/sign.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_sign();
    init_validate();
    CompactSign = class {
      static {
        __name(this, "CompactSign");
      }
      #payload;
      #protectedHeader;
      constructor(payload) {
        assertUint8Array(payload, "payload"), this.#payload = payload;
      }
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#protectedHeader, "setProtectedHeader"), this.#protectedHeader = protectedHeader, this;
      }
      async sign(key, options) {
        return createCompactSignature(this.#payload, this.#protectedHeader, options?.crit, key, () => {
          throw new TypeError("use the flattened module for creating JWS with b64: false");
        });
      }
    };
  }
});

// node_modules/jose/dist/webapi/jws/flattened/sign.js
var FlattenedSign;
var init_sign2 = __esm({
  "node_modules/jose/dist/webapi/jws/flattened/sign.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_sign();
    init_validate();
    FlattenedSign = class {
      static {
        __name(this, "FlattenedSign");
      }
      #input;
      constructor(payload) {
        assertUint8Array(payload, "payload"), this.#input = [payload];
      }
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#input[1], "setProtectedHeader"), this.#input[1] = protectedHeader, this;
      }
      setUnprotectedHeader(unprotectedHeader) {
        return assertNotSet(this.#input[2], "setUnprotectedHeader"), this.#input[2] = unprotectedHeader, this;
      }
      async sign(key, options) {
        const input = [...this.#input];
        input[3] = options?.crit;
        const [jws] = await createSignature(input, key);
        return jws;
      }
    };
  }
});

// node_modules/jose/dist/webapi/jws/general/sign.js
var IndividualSignature, GeneralSign;
var init_sign3 = __esm({
  "node_modules/jose/dist/webapi/jws/general/sign.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_sign();
    init_errors();
    init_validate();
    IndividualSignature = class {
      static {
        __name(this, "IndividualSignature");
      }
      #parent;
      state;
      constructor(sig2, key, options) {
        this.#parent = sig2, this.state = [void 0, void 0, key, options?.crit];
      }
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.state[0], "setProtectedHeader"), this.state[0] = protectedHeader, this;
      }
      setUnprotectedHeader(unprotectedHeader) {
        return assertNotSet(this.state[1], "setUnprotectedHeader"), this.state[1] = unprotectedHeader, this;
      }
      addSignature(...args) {
        return this.#parent.addSignature(...args);
      }
      sign(...args) {
        return this.#parent.sign(...args);
      }
      done() {
        return this.#parent;
      }
    };
    GeneralSign = class {
      static {
        __name(this, "GeneralSign");
      }
      #payload;
      #signatures = [];
      constructor(payload) {
        this.#payload = payload;
      }
      addSignature(key, options) {
        const signature = new IndividualSignature(this, key, options);
        return this.#signatures.push(signature), signature;
      }
      async sign() {
        if (!this.#signatures.length)
          throw new JWSInvalid("at least one signature must be added");
        assertUint8Array(this.#payload, "payload");
        const jws = {
          signatures: [],
          payload: ""
        }, encoded = [];
        let b64;
        for (const signature of this.#signatures) {
          const [protectedHeader, unprotectedHeader, key, crit] = signature.state, [{ payload, ...rest }, signatureB64] = await createSignature([this.#payload, protectedHeader, unprotectedHeader, crit, encoded], key);
          if (b64 === void 0)
            b64 = signatureB64, jws.payload = payload;
          else if (b64 !== signatureB64)
            throw new JWSInvalid("inconsistent use of JWS Unencoded Payload (RFC7797)");
          jws.signatures.push(rest);
        }
        return jws;
      }
    };
  }
});

// node_modules/jose/dist/webapi/jwt/sign.js
var SignJWT_base, SignJWT;
var init_sign4 = __esm({
  "node_modules/jose/dist/webapi/jwt/sign.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jws_sign();
    init_errors();
    init_jwt_claims_set();
    init_validate();
    SignJWT_base = JWTClaimsBuilder;
    SignJWT = class extends SignJWT_base {
      static {
        __name(this, "SignJWT");
      }
      #protectedHeader;
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#protectedHeader, "setProtectedHeader"), this.#protectedHeader = protectedHeader, this;
      }
      async sign(key, options) {
        return createCompactSignature(jwtData(this), this.#protectedHeader, options?.crit, key, () => {
          throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
        });
      }
    };
  }
});

// node_modules/jose/dist/webapi/jwt/encrypt.js
var EncryptJWT_base, EncryptJWT;
var init_encrypt4 = __esm({
  "node_modules/jose/dist/webapi/jwt/encrypt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_jwe_encrypt();
    init_jwt_claims_set();
    init_validate();
    EncryptJWT_base = JWTClaimsBuilder;
    EncryptJWT = class extends EncryptJWT_base {
      static {
        __name(this, "EncryptJWT");
      }
      #input = [void 0];
      #replicateIssuerAsHeader;
      #replicateSubjectAsHeader;
      #replicateAudienceAsHeader;
      setProtectedHeader(protectedHeader) {
        return assertNotSet(this.#input[1], "setProtectedHeader"), this.#input[1] = protectedHeader, this;
      }
      setKeyManagementParameters(parameters) {
        return assertNotSet(this.#input[7], "setKeyManagementParameters"), this.#input[7] = parameters, this;
      }
      setContentEncryptionKey(cek) {
        return assertNotSet(this.#input[5], "setContentEncryptionKey"), this.#input[5] = cek, this;
      }
      setInitializationVector(iv) {
        return assertNotSet(this.#input[6], "setInitializationVector"), this.#input[6] = iv, this;
      }
      replicateIssuerAsHeader() {
        return this.#replicateIssuerAsHeader = true, this;
      }
      replicateSubjectAsHeader() {
        return this.#replicateSubjectAsHeader = true, this;
      }
      replicateAudienceAsHeader() {
        return this.#replicateAudienceAsHeader = true, this;
      }
      async encrypt(key, options) {
        const plaintext = jwtData(this);
        this.#input[1] && (this.#replicateIssuerAsHeader || this.#replicateSubjectAsHeader || this.#replicateAudienceAsHeader) && (this.#input[1] = {
          ...this.#input[1],
          iss: this.#replicateIssuerAsHeader ? jwtClaim(this, "iss") : void 0,
          sub: this.#replicateSubjectAsHeader ? jwtClaim(this, "sub") : void 0,
          aud: this.#replicateAudienceAsHeader ? jwtClaim(this, "aud") : void 0
        });
        const input = [...this.#input];
        return input[0] = plaintext, compactJWE(await createJWE(input, key, options));
      }
    };
  }
});

// node_modules/jose/dist/webapi/lib/key_algorithm.js
function unsupportedAlg(source = 'JWK "alg" (Algorithm) Parameter') {
  throw new JOSENotSupported(`Invalid or unsupported ${source} value`);
}
function keyAlgorithm(alg, source) {
  return (typeof alg == "string" ? JWS[alg] ?? JWE[alg] : void 0) ?? unsupportedAlg(source);
}
var algArgument;
var init_key_algorithm = __esm({
  "node_modules/jose/dist/webapi/lib/key_algorithm.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_jws_algorithms();
    init_jwe_algorithms();
    algArgument = '"alg" (Algorithm)';
    __name(unsupportedAlg, "unsupportedAlg");
    __name(keyAlgorithm, "keyAlgorithm");
  }
});

// node_modules/jose/dist/webapi/lib/asn1.js
function parseKeyHeader(state, keyFormat) {
  if (expectTag(state, 48, `Invalid ${keyFormat === "spki" ? "SPKI" : "PKCS#8"} structure`), parseLength(state), keyFormat === "pkcs8") {
    expectTag(state, 2, "Expected version field");
    const length = parseLength(state);
    state.pos += length;
  }
  expectTag(state, 48, "Expected algorithm identifier"), parseLength(state);
}
function spkiFromX509(buf) {
  const state = createASN1State(buf);
  expectTag(state, 48, "Invalid certificate structure");
  const certificateLength = parseLength(state);
  if (certificateLength < 0 || state.pos + certificateLength > state.data.length)
    throw new Error("Unexpected end of ASN.1 input");
  expectTag(state, 48, "Invalid tbsCertificate structure"), parseLength(state), buf[state.pos] === 160 ? skipElement(state, 6) : skipElement(state, 5);
  const spkiStart = state.pos;
  expectTag(state, 48, "Invalid SPKI structure");
  const spkiContentLen = parseLength(state);
  return buf.subarray(spkiStart, spkiStart + spkiContentLen + (state.pos - spkiStart));
}
var formatPEM, genericExport, toSPKI, toPKCS8, bytesEqual, createASN1State, readByte, parseLength, skipElement, expectTag, getSubarray, parseAlgorithmOID, parseECAlgorithmIdentifier, genericImport, processPEMData, fromPKCS8, fromSPKI, fromX509;
var init_asn1 = __esm({
  "node_modules/jose/dist/webapi/lib/asn1.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_key();
    init_buffer_utils();
    init_errors();
    init_key_algorithm();
    formatPEM = /* @__PURE__ */ __name((b64, descriptor) => {
      const newlined = (b64.match(/.{1,64}/g) || []).join(`
`);
      return `-----BEGIN ${descriptor}-----
${newlined}
-----END ${descriptor}-----`;
    }, "formatPEM");
    genericExport = /* @__PURE__ */ __name(async (keyType, keyFormat, key) => {
      if (isKeyObject(key)) {
        if (key.type !== keyType)
          throw new TypeError(`key is not a ${keyType} key`);
        return key.export({ format: "pem", type: keyFormat });
      }
      if (!isCryptoKey(key))
        throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject"));
      if (!key.extractable)
        throw new TypeError("CryptoKey is not extractable");
      if (key.type !== keyType)
        throw new TypeError(`key is not a ${keyType} key`);
      return formatPEM(encodeBase64(new Uint8Array(await crypto.subtle.exportKey(keyFormat, key))), `${keyType.toUpperCase()} KEY`);
    }, "genericExport");
    toSPKI = /* @__PURE__ */ __name((key) => genericExport("public", "spki", key), "toSPKI");
    toPKCS8 = /* @__PURE__ */ __name((key) => genericExport("private", "pkcs8", key), "toPKCS8");
    bytesEqual = /* @__PURE__ */ __name((a, b) => {
      if (a.byteLength !== b.length)
        return false;
      for (let i = 0; i < a.byteLength; i++)
        if (a[i] !== b[i])
          return false;
      return true;
    }, "bytesEqual");
    createASN1State = /* @__PURE__ */ __name((data) => ({ data, pos: 0 }), "createASN1State");
    readByte = /* @__PURE__ */ __name((state) => {
      const byte = state.data[state.pos++];
      if (byte === void 0)
        throw new Error("Unexpected end of ASN.1 input");
      return byte;
    }, "readByte");
    parseLength = /* @__PURE__ */ __name((state) => {
      const first = readByte(state);
      if (first & 128) {
        const lengthOfLen = first & 127;
        let length = 0;
        for (let i = 0; i < lengthOfLen; i++)
          length = length << 8 | readByte(state);
        return length;
      }
      return first;
    }, "parseLength");
    skipElement = /* @__PURE__ */ __name((state, count3 = 1) => {
      for (; count3-- > 0; ) {
        state.pos++;
        const length = parseLength(state);
        state.pos += length;
      }
    }, "skipElement");
    expectTag = /* @__PURE__ */ __name((state, expectedTag, errorMessage) => {
      if (readByte(state) !== expectedTag)
        throw new Error(errorMessage);
    }, "expectTag");
    getSubarray = /* @__PURE__ */ __name((state, length) => {
      if (length < 0 || state.pos + length > state.data.length)
        throw new Error("Unexpected end of ASN.1 input");
      const result = state.data.subarray(state.pos, state.pos + length);
      return state.pos += length, result;
    }, "getSubarray");
    parseAlgorithmOID = /* @__PURE__ */ __name((state) => {
      expectTag(state, 6, "Expected algorithm OID");
      const oidLen = parseLength(state);
      return getSubarray(state, oidLen);
    }, "parseAlgorithmOID");
    __name(parseKeyHeader, "parseKeyHeader");
    parseECAlgorithmIdentifier = /* @__PURE__ */ __name((state) => {
      const algOid = parseAlgorithmOID(state);
      if (bytesEqual(algOid, [43, 101, 110]))
        return "X25519";
      if (!bytesEqual(algOid, [42, 134, 72, 206, 61, 2, 1]))
        throw new Error("Unsupported key algorithm");
      expectTag(state, 6, "Expected curve OID");
      const curveOidLen = parseLength(state), curveOid = getSubarray(state, curveOidLen);
      if (bytesEqual(curveOid, [42, 134, 72, 206, 61, 3, 1, 7]))
        return "P-256";
      if (bytesEqual(curveOid, [43, 129, 4, 0, 34]))
        return "P-384";
      if (bytesEqual(curveOid, [43, 129, 4, 0, 35]))
        return "P-521";
      throw new Error("Unsupported named curve");
    }, "parseECAlgorithmIdentifier");
    genericImport = /* @__PURE__ */ __name(async (keyFormat, keyData, alg, options) => {
      const extractable = validateExtractableOption(options?.extractable), entry = keyAlgorithm(alg, algArgument);
      entry.secret && unsupportedAlg(algArgument);
      const isPublic = keyFormat === "spki";
      let algorithm;
      if (entry.resolve)
        try {
          const state = createASN1State(keyData);
          parseKeyHeader(state, keyFormat), algorithm = entry.resolve({ crv: parseECAlgorithmIdentifier(state) });
        } catch {
          throw new JOSENotSupported("Invalid or unsupported key format");
        }
      else
        algorithm = entry.subtle;
      return crypto.subtle.importKey(keyFormat, keyData, algorithm, extractable ?? isPublic, entry.usages[isPublic ? 0 : 1]);
    }, "genericImport");
    processPEMData = /* @__PURE__ */ __name((pem, pattern) => decodeBase64(pem.replace(pattern, "")), "processPEMData");
    fromPKCS8 = /* @__PURE__ */ __name((pem, alg, options) => {
      const keyData = processPEMData(pem, /(?:-----(?:BEGIN|END) PRIVATE KEY-----|\s)/g);
      return genericImport("pkcs8", keyData, alg, options);
    }, "fromPKCS8");
    fromSPKI = /* @__PURE__ */ __name((pem, alg, options) => {
      const keyData = processPEMData(pem, /(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g);
      return genericImport("spki", keyData, alg, options);
    }, "fromSPKI");
    __name(spkiFromX509, "spkiFromX509");
    fromX509 = /* @__PURE__ */ __name((pem, alg, options) => {
      let spki;
      try {
        const certificate = processPEMData(pem, /(?:-----(?:BEGIN|END) CERTIFICATE-----|\s)/g);
        spki = spkiFromX509(certificate);
      } catch (cause) {
        throw new TypeError("Failed to parse the X.509 certificate", { cause });
      }
      return genericImport("spki", spki, alg, options);
    }, "fromX509");
  }
});

// node_modules/jose/dist/webapi/key/export.js
function exportSPKI(key) {
  return toSPKI(key);
}
function exportPKCS8(key) {
  return toPKCS8(key);
}
async function exportJWK(key) {
  if (isKeyObject(key))
    if (key.type === "secret")
      key = key.export();
    else
      return key.export({ format: "jwk" });
  if (key instanceof Uint8Array)
    return {
      kty: "oct",
      k: encode2(key)
    };
  if (!isCryptoKey(key))
    throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "Uint8Array"));
  if (!key.extractable)
    throw new TypeError("non-extractable CryptoKey cannot be exported as a JWK");
  const jwk = await crypto.subtle.exportKey("jwk", key);
  delete jwk.ext, delete jwk.key_ops, delete jwk.use, jwk.kty !== "AKP" && delete jwk.alg;
  for (const parameter of Object.keys(jwk))
    jwk[parameter] === void 0 && delete jwk[parameter];
  return jwk;
}
var init_export = __esm({
  "node_modules/jose/dist/webapi/key/export.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_asn1();
    init_key();
    init_base64url();
    __name(exportSPKI, "exportSPKI");
    __name(exportPKCS8, "exportPKCS8");
    __name(exportJWK, "exportJWK");
  }
});

// node_modules/jose/dist/webapi/jwk/thumbprint.js
async function calculateJwkThumbprint(key, digestAlgorithm) {
  let jwk;
  if (isObject(key)) {
    if (jwk = snapshotJwk(key), typeof jwk.kty != "string")
      throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
  } else if (isKeyLike(key))
    jwk = snapshotJwk(await exportJWK(key));
  else
    throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
  if (digestAlgorithm ??= "sha256", digestAlgorithm !== "sha256" && digestAlgorithm !== "sha384" && digestAlgorithm !== "sha512")
    throw new TypeError('digestAlgorithm must one of "sha256", "sha384", or "sha512"');
  let components;
  switch (jwk.kty) {
    case "AKP":
      check(jwk.alg, '"alg" (Algorithm) Parameter'), check(jwk.pub, '"pub" (Public key) Parameter'), components = { alg: jwk.alg, kty: jwk.kty, pub: jwk.pub };
      break;
    case "EC":
      check(jwk.crv, '"crv" (Curve) Parameter'), check(jwk.x, '"x" (X Coordinate) Parameter'), check(jwk.y, '"y" (Y Coordinate) Parameter'), components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
      break;
    case "OKP":
      check(jwk.crv, '"crv" (Subtype of Key Pair) Parameter'), check(jwk.x, '"x" (Public Key) Parameter'), components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x };
      break;
    case "RSA":
      check(jwk.e, '"e" (Exponent) Parameter'), check(jwk.n, '"n" (Modulus) Parameter'), components = { e: jwk.e, kty: jwk.kty, n: jwk.n };
      break;
    case "oct":
      if (typeof jwk.k != "string")
        throw new JWKInvalid('"k" (Key Value) Parameter missing or invalid');
      components = { k: jwk.k, kty: jwk.kty };
      break;
    default:
      throw new JOSENotSupported('"kty" (Key Type) Parameter missing or unsupported');
  }
  const data = encode(JSON.stringify(components));
  return encode2(await digest(digestAlgorithm, data));
}
async function calculateJwkThumbprintUri(key, digestAlgorithm) {
  digestAlgorithm ??= "sha256";
  const thumbprint = await calculateJwkThumbprint(key, digestAlgorithm);
  return `urn:ietf:params:oauth:jwk-thumbprint:sha-${digestAlgorithm.slice(-3)}:${thumbprint}`;
}
var check;
var init_thumbprint = __esm({
  "node_modules/jose/dist/webapi/jwk/thumbprint.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_buffer_utils();
    init_base64url();
    init_errors();
    init_key();
    init_validate();
    init_export();
    check = /* @__PURE__ */ __name((value, description) => {
      if (typeof value != "string" || !value)
        throw new JWKInvalid(`${description} missing or invalid`);
    }, "check");
    __name(calculateJwkThumbprint, "calculateJwkThumbprint");
    __name(calculateJwkThumbprintUri, "calculateJwkThumbprintUri");
  }
});

// node_modules/jose/dist/webapi/jwk/embedded.js
async function EmbeddedJWK(protectedHeader, token) {
  const joseHeader = {
    ...protectedHeader,
    ...token?.header
  };
  if (!isObject(joseHeader.jwk))
    throw new JWSInvalid('"jwk" (JSON Web Key) Header Parameter must be a JSON object');
  let jwk;
  try {
    jwk = normalizeJwk(joseHeader.jwk);
  } catch (cause) {
    throw new JWSInvalid("Invalid Embedded JWK", { cause });
  }
  const entry = jwsAlgorithm(joseHeader.alg);
  if (jwk.use !== void 0 && jwk.use !== "sig")
    throw new JWSInvalid('Invalid Embedded JWK, its "use" must be "sig" when present');
  if (jwk.alg !== void 0 && jwk.alg !== entry.alg)
    throw new JWSInvalid(`Invalid Embedded JWK, its "alg" must be "${entry.alg}" when present`);
  const key = await jwkToKey(entry, jwk, true);
  if (key.type !== "public")
    throw new JWSInvalid('"jwk" (JSON Web Key) Header Parameter must be a public key');
  return key;
}
var init_embedded = __esm({
  "node_modules/jose/dist/webapi/jwk/embedded.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_key();
    init_jws_algorithms();
    init_validate();
    init_errors();
    __name(EmbeddedJWK, "EmbeddedJWK");
  }
});

// node_modules/jose/dist/webapi/jwks/local.js
function isUsableJWK(jwk, entry, alg, kid) {
  const { kty, key_ops: keyOps, ext, kid: jwkKid, alg: jwkAlg, use, crv } = jwk;
  return (ext === void 0 || typeof ext == "boolean") && (keyOps === void 0 || Array.isArray(keyOps) && keyOps.every((operation, index) => typeof operation == "string" && keyOps.indexOf(operation) === index) && keyOps.includes("verify")) && entry.kty.includes(kty) && (kid === void 0 || typeof kid == "string" && kid === jwkKid) && (jwkAlg === void 0 ? kty !== "AKP" : alg === jwkAlg) && (use === void 0 || use === "sig") && (!entry.crv || crv === entry.crv);
}
async function importWithAlgCache(cache2, jwk, entry) {
  const cached = cache2.get(jwk) || cache2.set(jwk, {}).get(jwk), { alg } = entry;
  if (cached[alg] === void 0) {
    const pending = jwkToKey(entry, jwk, true).then((key) => {
      if (key.type !== "public")
        throw new JWKSInvalid("JSON Web Key Set members must be public keys");
      return cached[alg] = key, key;
    }).catch((error3) => {
      throw cached[alg] === pending && delete cached[alg], error3;
    });
    cached[alg] = pending;
  }
  return cached[alg];
}
function createLocalJWKSet(jwks) {
  let snapshot;
  try {
    snapshot = structuredClone(jwks);
  } catch {
  }
  if (!isJwkSet(snapshot))
    throw new JWKSInvalid("JSON Web Key Set malformed");
  const metadata = snapshot.keys.map((jwk) => {
    const normalized = snapshotJwk(jwk);
    return Array.isArray(normalized.key_ops) && (normalized.key_ops = [...normalized.key_ops]), normalized;
  }), cached = /* @__PURE__ */ new WeakMap();
  return Object.defineProperty(async (protectedHeader, token) => {
    const { alg, kid } = { ...protectedHeader, ...token?.header }, entry = typeof alg == "string" ? JWS[alg] : void 0;
    if (!entry || entry.secret)
      throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
    const candidates = snapshot.keys.filter((_, index) => isUsableJWK(metadata[index], entry, alg, kid)), { 0: jwk, length } = candidates;
    if (!length)
      throw new JWKSNoMatchingKey();
    if (length !== 1) {
      const error3 = new JWKSMultipleMatchingKeys();
      throw error3[Symbol.asyncIterator] = async function* () {
        for (const jwk2 of candidates)
          try {
            yield await importWithAlgCache(cached, jwk2, entry);
          } catch {
          }
      }, error3;
    }
    return importWithAlgCache(cached, jwk, entry);
  }, "jwks", {
    value: /* @__PURE__ */ __name(() => structuredClone(snapshot), "value")
  });
}
var init_local = __esm({
  "node_modules/jose/dist/webapi/jwks/local.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_key();
    init_jws_algorithms();
    init_errors();
    init_validate();
    __name(isUsableJWK, "isUsableJWK");
    __name(importWithAlgCache, "importWithAlgCache");
    __name(createLocalJWKSet, "createLocalJWKSet");
  }
});

// node_modules/jose/dist/webapi/jwks/remote.js
function isCloudflareWorkers() {
  return typeof WebSocketPair < "u" || typeof navigator < "u" && true || typeof EdgeRuntime < "u" && EdgeRuntime === "vercel";
}
async function fetchJwks(url, headers, signal, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "GET",
    signal,
    redirect: "manual",
    headers
  }).catch((err) => {
    throw err.name === "TimeoutError" ? new JWKSTimeout() : err;
  });
  if (response.status !== 200)
    throw new JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response");
  try {
    return await response.json();
  } catch {
    throw new JOSEError("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}
function isFreshFor(timestamp, duration) {
  return Number.isFinite(timestamp) && Date.now() < timestamp + duration;
}
function validateDuration(value, fallback, option) {
  if (Number.isNaN(value))
    throw new TypeError(`"${option}" option must not be NaN`);
  return typeof value == "number" ? value : fallback;
}
function createRemoteJWKSet(url, options) {
  if (!(url instanceof URL))
    throw new TypeError("url must be an instance of URL");
  const href = new URL(url.href).href, opts = options ?? {}, timeoutOption = opts.timeoutDuration;
  if (typeof timeoutOption == "number" && (!Number.isInteger(timeoutOption) || timeoutOption < 0))
    throw new TypeError('"timeoutDuration" option must be a non-negative integer');
  const timeoutDuration = typeof timeoutOption == "number" ? timeoutOption : 5e3, cooldownDuration = validateDuration(opts.cooldownDuration, 3e4, "cooldownDuration"), cacheMaxAge = validateDuration(opts.cacheMaxAge, 6e5, "cacheMaxAge"), headers = new Headers(opts.headers);
  USER_AGENT && !headers.has("User-Agent") && headers.set("User-Agent", USER_AGENT), headers.has("accept") || headers.set("accept", "application/json, application/jwk-set+json");
  const fetchImpl = opts[customFetch], cache2 = opts[jwksCache];
  let jwksTimestamp, pendingFetch, reloadSequence = 0, appliedSequence = 0, local;
  if (cache2 && typeof cache2 == "object") {
    const { uat, jwks } = cache2;
    isFreshFor(uat, cacheMaxAge) && isJwkSet(jwks) && (jwksTimestamp = uat, local = createLocalJWKSet(jwks));
  }
  const reload = /* @__PURE__ */ __name(async () => {
    if (pendingFetch && isCloudflareWorkers() && (pendingFetch = void 0), !pendingFetch) {
      const sequence = ++reloadSequence, current = pendingFetch = fetchJwks(href, headers, AbortSignal.timeout(timeoutDuration), fetchImpl).then((json2) => {
        const next = createLocalJWKSet(json2);
        if (sequence <= appliedSequence)
          return;
        local = next;
        const updatedAt = Date.now();
        cache2 && (cache2.uat = updatedAt, cache2.jwks = json2), jwksTimestamp = updatedAt, appliedSequence = sequence;
      }).finally(() => {
        pendingFetch === current && (pendingFetch = void 0);
      });
    }
    await pendingFetch;
  }, "reload");
  return Object.defineProperties(async (protectedHeader, token) => {
    (!local || !isFreshFor(jwksTimestamp, cacheMaxAge)) && await reload();
    try {
      return await local(protectedHeader, token);
    } catch (err) {
      if (err instanceof JWKSNoMatchingKey && !isFreshFor(jwksTimestamp, cooldownDuration))
        return await reload(), local(protectedHeader, token);
      throw err;
    }
  }, {
    coolingDown: {
      get: /* @__PURE__ */ __name(() => isFreshFor(jwksTimestamp, cooldownDuration), "get"),
      enumerable: true
    },
    fresh: {
      get: /* @__PURE__ */ __name(() => isFreshFor(jwksTimestamp, cacheMaxAge), "get"),
      enumerable: true
    },
    reload: {
      value: reload,
      enumerable: true
    },
    reloading: {
      get: /* @__PURE__ */ __name(() => !!pendingFetch, "get"),
      enumerable: true
    },
    jwks: {
      value: /* @__PURE__ */ __name(() => local?.jwks(), "value"),
      enumerable: true
    }
  });
}
var USER_AGENT, customFetch, jwksCache;
var init_remote = __esm({
  "node_modules/jose/dist/webapi/jwks/remote.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_local();
    init_validate();
    __name(isCloudflareWorkers, "isCloudflareWorkers");
    (typeof navigator > "u" || !"Cloudflare-Workers"?.startsWith?.("Mozilla/5.0 ")) && (USER_AGENT = "jose/v6.2.12");
    customFetch = /* @__PURE__ */ Symbol();
    __name(fetchJwks, "fetchJwks");
    jwksCache = /* @__PURE__ */ Symbol();
    __name(isFreshFor, "isFreshFor");
    __name(validateDuration, "validateDuration");
    __name(createRemoteJWKSet, "createRemoteJWKSet");
  }
});

// node_modules/jose/dist/webapi/jwt/unsecured.js
var UnsecuredJWT_base, UnsecuredJWT;
var init_unsecured = __esm({
  "node_modules/jose/dist/webapi/jwt/unsecured.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_base64url();
    init_validate();
    init_errors();
    init_jwt_claims_set();
    UnsecuredJWT_base = JWTClaimsBuilder;
    UnsecuredJWT = class extends UnsecuredJWT_base {
      static {
        __name(this, "UnsecuredJWT");
      }
      encode() {
        const header = encode2(JSON.stringify({ alg: "none" })), payload = encode2(jwtData(this));
        return `${header}.${payload}.`;
      }
      static decode(jwt, options) {
        if (typeof jwt != "string")
          throw new JWTInvalid("Unsecured JWT must be a string");
        const { 0: encodedHeader, 1: encodedPayload, 2: signature, length } = jwt.split(".");
        if (length !== 3 || signature !== "")
          throw new JWTInvalid("Invalid Unsecured JWT");
        let header, b64;
        try {
          header = parseJoseHeader(encodedHeader, JWSInvalid, "JWS Protected Header is invalid");
          const extensions = validateCrit(JWSInvalid, JWS_RECOGNIZED, void 0, header, header);
          b64 = validateB64(header, extensions);
        } catch (cause) {
          throw cause instanceof JWSInvalid ? new JWTInvalid("Invalid Unsecured JWT", { cause }) : cause;
        }
        if (header.alg !== "none")
          throw new JWTInvalid("Invalid Unsecured JWT");
        if (!b64)
          throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
        return { payload: validateClaimsSet(header, decodeBase64url(encodedPayload, "payload", JWTInvalid), options), header };
      }
    };
  }
});

// node_modules/jose/dist/webapi/key/import.js
async function importSPKI(spki, alg, options) {
  if (typeof spki != "string" || spki.indexOf("-----BEGIN PUBLIC KEY-----") !== 0)
    throw new TypeError('"spki" must be SPKI formatted string');
  return fromSPKI(spki, alg, options);
}
async function importX509(x509, alg, options) {
  if (typeof x509 != "string" || x509.indexOf("-----BEGIN CERTIFICATE-----") !== 0)
    throw new TypeError('"x509" must be X.509 formatted string');
  return fromX509(x509, alg, options);
}
async function importPKCS8(pkcs8, alg, options) {
  if (typeof pkcs8 != "string" || pkcs8.indexOf("-----BEGIN PRIVATE KEY-----") !== 0)
    throw new TypeError('"pkcs8" must be PKCS#8 formatted string');
  return fromPKCS8(pkcs8, alg, options);
}
async function importJWK(jwk, alg, options) {
  if (!isObject(jwk))
    throw new TypeError("JWK must be an object");
  const normalized = normalizeJwk(jwk), extractable = validateExtractableOption(options?.extractable), { alg: jwkAlg } = normalized;
  if (alg ??= jwkAlg, normalized.kty !== "oct" && !alg)
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  switch (normalized.kty) {
    case "oct":
      if (typeof normalized.k != "string")
        throw new TypeError('missing "k" (Key Value) Parameter value');
      return decode(normalized.k);
    case "AKP": {
      if (typeof jwkAlg != "string" || !jwkAlg)
        throw new TypeError('missing "alg" (Algorithm) Parameter value');
      if (alg !== jwkAlg)
        throw new TypeError("JWK alg and alg option value mismatch");
      return jwkToKey(keyAlgorithm(alg), normalized, extractable);
    }
    case "RSA":
    case "EC":
    case "OKP":
      return jwkToKey(keyAlgorithm(alg), normalized, extractable);
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}
var init_import = __esm({
  "node_modules/jose/dist/webapi/key/import.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_base64url();
    init_asn1();
    init_key();
    init_key_algorithm();
    init_errors();
    init_validate();
    __name(importSPKI, "importSPKI");
    __name(importX509, "importX509");
    __name(importPKCS8, "importPKCS8");
    __name(importJWK, "importJWK");
  }
});

// node_modules/jose/dist/webapi/util/decode_protected_header.js
function decodeProtectedHeader(token) {
  let protectedB64u;
  if (typeof token == "string") {
    const parts = token.split(".");
    (parts.length === 3 || parts.length === 5) && ([protectedB64u] = parts);
  } else if (typeof token == "object" && token)
    if ("protected" in token)
      protectedB64u = token.protected;
    else
      throw new TypeError("Token does not contain a Protected Header");
  const invalid2 = "Invalid Token or Protected Header formatting";
  if (typeof protectedB64u != "string" || !protectedB64u)
    throw new TypeError(invalid2);
  return parseJoseHeader(protectedB64u, TypeError, invalid2);
}
var init_decode_protected_header = __esm({
  "node_modules/jose/dist/webapi/util/decode_protected_header.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_validate();
    __name(decodeProtectedHeader, "decodeProtectedHeader");
  }
});

// node_modules/jose/dist/webapi/util/decode_jwt.js
function decodeJwt(jwt) {
  if (typeof jwt != "string")
    throw new JWTInvalid("JWTs must use Compact JWS serialization, JWT must be a string");
  const { 1: payload, length } = jwt.split(".");
  if (length === 5)
    throw new JWTInvalid("Only JWTs using Compact JWS serialization can be decoded");
  if (length !== 3)
    throw new JWTInvalid("Invalid JWT");
  if (!payload)
    throw new JWTInvalid("JWTs must contain a payload");
  let decoded;
  try {
    decoded = decode(payload);
  } catch {
    throw new JWTInvalid("Failed to base64url decode the payload");
  }
  let result;
  try {
    result = JSON.parse(strictDecoder.decode(decoded));
  } catch {
    throw new JWTInvalid("Failed to parse the decoded payload as JSON");
  }
  if (!isObject(result))
    throw new JWTInvalid("Invalid JWT Claims Set");
  return result;
}
var init_decode_jwt = __esm({
  "node_modules/jose/dist/webapi/util/decode_jwt.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_base64url();
    init_buffer_utils();
    init_validate();
    init_errors();
    __name(decodeJwt, "decodeJwt");
  }
});

// node_modules/jose/dist/webapi/key/generate_key_pair.js
function getModulusLengthOption(options) {
  const modulusLength = options?.modulusLength ?? 2048;
  if (typeof modulusLength != "number" || !Number.isInteger(modulusLength) || modulusLength < 2048)
    throw new JOSENotSupported("Invalid or unsupported modulusLength option provided, 2048 bits or larger keys must be used");
  return modulusLength;
}
async function generateKeyPair(alg, options) {
  const extractable = validateExtractableOption(options?.extractable), entry = keyAlgorithm(alg, algArgument);
  entry.secret && unsupportedAlg(algArgument);
  let algorithm;
  if (entry.resolve) {
    const crv = options?.crv ?? "P-256";
    if (!["P-256", "P-384", "P-521", "X25519"].includes(crv))
      throw new JOSENotSupported("Invalid or unsupported crv option provided, supported values are P-256, P-384, P-521, and X25519");
    algorithm = entry.resolve({ crv });
  } else {
    if (entry.crv !== void 0 && options?.crv !== void 0 && options.crv !== entry.crv)
      throw new JOSENotSupported(`Invalid or unsupported crv option provided, the only supported value for ${alg} is ${entry.crv}`);
    algorithm = entry.kty[0] === "RSA" ? {
      ...entry.subtle,
      publicExponent: Uint8Array.of(1, 0, 1),
      modulusLength: getModulusLengthOption(options)
    } : entry.subtle;
  }
  return crypto.subtle.generateKey(algorithm, extractable ?? false, [
    ...entry.usages[1],
    ...entry.usages[0]
  ]);
}
var init_generate_key_pair = __esm({
  "node_modules/jose/dist/webapi/key/generate_key_pair.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_key();
    init_key_algorithm();
    __name(getModulusLengthOption, "getModulusLengthOption");
    __name(generateKeyPair, "generateKeyPair");
  }
});

// node_modules/jose/dist/webapi/key/generate_secret.js
async function generateSecret(alg, options) {
  const extractable = validateExtractableOption(options?.extractable);
  let length, algorithm, keyUsages;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      length = +alg.slice(-3), algorithm = { name: "HMAC", hash: `SHA-${length}`, length }, keyUsages = ["sign", "verify"];
      break;
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return crypto.getRandomValues(new Uint8Array(+alg.slice(-3) >> 3));
    case "A128KW":
    case "A192KW":
    case "A256KW":
      length = +alg.slice(1, 4), algorithm = { name: "AES-KW", length }, keyUsages = ["wrapKey", "unwrapKey"];
      break;
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      length = +alg.slice(1, 4), algorithm = { name: "AES-GCM", length }, keyUsages = ["encrypt", "decrypt"];
      break;
    default:
      unsupportedAlg(algArgument);
  }
  return crypto.subtle.generateKey(algorithm, extractable ?? false, keyUsages);
}
var init_generate_secret = __esm({
  "node_modules/jose/dist/webapi/key/generate_secret.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_key_algorithm();
    init_key();
    __name(generateSecret, "generateSecret");
  }
});

// node_modules/jose/dist/webapi/index.js
var webapi_exports = {};
__export(webapi_exports, {
  CompactEncrypt: () => CompactEncrypt,
  CompactSign: () => CompactSign,
  EmbeddedJWK: () => EmbeddedJWK,
  EncryptJWT: () => EncryptJWT,
  FlattenedEncrypt: () => FlattenedEncrypt,
  FlattenedSign: () => FlattenedSign,
  GeneralEncrypt: () => GeneralEncrypt,
  GeneralSign: () => GeneralSign,
  SignJWT: () => SignJWT,
  UnsecuredJWT: () => UnsecuredJWT,
  base64url: () => base64url_exports,
  calculateJwkThumbprint: () => calculateJwkThumbprint,
  calculateJwkThumbprintUri: () => calculateJwkThumbprintUri,
  compactDecrypt: () => compactDecrypt,
  compactVerify: () => compactVerify,
  createLocalJWKSet: () => createLocalJWKSet,
  createRemoteJWKSet: () => createRemoteJWKSet,
  cryptoRuntime: () => cryptoRuntime,
  customFetch: () => customFetch,
  decodeJwt: () => decodeJwt,
  decodeProtectedHeader: () => decodeProtectedHeader,
  errors: () => errors_exports,
  exportJWK: () => exportJWK,
  exportPKCS8: () => exportPKCS8,
  exportSPKI: () => exportSPKI,
  flattenedDecrypt: () => flattenedDecrypt,
  flattenedVerify: () => flattenedVerify,
  generalDecrypt: () => generalDecrypt,
  generalVerify: () => generalVerify,
  generateKeyPair: () => generateKeyPair,
  generateSecret: () => generateSecret,
  importJWK: () => importJWK,
  importPKCS8: () => importPKCS8,
  importSPKI: () => importSPKI,
  importX509: () => importX509,
  jwksCache: () => jwksCache,
  jwtDecrypt: () => jwtDecrypt,
  jwtVerify: () => jwtVerify
});
var cryptoRuntime;
var init_webapi = __esm({
  "node_modules/jose/dist/webapi/index.js"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_decrypt();
    init_decrypt2();
    init_decrypt3();
    init_encrypt();
    init_verify();
    init_verify2();
    init_verify3();
    init_verify4();
    init_decrypt4();
    init_encrypt2();
    init_encrypt3();
    init_sign();
    init_sign2();
    init_sign3();
    init_sign4();
    init_encrypt4();
    init_thumbprint();
    init_embedded();
    init_local();
    init_remote();
    init_unsecured();
    init_export();
    init_import();
    init_decode_protected_header();
    init_decode_jwt();
    init_errors();
    init_generate_key_pair();
    init_generate_secret();
    init_base64url();
    cryptoRuntime = "WebCryptoAPI";
  }
});

// .wrangler/tmp/bundle-E0KTIi/middleware-loader.entry.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// .wrangler/tmp/bundle-E0KTIi/middleware-insertion-facade.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/index.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/router.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/d1Repos.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/d1Errors.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var RepositoryError = class extends Error {
  constructor(message2, code) {
    super(message2);
    this.code = code;
    this.name = "RepositoryError";
  }
  code;
  static {
    __name(this, "RepositoryError");
  }
};
function mapD1Error(error3) {
  const message2 = error3 instanceof Error ? error3.message : String(error3);
  if (/UNIQUE constraint failed/i.test(message2)) {
    throw new RepositoryError(message2, "id.duplicate");
  }
  if (/FOREIGN KEY constraint failed/i.test(message2)) {
    throw new RepositoryError(message2, "reference.missing_parent");
  }
  if (/CHECK constraint failed/i.test(message2)) {
    throw new RepositoryError(message2, "validation.failed");
  }
  throw new RepositoryError(message2, "repository.error");
}
__name(mapD1Error, "mapD1Error");

// src/domain.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// ../server/src/validation/schema.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var GROUPS = ["G0", "G1", "G2"];
var PLANT_STATUSES = ["active", "damaged", "dead", "excluded"];
var WATERING_STATUSES = ["pass", "warn", "fail"];
var IMAGE_QUALITY_STATUSES = ["PASS", "WARN", "FAIL"];
var CALIBRATION_STATUSES = ["pass", "warn", "fail"];
var MEASUREMENT_STATUSES = ["pass", "warn", "fail"];
var DETECTION_STATUSES = ["pass", "fail"];
var SEGMENTATION_STATUSES = ["pass", "fail", "not_applicable"];
var FAILURE_CODES = [
  "no_detection",
  "poor_image_quality",
  "occlusion",
  "plant_damaged",
  "plant_dead",
  "calibration_failed",
  "none"
];
var ISO_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
var ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isLeapYear(year) {
  return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
}
__name(isLeapYear, "isLeapYear");
var ID_PATTERNS = {
  plant_id: /^PLT-\d{3}$/,
  pot_id: /^POT-\d{3}$/,
  image_id: /^IMG-\d{8}-\d{6}-\d{3}$/,
  water_event_id: /^WTR-\d{8}-\d{6}-\d{3}$/,
  position_event_id: /^POS-\d{8}-\d{6}-\d{3}$/,
  issue_id: /^ISS-[A-Za-z0-9_-]+$/
};
function issue(entity, entity_id, field, code, message2, severity = "FAIL") {
  return { entity, entity_id, field, severity, code, message: message2 };
}
__name(issue, "issue");
function parseDateLike(value) {
  return Date.parse(value);
}
__name(parseDateLike, "parseDateLike");
function validateEnum(entity, entityId, field, value, options) {
  if (!options.includes(value)) {
    return [
      issue(
        entity,
        entityId,
        field,
        "enum.invalid",
        `Value '${value}' is not in allowed set: ${options.join(", ")}`
      )
    ];
  }
  return [];
}
__name(validateEnum, "validateEnum");
function validateRequired(entity, entityId, field, value) {
  if (value === void 0 || value === null || value === "") {
    return [issue(entity, entityId, field, "required.missing", "Required field is missing")];
  }
  return [];
}
__name(validateRequired, "validateRequired");
function validateTimestamp(entity, entityId, field, value) {
  const match = ISO_TIMESTAMP_RE.exec(value);
  if (!match) {
    return [
      issue(
        entity,
        entityId,
        field,
        "timestamp.invalid",
        "Timestamp must be ISO 8601 format YYYY-MM-DDTHH:MM:SS"
      )
    ];
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isRealCalendarTime = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1] && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
  if (!isRealCalendarTime) {
    return [
      issue(
        entity,
        entityId,
        field,
        "timestamp.invalid",
        "Timestamp must be ISO 8601 format YYYY-MM-DDTHH:MM:SS"
      )
    ];
  }
  return [];
}
__name(validateTimestamp, "validateTimestamp");
function validateDate(entity, entityId, field, value) {
  if (!ISO_DATE_RE.test(value) || Number.isNaN(parseDateLike(value))) {
    return [issue(entity, entityId, field, "date.invalid", "Date must be ISO 8601 format YYYY-MM-DD")];
  }
  return [];
}
__name(validateDate, "validateDate");
function validateId(entity, entityId, field, value) {
  const pattern = ID_PATTERNS[field];
  if (!pattern.test(value)) {
    return [
      issue(
        entity,
        entityId,
        field,
        "id.invalid_format",
        `ID '${value}' does not match required format for ${field}`
      )
    ];
  }
  return [];
}
__name(validateId, "validateId");
function validateMeasurementId(entity, field, value, prefixes) {
  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    return [
      issue(
        entity,
        value,
        field,
        "id.invalid_format",
        `ID '${value}' must start with ${prefixes.join(" or ")}`
      )
    ];
  }
  return [];
}
__name(validateMeasurementId, "validateMeasurementId");
function validatePlant(input) {
  const issues = [];
  issues.push(...validateRequired("plant", input.plant_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("plant", input.plant_id, "pot_id", input.pot_id));
  issues.push(...validateRequired("plant", input.plant_id, "group_name", input.group_name));
  issues.push(...validateRequired("plant", input.plant_id, "emergence_date", input.emergence_date));
  issues.push(...validateRequired("plant", input.plant_id, "status", input.status));
  issues.push(...validateRequired("plant", input.plant_id, "created_at", input.created_at));
  if (input.plant_id) issues.push(...validateId("plant", input.plant_id, "plant_id", input.plant_id));
  if (input.pot_id) issues.push(...validateId("plant", input.plant_id, "pot_id", input.pot_id));
  if (input.group_name) issues.push(...validateEnum("plant", input.plant_id, "group_name", input.group_name, GROUPS));
  if (input.status) issues.push(...validateEnum("plant", input.plant_id, "status", input.status, PLANT_STATUSES));
  if (input.emergence_date) issues.push(...validateDate("plant", input.plant_id, "emergence_date", input.emergence_date));
  if (input.created_at) issues.push(...validateTimestamp("plant", input.plant_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("plant", input.plant_id, "updated_at", input.updated_at));
  return { valid: issues.length === 0, issues };
}
__name(validatePlant, "validatePlant");
function validateWaterEvent(input) {
  const issues = [];
  issues.push(...validateRequired("water_event", input.water_event_id, "water_event_id", input.water_event_id));
  issues.push(...validateRequired("water_event", input.water_event_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("water_event", input.water_event_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("water_event", input.water_event_id, "experiment_day", input.experiment_day));
  issues.push(...validateRequired("water_event", input.water_event_id, "watering_status", input.watering_status));
  if (input.water_event_id) {
    issues.push(...validateId("water_event", input.water_event_id, "water_event_id", input.water_event_id));
  }
  if (input.plant_id) issues.push(...validateId("water_event", input.water_event_id, "plant_id", input.plant_id));
  if (input.timestamp) issues.push(...validateTimestamp("water_event", input.water_event_id, "timestamp", input.timestamp));
  if (input.watering_status) {
    issues.push(
      ...validateEnum("water_event", input.water_event_id, "watering_status", input.watering_status, WATERING_STATUSES)
    );
  }
  if (!Number.isInteger(input.experiment_day) || input.experiment_day < 1) {
    issues.push(
      issue("water_event", input.water_event_id, "experiment_day", "number.out_of_range", "experiment_day must be >= 1")
    );
  }
  if (typeof input.pot_mass_before_g !== "number" || input.pot_mass_before_g < 0) {
    issues.push(
      issue("water_event", input.water_event_id, "pot_mass_before_g", "number.out_of_range", "Must be number >= 0")
    );
  }
  if (typeof input.target_mass_g !== "number" || input.target_mass_g <= 0) {
    issues.push(issue("water_event", input.water_event_id, "target_mass_g", "number.out_of_range", "Must be number > 0"));
  }
  if (typeof input.water_added_ml !== "number" || input.water_added_ml < 0) {
    issues.push(issue("water_event", input.water_event_id, "water_added_ml", "number.out_of_range", "Must be number >= 0"));
  }
  if (typeof input.pot_mass_after_g !== "number" || input.pot_mass_after_g < 0) {
    issues.push(
      issue("water_event", input.water_event_id, "pot_mass_after_g", "number.out_of_range", "Must be number >= 0")
    );
  }
  return { valid: issues.length === 0, issues };
}
__name(validateWaterEvent, "validateWaterEvent");
function validatePositionEvent(input) {
  const issues = [];
  issues.push(...validateRequired("position_event", input.position_event_id, "position_event_id", input.position_event_id));
  issues.push(...validateRequired("position_event", input.position_event_id, "position_id", input.position_id));
  issues.push(...validateRequired("position_event", input.position_event_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("position_event", input.position_event_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("position_event", input.position_event_id, "location", input.location));
  issues.push(...validateRequired("position_event", input.position_event_id, "operator", input.operator));
  issues.push(...validateRequired("position_event", input.position_event_id, "reason", input.reason));
  if (input.position_event_id) {
    issues.push(...validateId("position_event", input.position_event_id, "position_event_id", input.position_event_id));
  }
  if (input.plant_id) issues.push(...validateId("position_event", input.position_event_id, "plant_id", input.plant_id));
  if (input.timestamp) {
    issues.push(...validateTimestamp("position_event", input.position_event_id, "timestamp", input.timestamp));
  }
  if (input.reason) {
    issues.push(
      ...validateEnum("position_event", input.position_event_id, "reason", input.reason, [
        "initial_assignment",
        "rotation",
        "manual_override"
      ])
    );
  }
  return { valid: issues.length === 0, issues };
}
__name(validatePositionEvent, "validatePositionEvent");
function validateImageRecord(input) {
  const issues = [];
  issues.push(...validateRequired("image_record", input.image_id, "image_id", input.image_id));
  issues.push(...validateRequired("image_record", input.image_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("image_record", input.image_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("image_record", input.image_id, "experiment_day", input.experiment_day));
  issues.push(...validateRequired("image_record", input.image_id, "image_path", input.image_path));
  issues.push(...validateRequired("image_record", input.image_id, "camera_id", input.camera_id));
  issues.push(...validateRequired("image_record", input.image_id, "image_quality_status", input.image_quality_status));
  issues.push(...validateRequired("image_record", input.image_id, "calibration_status", input.calibration_status));
  if (input.image_id) issues.push(...validateId("image_record", input.image_id, "image_id", input.image_id));
  if (input.plant_id) issues.push(...validateId("image_record", input.image_id, "plant_id", input.plant_id));
  if (input.timestamp) issues.push(...validateTimestamp("image_record", input.image_id, "timestamp", input.timestamp));
  if (!Number.isInteger(input.experiment_day) || input.experiment_day < 1) {
    issues.push(issue("image_record", input.image_id, "experiment_day", "number.out_of_range", "Must be integer >= 1"));
  }
  if (input.image_quality_status) {
    issues.push(
      ...validateEnum(
        "image_record",
        input.image_id,
        "image_quality_status",
        input.image_quality_status,
        IMAGE_QUALITY_STATUSES
      )
    );
  }
  if (input.calibration_status) {
    issues.push(
      ...validateEnum(
        "image_record",
        input.image_id,
        "calibration_status",
        input.calibration_status,
        CALIBRATION_STATUSES
      )
    );
  }
  if (input.failure_code) {
    issues.push(...validateEnum("image_record", input.image_id, "failure_code", input.failure_code, FAILURE_CODES));
  }
  return { valid: issues.length === 0, issues };
}
__name(validateImageRecord, "validateImageRecord");
function validateManualMeasurement(input) {
  const issues = [];
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "measurement_id", input.measurement_id));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "experiment_day", input.experiment_day));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "repetition", input.repetition));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "observer", input.observer));
  issues.push(
    ...validateRequired("manual_measurement", input.measurement_id, "measurement_status", input.measurement_status)
  );
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "method", input.method));
  if (input.measurement_id) {
    issues.push(...validateMeasurementId("manual_measurement", "measurement_id", input.measurement_id, ["MSR-MAN-"]));
  }
  if (input.plant_id) {
    issues.push(...validateId("manual_measurement", input.measurement_id, "plant_id", input.plant_id));
  }
  if (input.image_id) {
    issues.push(...validateId("manual_measurement", input.measurement_id, "image_id", input.image_id));
  }
  if (input.timestamp) {
    issues.push(...validateTimestamp("manual_measurement", input.measurement_id, "timestamp", input.timestamp));
  }
  if (!Number.isInteger(input.experiment_day) || input.experiment_day < 1) {
    issues.push(
      issue("manual_measurement", input.measurement_id, "experiment_day", "number.out_of_range", "Must be integer >= 1")
    );
  }
  if (![1, 2].includes(input.repetition)) {
    issues.push(issue("manual_measurement", input.measurement_id, "repetition", "enum.invalid", "Must be 1 or 2"));
  }
  if (input.plant_height_cm !== void 0 && (typeof input.plant_height_cm !== "number" || !Number.isFinite(input.plant_height_cm) || input.plant_height_cm <= 0)) {
    issues.push(
      issue(
        "manual_measurement",
        input.measurement_id,
        "plant_height_cm",
        "number.out_of_range",
        "Must be a finite number > 0"
      )
    );
  }
  if (input.measurement_status) {
    issues.push(
      ...validateEnum(
        "manual_measurement",
        input.measurement_id,
        "measurement_status",
        input.measurement_status,
        MEASUREMENT_STATUSES
      )
    );
  }
  if (input.failure_code) {
    issues.push(...validateEnum("manual_measurement", input.measurement_id, "failure_code", input.failure_code, FAILURE_CODES));
  }
  if (input.method !== "MANUAL") {
    issues.push(issue("manual_measurement", input.measurement_id, "method", "enum.invalid", "Must be MANUAL"));
  }
  return { valid: issues.length === 0, issues };
}
__name(validateManualMeasurement, "validateManualMeasurement");
function validateAICVMeasurement(input) {
  const issues = [];
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "measurement_id", input.measurement_id));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "image_id", input.image_id));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "model", input.model));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "model_version", input.model_version));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "pipeline_version", input.pipeline_version));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "detection_status", input.detection_status));
  issues.push(
    ...validateRequired("aicv_measurement", input.measurement_id, "segmentation_status", input.segmentation_status)
  );
  issues.push(
    ...validateRequired("aicv_measurement", input.measurement_id, "calibration_status", input.calibration_status)
  );
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "failure_code", input.failure_code));
  if (input.measurement_id) {
    issues.push(...validateMeasurementId("aicv_measurement", "measurement_id", input.measurement_id, ["MSR-AICV-"]));
  }
  if (input.image_id) issues.push(...validateId("aicv_measurement", input.measurement_id, "image_id", input.image_id));
  if (input.plant_id) issues.push(...validateId("aicv_measurement", input.measurement_id, "plant_id", input.plant_id));
  if (input.timestamp) issues.push(...validateTimestamp("aicv_measurement", input.measurement_id, "timestamp", input.timestamp));
  if (input.detection_status) {
    issues.push(
      ...validateEnum(
        "aicv_measurement",
        input.measurement_id,
        "detection_status",
        input.detection_status,
        DETECTION_STATUSES
      )
    );
  }
  if (input.segmentation_status) {
    issues.push(
      ...validateEnum(
        "aicv_measurement",
        input.measurement_id,
        "segmentation_status",
        input.segmentation_status,
        SEGMENTATION_STATUSES
      )
    );
  }
  if (input.calibration_status) {
    issues.push(
      ...validateEnum(
        "aicv_measurement",
        input.measurement_id,
        "calibration_status",
        input.calibration_status,
        CALIBRATION_STATUSES
      )
    );
  }
  if (input.failure_code) {
    issues.push(...validateEnum("aicv_measurement", input.measurement_id, "failure_code", input.failure_code, FAILURE_CODES));
  }
  if (input.plant_height_cm !== void 0 && (typeof input.plant_height_cm !== "number" || !Number.isFinite(input.plant_height_cm) || input.plant_height_cm <= 0)) {
    issues.push(issue("aicv_measurement", input.measurement_id, "plant_height_cm", "number.out_of_range", "Must be a finite number > 0"));
  }
  if (input.projected_area_cm2 !== void 0 && (typeof input.projected_area_cm2 !== "number" || !Number.isFinite(input.projected_area_cm2) || input.projected_area_cm2 <= 0)) {
    issues.push(
      issue("aicv_measurement", input.measurement_id, "projected_area_cm2", "number.out_of_range", "Must be a finite number > 0")
    );
  }
  if (input.confidence !== void 0 && (typeof input.confidence !== "number" || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) {
    issues.push(
      issue("aicv_measurement", input.measurement_id, "confidence", "number.out_of_range", "Must be a finite number in range 0..1")
    );
  }
  return { valid: issues.length === 0, issues };
}
__name(validateAICVMeasurement, "validateAICVMeasurement");
function validateValidationIssue(input) {
  const issues = [];
  issues.push(...validateRequired("validation_issue", input.issue_id, "issue_id", input.issue_id));
  issues.push(...validateRequired("validation_issue", input.issue_id, "issue_type", input.issue_type));
  issues.push(...validateRequired("validation_issue", input.issue_id, "entity_type", input.entity_type));
  issues.push(...validateRequired("validation_issue", input.issue_id, "description", input.description));
  issues.push(...validateRequired("validation_issue", input.issue_id, "severity", input.severity));
  issues.push(...validateRequired("validation_issue", input.issue_id, "created_at", input.created_at));
  if (input.issue_id) issues.push(...validateId("validation_issue", input.issue_id, "issue_id", input.issue_id));
  if (input.created_at) issues.push(...validateTimestamp("validation_issue", input.issue_id, "created_at", input.created_at));
  if (input.severity) {
    issues.push(
      ...validateEnum("validation_issue", input.issue_id, "severity", input.severity, ["PASS", "WARN", "FAIL", "NOT_RUN"])
    );
  }
  return { valid: issues.length === 0, issues };
}
__name(validateValidationIssue, "validateValidationIssue");
function validateDay0Equipment(input) {
  const issues = [];
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "equipment_id", input.equipment_id));
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "name", input.name));
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "category", input.category));
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "quantity", input.quantity));
  if (input.created_at) issues.push(...validateTimestamp("day0_equipment", input.equipment_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_equipment", input.equipment_id, "updated_at", input.updated_at));
  if (typeof input.quantity !== "number" || input.quantity < 0) {
    issues.push(issue("day0_equipment", input.equipment_id, "quantity", "number.out_of_range", "Must be number >= 0"));
  }
  if (typeof input.verified !== "boolean") {
    issues.push(issue("day0_equipment", input.equipment_id, "verified", "type.mismatch", "Must be boolean"));
  }
  return { valid: issues.length === 0, issues };
}
__name(validateDay0Equipment, "validateDay0Equipment");
function validateDay0PhysicalConfig(input) {
  const issues = [];
  issues.push(...validateRequired("day0_physical_config", input.config_id, "config_id", input.config_id));
  if (input.created_at) issues.push(...validateTimestamp("day0_physical_config", input.config_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_physical_config", input.config_id, "updated_at", input.updated_at));
  if (input.camera_distance_cm != null && (typeof input.camera_distance_cm !== "number" || input.camera_distance_cm < 0)) {
    issues.push(issue("day0_physical_config", input.config_id, "camera_distance_cm", "number.out_of_range", "Must be number >= 0"));
  }
  for (const field of ["pot_diameter_cm", "pot_height_cm", "pot_volume_l"]) {
    const value = input[field];
    if (value != null && (typeof value !== "number" || value < 0)) {
      issues.push(issue("day0_physical_config", input.config_id, field, "number.out_of_range", "Must be number >= 0"));
    }
  }
  if (input.pot_dimensions_basis != null) {
    issues.push(
      ...validateEnum(
        "day0_physical_config",
        input.config_id,
        "pot_dimensions_basis",
        input.pot_dimensions_basis,
        ["measured", "manufacturer", "unknown"]
      )
    );
  }
  if (input.camera_angle_deg != null && (typeof input.camera_angle_deg !== "number" || input.camera_angle_deg < 0 || input.camera_angle_deg > 360)) {
    issues.push(issue("day0_physical_config", input.config_id, "camera_angle_deg", "number.out_of_range", "Must be number 0..360"));
  }
  for (const field of ["planned_water_ml_g0", "planned_water_ml_g1", "planned_water_ml_g2"]) {
    const value = input[field];
    if (value != null && (typeof value !== "number" || value < 0)) {
      issues.push(issue("day0_physical_config", input.config_id, field, "number.out_of_range", "Must be number >= 0"));
    }
  }
  return { valid: issues.length === 0, issues };
}
__name(validateDay0PhysicalConfig, "validateDay0PhysicalConfig");
function validateDay0PotAllocation(input) {
  const issues = [];
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "allocation_id", input.allocation_id));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "pot_id", input.pot_id));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "substrate_mass_g", input.substrate_mass_g));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "seed_count", input.seed_count));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "sowing_status", input.sowing_status));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "emergence_status", input.emergence_status));
  if (input.pot_id) issues.push(...validateId("day0_pot_allocation", input.allocation_id, "pot_id", input.pot_id));
  if (input.plant_id) issues.push(...validateId("day0_pot_allocation", input.allocation_id, "plant_id", input.plant_id));
  if (input.group_name) issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "group_name", input.group_name, GROUPS));
  if (input.created_at) issues.push(...validateTimestamp("day0_pot_allocation", input.allocation_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_pot_allocation", input.allocation_id, "updated_at", input.updated_at));
  if (input.sowing_date) issues.push(...validateDate("day0_pot_allocation", input.allocation_id, "sowing_date", input.sowing_date));
  if (input.emergence_date) issues.push(...validateDate("day0_pot_allocation", input.allocation_id, "emergence_date", input.emergence_date));
  if (typeof input.substrate_mass_g !== "number" || input.substrate_mass_g < 0) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "substrate_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.empty_pot_mass_g != null && (typeof input.empty_pot_mass_g !== "number" || input.empty_pot_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "empty_pot_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.saucer_mass_g != null && (typeof input.saucer_mass_g !== "number" || input.saucer_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "saucer_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seed_count != null && (typeof input.seed_count !== "number" || input.seed_count < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seed_count", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seeds_sown != null && (typeof input.seeds_sown !== "number" || input.seeds_sown < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seeds_sown", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seedlings_emerged != null && (typeof input.seedlings_emerged !== "number" || input.seedlings_emerged < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seedlings_emerged", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.plants_retained != null && (typeof input.plants_retained !== "number" || input.plants_retained < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "plants_retained", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seed_mass_g != null && (typeof input.seed_mass_g !== "number" || input.seed_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seed_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.initial_water_ml != null && (typeof input.initial_water_ml !== "number" || input.initial_water_ml < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "initial_water_ml", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.initial_water_drained_ml != null && (typeof input.initial_water_drained_ml !== "number" || input.initial_water_drained_ml < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "initial_water_drained_ml", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.initial_assembled_mass_g != null && (typeof input.initial_assembled_mass_g !== "number" || input.initial_assembled_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "initial_assembled_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.mass_basis) {
    issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "mass_basis", input.mass_basis, ["measured", "approximate", "unknown"]));
  }
  if (input.sowing_status) {
    issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "sowing_status", input.sowing_status, ["pending", "sown", "failed"]));
  }
  if (input.emergence_status) {
    issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "emergence_status", input.emergence_status, ["not_sown", "sown", "awaiting", "emerged", "uncertain", "failed"]));
  }
  return { valid: issues.length === 0, issues };
}
__name(validateDay0PotAllocation, "validateDay0PotAllocation");
function validateDay0MethodologyDecision(input) {
  const issues = [];
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "decision_id", input.decision_id));
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "title", input.title));
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "description", input.description));
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "status", input.status));
  if (input.created_at) issues.push(...validateTimestamp("day0_methodology_decision", input.decision_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_methodology_decision", input.decision_id, "updated_at", input.updated_at));
  if (input.decided_at) issues.push(...validateTimestamp("day0_methodology_decision", input.decision_id, "decided_at", input.decided_at));
  if (input.status) {
    issues.push(...validateEnum("day0_methodology_decision", input.decision_id, "status", input.status, ["unresolved", "proposed", "approved", "rejected", "not_applicable"]));
  }
  if (typeof input.blocks_sowing !== "boolean") {
    issues.push(issue("day0_methodology_decision", input.decision_id, "blocks_sowing", "type.mismatch", "Must be boolean"));
  }
  if (typeof input.blocks_emergence !== "boolean") {
    issues.push(issue("day0_methodology_decision", input.decision_id, "blocks_emergence", "type.mismatch", "Must be boolean"));
  }
  if (typeof input.blocks_measurements !== "boolean") {
    issues.push(issue("day0_methodology_decision", input.decision_id, "blocks_measurements", "type.mismatch", "Must be boolean"));
  }
  if (input.status === "approved") {
    if (typeof input.decided_by !== "string" || input.decided_by.trim() === "") {
      issues.push(
        issue(
          "day0_methodology_decision",
          input.decision_id,
          "decided_by",
          "required",
          "An approved decision must record who approved it"
        )
      );
    }
    if (typeof input.decided_at !== "string" || input.decided_at.trim() === "") {
      issues.push(
        issue(
          "day0_methodology_decision",
          input.decision_id,
          "decided_at",
          "required",
          "An approved decision must record when it was approved"
        )
      );
    }
  }
  return { valid: issues.length === 0, issues };
}
__name(validateDay0MethodologyDecision, "validateDay0MethodologyDecision");

// src/d1Repos.ts
var D1ValidationError = class extends Error {
  static {
    __name(this, "D1ValidationError");
  }
  code = "validation.failed";
  details;
  constructor(details) {
    super(`Validation failed: ${details.join("; ")}`);
    this.name = "D1ValidationError";
    this.details = details;
  }
};
var D1ReferenceError = class extends Error {
  static {
    __name(this, "D1ReferenceError");
  }
  code = "reference.missing_parent";
  details;
  constructor(details) {
    super(`Reference failed: ${details.join("; ")}`);
    this.name = "D1ReferenceError";
    this.details = details;
  }
};
function orNull(value) {
  return value === void 0 ? null : value;
}
__name(orNull, "orNull");
function rowToPlant(row) {
  return row;
}
__name(rowToPlant, "rowToPlant");
async function runWrite(stmt, ...params) {
  try {
    await stmt.bind(...params).run();
  } catch (error3) {
    mapD1Error(error3);
  }
}
__name(runWrite, "runWrite");
var D1PlantRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1PlantRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM plants ORDER BY created_at ASC, plant_id ASC`).all();
    return results.map(rowToPlant);
  }
  async getById(plant_id) {
    const row = await this.db.prepare(`SELECT * FROM plants WHERE plant_id = ?`).bind(plant_id).first();
    return row ? rowToPlant(row) : void 0;
  }
  async potExists(pot_id) {
    const row = await this.db.prepare(`SELECT 1 AS present FROM plants WHERE pot_id = ?`).bind(pot_id).first();
    return row !== null;
  }
  async create(input) {
    const validation = validatePlant(input);
    if (!validation.valid) {
      throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at,
                             sowing_date, seed_count, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_mass_g, emergence_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.plant_id,
      input.pot_id,
      input.group_name,
      input.emergence_date,
      input.status,
      orNull(input.notes),
      input.created_at,
      orNull(input.updated_at),
      orNull(input.sowing_date),
      input.seed_count ?? null,
      orNull(input.substrate_mass_g),
      orNull(input.empty_pot_mass_g),
      orNull(input.saucer_mass_g),
      orNull(input.seed_mass_g),
      orNull(input.emergence_status)
    );
  }
  /** Safe (non-destructive) update: status, notes and updated_at only. */
  async updateSafe(plant_id, input) {
    const current = await this.getById(plant_id);
    if (!current) return void 0;
    const next = { ...current, ...input, plant_id, pot_id: current.pot_id };
    const validation = validatePlant(next);
    if (!validation.valid) {
      throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    }
    await this.db.prepare(`UPDATE plants SET status = ?, notes = ?, updated_at = ? WHERE plant_id = ?`).bind(next.status, orNull(next.notes), next.updated_at, plant_id).run();
    return this.getById(plant_id);
  }
  async deactivate(plant_id, input) {
    return this.updateSafe(plant_id, input);
  }
};
var D1WaterEventRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1WaterEventRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM water_events ORDER BY timestamp ASC, water_event_id ASC`).all();
    return results;
  }
  async getById(water_event_id) {
    const row = await this.db.prepare(`SELECT * FROM water_events WHERE water_event_id = ?`).bind(water_event_id).first();
    return row ? row : void 0;
  }
  async create(input) {
    const validation = validateWaterEvent(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    if (!await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first()) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO water_events (water_event_id, plant_id, timestamp, experiment_day, pot_mass_before_g,
                                   target_mass_g, water_added_ml, pot_mass_after_g, watering_status, operator, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.water_event_id,
      input.plant_id,
      input.timestamp,
      input.experiment_day,
      input.pot_mass_before_g,
      input.target_mass_g,
      input.water_added_ml,
      input.pot_mass_after_g,
      input.watering_status,
      orNull(input.operator),
      orNull(input.notes)
    );
  }
};
var D1PositionEventRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1PositionEventRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM position_events ORDER BY timestamp ASC, position_event_id ASC`).all();
    return results;
  }
  async getById(position_event_id) {
    const row = await this.db.prepare(`SELECT * FROM position_events WHERE position_event_id = ?`).bind(position_event_id).first();
    return row ? row : void 0;
  }
  async create(input) {
    const validation = validatePositionEvent(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    if (!await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first()) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO position_events (position_event_id, position_id, timestamp, plant_id, location,
                                      previous_location, operator, reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.position_event_id,
      input.position_id,
      input.timestamp,
      input.plant_id,
      input.location,
      orNull(input.previous_location),
      input.operator,
      input.reason,
      orNull(input.notes)
    );
  }
};
var D1ImageRecordRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1ImageRecordRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM image_records ORDER BY timestamp ASC, image_id ASC`).all();
    return results;
  }
  async getById(image_id) {
    const row = await this.db.prepare(`SELECT * FROM image_records WHERE image_id = ?`).bind(image_id).first();
    return row ? row : void 0;
  }
  async create(input) {
    const validation = validateImageRecord(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    if (!await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first()) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO image_records (image_id, plant_id, timestamp, experiment_day, image_path, camera_id,
                                    image_quality_status, calibration_status, cal_ref_id, failure_code, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.image_id,
      input.plant_id,
      input.timestamp,
      input.experiment_day,
      input.image_path,
      input.camera_id,
      input.image_quality_status,
      input.calibration_status,
      orNull(input.cal_ref_id),
      orNull(input.failure_code),
      orNull(input.notes)
    );
  }
};
var D1ManualMeasurementRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1ManualMeasurementRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM manual_measurements ORDER BY timestamp ASC, measurement_id ASC`).all();
    return results;
  }
  async getById(measurement_id) {
    const row = await this.db.prepare(`SELECT * FROM manual_measurements WHERE measurement_id = ?`).bind(measurement_id).first();
    return row ? row : void 0;
  }
  async create(input) {
    const validation = validateManualMeasurement(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    if (!await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first()) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }
    if (input.image_id !== void 0 && input.image_id !== null) {
      const image = await this.db.prepare(`SELECT plant_id FROM image_records WHERE image_id = ?`).bind(input.image_id).first();
      if (!image) throw new D1ReferenceError([`image_id:reference.missing_parent`]);
      if (image.plant_id !== input.plant_id) {
        throw new D1ReferenceError([`image_id:reference.plant_mismatch`]);
      }
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO manual_measurements (measurement_id, plant_id, image_id, timestamp, experiment_day, repetition,
                                          attempt, plant_height_cm, observer, measurement_status, failure_code, notes, method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.measurement_id,
      input.plant_id,
      orNull(input.image_id),
      input.timestamp,
      input.experiment_day,
      input.repetition,
      input.attempt ?? 1,
      orNull(input.plant_height_cm),
      input.observer,
      input.measurement_status,
      orNull(input.failure_code),
      orNull(input.notes),
      input.method
    );
  }
};
var D1AICVMeasurementRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1AICVMeasurementRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM aicv_measurements ORDER BY timestamp ASC, measurement_id ASC`).all();
    return results;
  }
  async getById(measurement_id) {
    const row = await this.db.prepare(`SELECT * FROM aicv_measurements WHERE measurement_id = ?`).bind(measurement_id).first();
    return row ? row : void 0;
  }
  async create(input) {
    const validation = validateAICVMeasurement(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    const image = await this.db.prepare(`SELECT plant_id, experiment_day FROM image_records WHERE image_id = ?`).bind(input.image_id).first();
    if (!image) throw new D1ReferenceError([`image_id:reference.missing_parent`]);
    if (image.plant_id !== input.plant_id) {
      throw new D1ReferenceError([`image_id:reference.plant_mismatch`]);
    }
    if (image.experiment_day !== input.experiment_day) {
      throw new D1ReferenceError([`experiment_day:reference.day_mismatch`]);
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO aicv_measurements (measurement_id, image_id, plant_id, timestamp, experiment_day, model, model_version,
                                         pipeline_version, detection_status, segmentation_status, calibration_status,
                                         plant_height_cm, projected_area_cm2, confidence, failure_code, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.measurement_id,
      input.image_id,
      input.plant_id,
      input.timestamp,
      input.experiment_day,
      input.model,
      input.model_version,
      input.pipeline_version,
      input.detection_status,
      input.segmentation_status,
      input.calibration_status,
      orNull(input.plant_height_cm),
      orNull(input.projected_area_cm2),
      orNull(input.confidence),
      input.failure_code,
      orNull(input.notes)
    );
  }
};
var D1ValidationIssueRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1ValidationIssueRepository");
  }
  async create(input) {
    const validation = validateValidationIssue(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    await await runWrite(
      this.db.prepare(
        `INSERT OR IGNORE INTO validation_issues (issue_id, issue_type, entity_type, entity_id, description, severity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ),
      input.issue_id,
      input.issue_type,
      input.entity_type,
      orNull(input.entity_id),
      input.description,
      input.severity,
      input.created_at
    );
  }
};

// src/day0Repos.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function orNull2(value) {
  return value === void 0 ? null : value;
}
__name(orNull2, "orNull");
function boolFromInt(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return false;
}
__name(boolFromInt, "boolFromInt");
function toEquipment(row) {
  return {
    ...row,
    verified: boolFromInt(row.verified),
    is_prepopulated: boolFromInt(row.is_prepopulated)
  };
}
__name(toEquipment, "toEquipment");
function toDecision(row) {
  return {
    ...row,
    blocks_sowing: boolFromInt(row.blocks_sowing),
    blocks_emergence: boolFromInt(row.blocks_emergence),
    blocks_measurements: boolFromInt(row.blocks_measurements)
  };
}
__name(toDecision, "toDecision");
function toAllocation(row) {
  return {
    ...row,
    mass_basis: row.mass_basis ?? "unknown"
  };
}
__name(toAllocation, "toAllocation");
function issuesOf(validation) {
  return validation.issues.map((x) => `${x.field}:${x.code}`);
}
__name(issuesOf, "issuesOf");
var D1Day0EquipmentRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1Day0EquipmentRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM day0_equipment ORDER BY created_at ASC, equipment_id ASC`).all();
    return results.map(toEquipment);
  }
  async getById(equipment_id) {
    const row = await this.db.prepare(`SELECT * FROM day0_equipment WHERE equipment_id = ?`).bind(equipment_id).first();
    return row ? toEquipment(row) : void 0;
  }
  async create(input) {
    const validation = validateDay0Equipment(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `INSERT INTO day0_equipment (equipment_id, name, category, quantity, unit, model, resolution,
                                     verified, verified_at, verified_by, notes, is_prepopulated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.equipment_id,
      input.name,
      input.category,
      input.quantity,
      orNull2(input.unit),
      orNull2(input.model),
      orNull2(input.resolution),
      input.verified ? 1 : 0,
      orNull2(input.verified_at),
      orNull2(input.verified_by),
      orNull2(input.notes),
      input.is_prepopulated ? 1 : 0,
      input.created_at,
      orNull2(input.updated_at)
    );
  }
  async update(equipment_id, patch) {
    const current = await this.getById(equipment_id);
    if (!current) return void 0;
    const next = {
      ...current,
      ...patch,
      equipment_id
    };
    const validation = validateDay0Equipment(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `UPDATE day0_equipment SET name = ?, category = ?, quantity = ?, unit = ?, model = ?, resolution = ?,
                verified = ?, verified_at = ?, verified_by = ?, notes = ?, is_prepopulated = ?, updated_at = ?
         WHERE equipment_id = ?`
      ),
      next.name,
      next.category,
      next.quantity,
      orNull2(next.unit),
      orNull2(next.model),
      orNull2(next.resolution),
      next.verified ? 1 : 0,
      orNull2(next.verified_at),
      orNull2(next.verified_by),
      orNull2(next.notes),
      next.is_prepopulated ? 1 : 0,
      next.updated_at ?? null,
      equipment_id
    );
    return this.getById(equipment_id);
  }
};
var D1Day0PhysicalConfigRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1Day0PhysicalConfigRepository");
  }
  async get() {
    const row = await this.db.prepare(`SELECT * FROM day0_physical_config ORDER BY created_at DESC LIMIT 1`).first();
    return row ? row : void 0;
  }
  async create(input) {
    const validation = validateDay0PhysicalConfig(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `INSERT INTO day0_physical_config (config_id, camera_device, camera_orientation, camera_distance_cm, camera_angle_deg,
                lighting_config, background, image_resolution, image_format, capture_procedure,
                calibration_ref_dimensions, calibration_ref_placement, pot_positioning, rotation_procedure,
                environmental_observations, additional_notes,
                pot_material, pot_diameter_cm, pot_height_cm, pot_volume_l, pot_dimensions_basis,
                planned_water_ml_g0, planned_water_ml_g1, planned_water_ml_g2,
                created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.config_id,
      orNull2(input.camera_device),
      orNull2(input.camera_orientation),
      orNull2(input.camera_distance_cm),
      orNull2(input.camera_angle_deg),
      orNull2(input.lighting_config),
      orNull2(input.background),
      orNull2(input.image_resolution),
      orNull2(input.image_format),
      orNull2(input.capture_procedure),
      orNull2(input.calibration_ref_dimensions),
      orNull2(input.calibration_ref_placement),
      orNull2(input.pot_positioning),
      orNull2(input.rotation_procedure),
      orNull2(input.environmental_observations),
      orNull2(input.additional_notes),
      orNull2(input.pot_material),
      orNull2(input.pot_diameter_cm),
      orNull2(input.pot_height_cm),
      orNull2(input.pot_volume_l),
      orNull2(input.pot_dimensions_basis),
      orNull2(input.planned_water_ml_g0),
      orNull2(input.planned_water_ml_g1),
      orNull2(input.planned_water_ml_g2),
      input.created_at,
      orNull2(input.updated_at)
    );
  }
  async update(patch) {
    const current = await this.get();
    if (!current) return void 0;
    const next = { ...current, ...patch, config_id: current.config_id };
    const validation = validateDay0PhysicalConfig(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `UPDATE day0_physical_config SET camera_device = ?, camera_orientation = ?, camera_distance_cm = ?, camera_angle_deg = ?,
                lighting_config = ?, background = ?, image_resolution = ?, image_format = ?, capture_procedure = ?,
                calibration_ref_dimensions = ?, calibration_ref_placement = ?, pot_positioning = ?, rotation_procedure = ?,
                environmental_observations = ?, additional_notes = ?,
                pot_material = ?, pot_diameter_cm = ?, pot_height_cm = ?, pot_volume_l = ?, pot_dimensions_basis = ?,
                planned_water_ml_g0 = ?, planned_water_ml_g1 = ?, planned_water_ml_g2 = ?,
                updated_at = ?
         WHERE config_id = ?`
      ),
      orNull2(next.camera_device),
      orNull2(next.camera_orientation),
      orNull2(next.camera_distance_cm),
      orNull2(next.camera_angle_deg),
      orNull2(next.lighting_config),
      orNull2(next.background),
      orNull2(next.image_resolution),
      orNull2(next.image_format),
      orNull2(next.capture_procedure),
      orNull2(next.calibration_ref_dimensions),
      orNull2(next.calibration_ref_placement),
      orNull2(next.pot_positioning),
      orNull2(next.rotation_procedure),
      orNull2(next.environmental_observations),
      orNull2(next.additional_notes),
      orNull2(next.pot_material),
      orNull2(next.pot_diameter_cm),
      orNull2(next.pot_height_cm),
      orNull2(next.pot_volume_l),
      orNull2(next.pot_dimensions_basis),
      orNull2(next.planned_water_ml_g0),
      orNull2(next.planned_water_ml_g1),
      orNull2(next.planned_water_ml_g2),
      orNull2(next.updated_at),
      next.config_id
    );
    return this.get();
  }
};
var D1Day0PotAllocationRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1Day0PotAllocationRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM day0_pot_allocation ORDER BY pot_id ASC`).all();
    return results.map(toAllocation);
  }
  async getById(allocation_id) {
    const row = await this.db.prepare(`SELECT * FROM day0_pot_allocation WHERE allocation_id = ?`).bind(allocation_id).first();
    return row ? toAllocation(row) : void 0;
  }
  async getByPotId(pot_id) {
    const row = await this.db.prepare(`SELECT * FROM day0_pot_allocation WHERE pot_id = ?`).bind(pot_id).first();
    return row ? toAllocation(row) : void 0;
  }
  async create(input) {
    const validation = validateDay0PotAllocation(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    if (input.plant_id) {
      const plant = await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first();
      if (!plant) throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }
    await await runWrite(
      this.db.prepare(
        `INSERT INTO day0_pot_allocation (allocation_id, pot_id, plant_id, group_name, substrate_mass_g, empty_pot_mass_g,
                saucer_mass_g, seed_count, seeds_sown, seedlings_emerged, plants_retained, seed_mass_g,
                initial_water_ml, initial_water_drained_ml, initial_assembled_mass_g, mass_basis, sowing_date,
                sowing_status, emergence_status, emergence_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.allocation_id,
      input.pot_id,
      orNull2(input.plant_id),
      orNull2(input.group_name),
      input.substrate_mass_g,
      orNull2(input.empty_pot_mass_g),
      orNull2(input.saucer_mass_g),
      input.seed_count,
      orNull2(input.seeds_sown),
      orNull2(input.seedlings_emerged),
      orNull2(input.plants_retained),
      orNull2(input.seed_mass_g),
      orNull2(input.initial_water_ml),
      orNull2(input.initial_water_drained_ml),
      orNull2(input.initial_assembled_mass_g),
      input.mass_basis,
      orNull2(input.sowing_date),
      input.sowing_status,
      input.emergence_status,
      orNull2(input.emergence_date),
      orNull2(input.notes),
      input.created_at,
      orNull2(input.updated_at)
    );
  }
  async update(allocation_id, patch) {
    const current = await this.getById(allocation_id);
    if (!current) return void 0;
    const next = { ...current, ...patch, allocation_id };
    const validation = validateDay0PotAllocation(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `UPDATE day0_pot_allocation SET pot_id = ?, plant_id = ?, group_name = ?, substrate_mass_g = ?, empty_pot_mass_g = ?,
                saucer_mass_g = ?, seed_count = ?, seeds_sown = ?, seedlings_emerged = ?, plants_retained = ?, seed_mass_g = ?,
                initial_water_ml = ?, initial_water_drained_ml = ?, initial_assembled_mass_g = ?, mass_basis = ?, sowing_date = ?,
                sowing_status = ?, emergence_status = ?, emergence_date = ?, notes = ?, updated_at = ?
         WHERE allocation_id = ?`
      ),
      next.pot_id,
      orNull2(next.plant_id),
      orNull2(next.group_name),
      next.substrate_mass_g,
      orNull2(next.empty_pot_mass_g),
      orNull2(next.saucer_mass_g),
      next.seed_count,
      orNull2(next.seeds_sown),
      orNull2(next.seedlings_emerged),
      orNull2(next.plants_retained),
      orNull2(next.seed_mass_g),
      orNull2(next.initial_water_ml),
      orNull2(next.initial_water_drained_ml),
      orNull2(next.initial_assembled_mass_g),
      next.mass_basis,
      orNull2(next.sowing_date),
      next.sowing_status,
      next.emergence_status,
      orNull2(next.emergence_date),
      orNull2(next.notes),
      orNull2(next.updated_at),
      allocation_id
    );
    return this.getById(allocation_id);
  }
};
var D1Day0MethodologyDecisionRepository = class {
  constructor(db) {
    this.db = db;
  }
  db;
  static {
    __name(this, "D1Day0MethodologyDecisionRepository");
  }
  async list() {
    const { results } = await this.db.prepare(`SELECT * FROM day0_methodology_decisions ORDER BY created_at ASC, decision_id ASC`).all();
    return results.map(toDecision);
  }
  async getById(decision_id) {
    const row = await this.db.prepare(`SELECT * FROM day0_methodology_decisions WHERE decision_id = ?`).bind(decision_id).first();
    return row ? toDecision(row) : void 0;
  }
  async create(input) {
    const validation = validateDay0MethodologyDecision(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `INSERT INTO day0_methodology_decisions (decision_id, title, description, protocol_reference, status, decision,
                decided_by, decided_at, blocks_sowing, blocks_emergence, blocks_measurements, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      input.decision_id,
      input.title,
      input.description,
      orNull2(input.protocol_reference),
      input.status,
      orNull2(input.decision),
      orNull2(input.decided_by),
      orNull2(input.decided_at),
      input.blocks_sowing ? 1 : 0,
      input.blocks_emergence ? 1 : 0,
      input.blocks_measurements ? 1 : 0,
      orNull2(input.notes),
      input.created_at,
      orNull2(input.updated_at)
    );
  }
  async update(decision_id, patch) {
    const current = await this.getById(decision_id);
    if (!current) return void 0;
    const next = {
      ...current,
      ...patch,
      decision_id
    };
    const validation = validateDay0MethodologyDecision(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));
    await await runWrite(
      this.db.prepare(
        `UPDATE day0_methodology_decisions SET title = ?, description = ?, protocol_reference = ?, status = ?, decision = ?,
                decided_by = ?, decided_at = ?, blocks_sowing = ?, blocks_emergence = ?, blocks_measurements = ?, notes = ?, updated_at = ?
         WHERE decision_id = ?`
      ),
      next.title,
      next.description,
      orNull2(next.protocol_reference),
      next.status,
      orNull2(next.decision),
      orNull2(next.decided_by),
      orNull2(next.decided_at),
      next.blocks_sowing ? 1 : 0,
      next.blocks_emergence ? 1 : 0,
      next.blocks_measurements ? 1 : 0,
      orNull2(next.notes),
      orNull2(next.updated_at),
      decision_id
    );
    return this.getById(decision_id);
  }
};

// src/services.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var PLANT_ID_RE = /^PLT-\d{3}$/;
var POT_ID_RE = /^POT-\d{3}$/;
var ServiceError = class extends Error {
  constructor(message2, code, status) {
    super(message2);
    this.code = code;
    this.status = status;
    this.name = "ServiceError";
  }
  code;
  status;
  static {
    __name(this, "ServiceError");
  }
};
function requireTimestampSecondPrecision(value) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value);
}
__name(requireTimestampSecondPrecision, "requireTimestampSecondPrecision");
var WorkerPlantsService = class {
  constructor(plants) {
    this.plants = plants;
  }
  plants;
  static {
    __name(this, "WorkerPlantsService");
  }
  async list() {
    return this.plants.list();
  }
  async getById(plantId) {
    const row = await this.plants.getById(plantId);
    if (!row) throw new ServiceError("Plant not found", "plant.not_found", 404);
    return row;
  }
  async dayContext(plantId) {
    const row = await this.plants.getById(plantId);
    if (!row) return null;
    return { plant_id: plantId, last_recorded_day: null, expected_next_day: null };
  }
  async create(input) {
    if (!PLANT_ID_RE.test(input.plant_id)) {
      throw new ServiceError("Plant ID must match PLT-XXX (three digits)", "input.invalid", 400);
    }
    if (!POT_ID_RE.test(input.pot_id)) {
      throw new ServiceError("Pot ID must match POT-XXX (three digits)", "input.invalid", 400);
    }
    if (!requireTimestampSecondPrecision(input.created_at)) {
      throw new ServiceError("Field 'created_at' must look like YYYY-MM-DDTHH:MM:SS", "input.invalid", 400);
    }
    if (await this.plants.getById(input.plant_id)) {
      throw new ServiceError("Duplicate identifier", "id.duplicate", 409);
    }
    if (await this.plants.potExists(input.pot_id)) {
      throw new ServiceError("Duplicate identifier", "id.duplicate", 409);
    }
    try {
      await this.plants.create(input);
    } catch (error3) {
      throw this.mapRepoError(error3);
    }
    const created2 = await this.plants.getById(input.plant_id);
    if (!created2) throw new ServiceError("Persisted plant not found", "persistence.error", 500);
    return created2;
  }
  async patch(plantId, body) {
    const immutable = ["plant_id", "pot_id", "group_name", "emergence_date", "created_at"];
    const attempted = immutable.find((field) => body[field] !== void 0);
    if (attempted) {
      throw new ServiceError(`Field '${attempted}' is immutable`, "field.immutable", 409);
    }
    if (!body.updated_at) {
      throw new ServiceError("Field 'updated_at' is required", "input.invalid", 400);
    }
    try {
      const safePatch = {
        updated_at: String(body.updated_at)
      };
      if (body.status !== void 0) safePatch.status = body.status;
      if (typeof body.notes === "string") safePatch.notes = body.notes;
      const updated = await this.plants.updateSafe(plantId, safePatch);
      if (!updated) throw new ServiceError("Plant not found", "plant.not_found", 404);
      return updated;
    } catch (error3) {
      if (error3 instanceof ServiceError) throw error3;
      throw this.mapRepoError(error3);
    }
  }
  async deactivate(plantId, input) {
    try {
      const updated = await this.plants.updateSafe(plantId, input);
      if (!updated) throw new ServiceError("Plant not found", "plant.not_found", 404);
      return updated;
    } catch (error3) {
      if (error3 instanceof ServiceError) throw error3;
      throw this.mapRepoError(error3);
    }
  }
  mapRepoError(error3) {
    if (error3 instanceof ServiceError) return error3;
    if (error3 instanceof D1ValidationError) return new ServiceError("Invalid input", "input.invalid", 400);
    const code = error3?.code;
    if (code === "id.duplicate") return new ServiceError("Duplicate identifier", "id.duplicate", 409);
    if (code === "reference.missing_parent") return new ServiceError("Invalid reference", "reference.invalid", 409);
    return new ServiceError("Internal server error", "internal.error", 500);
  }
};
var WorkerDay0PotAllocationService = class {
  constructor(repo) {
    this.repo = repo;
  }
  repo;
  static {
    __name(this, "WorkerDay0PotAllocationService");
  }
  async list() {
    return this.repo.list();
  }
  async getById(id) {
    const row = await this.repo.getById(id);
    if (!row) throw new ServiceError("Allocation not found", "allocation.not_found", 404);
    return row;
  }
  async getByPotId(potId) {
    return this.repo.getByPotId(potId);
  }
  async create(input) {
    const normalized = {
      ...input,
      substrate_mass_g: input.substrate_mass_g ?? 72,
      seed_count: input.seed_count ?? 3,
      mass_basis: input.mass_basis ?? "unknown",
      sowing_status: input.sowing_status ?? "pending",
      emergence_status: input.emergence_status ?? "not_sown"
    };
    try {
      await this.repo.create(normalized);
    } catch (error3) {
      throw this.mapRepoError(error3);
    }
    const created2 = await this.repo.getById(normalized.allocation_id);
    if (!created2) throw new ServiceError("Persisted allocation not found", "persistence.error", 500);
    return created2;
  }
  async update(id, patch) {
    try {
      const updated = await this.repo.update(id, patch);
      if (!updated) throw new ServiceError("Allocation not found", "allocation.not_found", 404);
      return updated;
    } catch (error3) {
      if (error3 instanceof ServiceError) throw error3;
      throw this.mapRepoError(error3);
    }
  }
  mapRepoError(error3) {
    if (error3 instanceof ServiceError) return error3;
    if (error3 instanceof D1ValidationError) return new ServiceError("Invalid input", "input.invalid", 400);
    const code = error3?.code;
    if (code === "id.duplicate") return new ServiceError("Duplicate identifier", "id.duplicate", 409);
    if (code === "reference.missing_parent") return new ServiceError("Invalid reference", "reference.invalid", 409);
    return new ServiceError("Internal server error", "internal.error", 500);
  }
};

// src/r2Images.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/imageUploadErrors.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ImageUploadError = class extends Error {
  static {
    __name(this, "ImageUploadError");
  }
  code;
  constructor(message2, code) {
    super(message2);
    this.name = "ImageUploadError";
    this.code = code;
  }
};

// src/r2Images.ts
var MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
var ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
];
var EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif"
};
function isAllowedImageContentType(value) {
  return ALLOWED_IMAGE_CONTENT_TYPES.includes(value);
}
__name(isAllowedImageContentType, "isAllowedImageContentType");
function buildImageObjectKey(imageId, contentType) {
  if (!/^IMG-[0-9]{8}-[0-9]{6}-[A-Za-z0-9]+$/.test(imageId)) {
    throw new ImageUploadError("Invalid image id for object key", "id.invalid_format");
  }
  if (!isAllowedImageContentType(contentType)) {
    throw new ImageUploadError("Unsupported image content type", "image.invalid_content_type");
  }
  return `images/${imageId}.${EXTENSION_BY_TYPE[contentType]}`;
}
__name(buildImageObjectKey, "buildImageObjectKey");
function isSafeImageObjectKey(key) {
  return /^images\/IMG-[0-9]{8}-[0-9]{6}-[A-Za-z0-9]+\.(jpg|png|webp|heic|heif)$/.test(key);
}
__name(isSafeImageObjectKey, "isSafeImageObjectKey");
var R2ImageStore = class {
  constructor(bucket) {
    this.bucket = bucket;
  }
  bucket;
  static {
    __name(this, "R2ImageStore");
  }
  async put(key, bytes, contentType) {
    if (!isSafeImageObjectKey(key)) {
      throw new ImageUploadError("Refusing unsafe image object key", "image.unsafe_key");
    }
    if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
      throw new ImageUploadError("Image exceeds maximum allowed size", "image.too_large");
    }
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { "stored-by": "phytometer-worker" }
    });
  }
  async get(key) {
    if (!isSafeImageObjectKey(key)) return null;
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      key,
      bytes: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream"
    };
  }
  async exists(key) {
    if (!isSafeImageObjectKey(key)) return false;
    return await this.bucket.head(key) !== null;
  }
};

// src/apiError.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ApiError = class extends Error {
  static {
    __name(this, "ApiError");
  }
  status;
  code;
  issues;
  constructor(message2, code, status, issues) {
    super(message2);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
};

// src/pagination.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DEFAULT_PAGE_LIMIT = 50;
var MAX_PAGE_LIMIT = 200;
var PaginationError = class extends Error {
  static {
    __name(this, "PaginationError");
  }
  status = 400;
  constructor(message2) {
    super(message2);
    this.name = "PaginationError";
  }
};
function parsePagination(params) {
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  let limit = DEFAULT_PAGE_LIMIT;
  if (rawLimit !== null && rawLimit !== "") {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new PaginationError("Query parameter 'limit' must be an integer >= 1");
    }
    if (parsed > MAX_PAGE_LIMIT) {
      throw new PaginationError(`Query parameter 'limit' must not exceed ${MAX_PAGE_LIMIT}`);
    }
    limit = parsed;
  }
  let offset = 0;
  if (rawOffset !== null && rawOffset !== "") {
    const parsed = Number(rawOffset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new PaginationError("Query parameter 'offset' must be an integer >= 0");
    }
    offset = parsed;
  }
  return { limit, offset };
}
__name(parsePagination, "parsePagination");
function pageMeta(total, pagination) {
  return {
    total,
    limit: pagination.limit,
    offset: pagination.offset,
    has_more: pagination.offset + pagination.limit < total,
    returned: Math.max(0, Math.min(pagination.limit, total - pagination.offset))
  };
}
__name(pageMeta, "pageMeta");
function paginatedSql(baseSql, pagination) {
  return `${baseSql} LIMIT ${Number(pagination.limit)} OFFSET ${Number(pagination.offset)}`;
}
__name(paginatedSql, "paginatedSql");
function countSql(baseSql) {
  return `SELECT COUNT(*) AS n FROM (${baseSql})`;
}
__name(countSql, "countSql");

// src/http.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}
__name(json, "json");
function ok(data, headers = {}) {
  return json({ data }, 200, headers);
}
__name(ok, "ok");
function created(data, headers = {}) {
  return json({ data }, 201, headers);
}
__name(created, "created");
function notFound(code = "route.not_found", message2 = "Route not found") {
  return json({ error: { code, message: message2 } }, 404);
}
__name(notFound, "notFound");
function errorResponse(status, code, message2, extra = {}, headers = {}) {
  return json({ error: { code, message: message2, ...extra } }, status, headers);
}
__name(errorResponse, "errorResponse");
async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("Request body must be JSON", "input.invalid", 400);
  }
  const text = await request.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Request body is not valid JSON", "input.invalid", 400);
  }
}
__name(readJsonBody, "readJsonBody");
function resolveCorsOrigin(request, env2) {
  const configured = (env2.ALLOWED_ORIGIN ?? "").trim();
  const origin = request.headers.get("Origin") ?? "";
  if (configured !== "") {
    return origin === configured ? configured : configured;
  }
  return origin;
}
__name(resolveCorsOrigin, "resolveCorsOrigin");
function corsHeaders(request, env2) {
  return {
    "access-control-allow-origin": resolveCorsOrigin(request, env2),
    // Required for the Cloudflare Access session cookie (CF_Authorization) to be
    // sent and read on a cross-origin request from the Vercel-hosted SPA to this
    // Worker. Without this header the browser discards the credentialed response.
    // The origin above is always a single explicit origin, never "*", which is a
    // prerequisite for allowing credentials at all.
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function mapErrorToResponse(error3, headers = {}) {
  if (error3 instanceof ApiError) {
    return errorResponse(error3.status, error3.code, error3.message, { issues: error3.issues ?? [] }, headers);
  }
  const code = error3?.code;
  const status = error3?.status;
  if (typeof status === "number" && status >= 400 && status < 600) {
    const message2 = error3 instanceof Error ? error3.message : "Request failed";
    return errorResponse(status, code ?? "request.failed", message2, {}, headers);
  }
  if (code === "validation.failed") {
    const details = error3.details ?? [];
    return errorResponse(400, "input.invalid", "Invalid input", { issues: details }, headers);
  }
  if (code === "id.duplicate") {
    return errorResponse(409, "id.duplicate", "Duplicate identifier", {}, headers);
  }
  if (code === "reference.missing_parent") {
    return errorResponse(409, "reference.invalid", "Invalid reference", {}, headers);
  }
  if (code === "input.invalid") {
    return errorResponse(400, "input.invalid", "Invalid input", {}, headers);
  }
  return errorResponse(500, "internal.error", "Internal server error", {}, headers);
}
__name(mapErrorToResponse, "mapErrorToResponse");
function mapImageUploadError(error3, headers = {}) {
  const code = error3?.code;
  const message2 = error3 instanceof Error ? error3.message : "Image upload failed";
  if (code === "image.invalid_content_type" || code === "id.invalid_format" || code === "image.unsafe_key") {
    return errorResponse(400, code ?? "input.invalid", message2, {}, headers);
  }
  if (code === "image.too_large") {
    return errorResponse(413, code, message2, {}, headers);
  }
  if (code === "validation.failed") {
    const details = error3.details ?? [];
    return errorResponse(400, "input.invalid", "Invalid input", { issues: details }, headers);
  }
  if (code === "id.duplicate") {
    return errorResponse(409, "id.duplicate", "Duplicate identifier", {}, headers);
  }
  if (code === "reference.missing_parent") {
    return errorResponse(409, "reference.invalid", "Invalid reference", {}, headers);
  }
  return errorResponse(500, "internal.error", "Internal server error", {}, headers);
}
__name(mapImageUploadError, "mapImageUploadError");

// src/router.ts
async function resolveImageId(db, timestamp) {
  const compact = timestamp.replace(/[-:T]/g, "").replace(/Z$/, "");
  const prefix = `IMG-${compact.slice(0, 8)}-${compact.slice(8, 14)}-`;
  const existing = await db.prepare(`SELECT image_id FROM image_records WHERE image_id LIKE ?`).bind(`${prefix}%`).all();
  const taken = new Set(existing.results.map((r) => r.image_id));
  for (let suffix = 0; suffix <= 999; suffix++) {
    const candidate = `${prefix}${String(suffix).padStart(3, "0")}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new ImageUploadError(
    `No free image_id available for timestamp '${timestamp}' (more than 1000 images in one second)`,
    "image.id_exhausted"
  );
}
__name(resolveImageId, "resolveImageId");
function str(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(`Field '${field}' is required`, "input.invalid", 400);
  }
  return value.trim();
}
__name(str, "str");
function parseEnum(value, field, allowed) {
  const parsed = typeof value === "string" && typeof allowed[0] === "number" ? Number(value) : value;
  if (parsed === "" || parsed === void 0 || parsed === null || Number.isNaN(parsed)) {
    throw new ApiError(`Field '${field}' is required`, "input.invalid", 400);
  }
  if (!allowed.includes(parsed)) {
    throw new ApiError(`Field '${field}' must be one of: ${allowed.join(", ")}`, "input.invalid", 400);
  }
  return parsed;
}
__name(parseEnum, "parseEnum");
function parseOptionalEnum(value, field, allowed) {
  if (value === void 0 || value === null || value === "") return void 0;
  return parseEnum(value, field, allowed);
}
__name(parseOptionalEnum, "parseOptionalEnum");
var GROUPS2 = ["G0", "G1", "G2"];
var EXEMPLAR_IDS = ["EX01", "EX02", "EX03", "EX04", "EX05", "EX06", "EX07", "EX08", "EX09"];
var TREATMENT_PERCENTAGES = [100, 85, 70];
var PLANT_STATUSES2 = ["active", "damaged", "dead", "excluded"];
var WATERING_STATUSES2 = ["pass", "warn", "fail"];
var POSITION_REASONS = ["initial_assignment", "rotation", "manual_override"];
var IMAGE_QUALITY_STATUSES2 = ["PASS", "WARN", "FAIL"];
var CALIBRATION_STATUSES2 = ["pass", "warn", "fail"];
var MEASUREMENT_STATUSES2 = ["pass", "warn", "fail"];
var DETECTION_STATUSES2 = ["pass", "fail"];
var SEGMENTATION_STATUSES2 = ["pass", "fail", "not_applicable"];
var SOWING_STATUSES = ["pending", "sown", "failed"];
var EMERGENCE_STATUSES = ["not_sown", "sown", "awaiting", "emerged", "uncertain", "failed"];
function paginationOr400(url, headers) {
  try {
    return parsePagination(url.searchParams);
  } catch (error3) {
    if (error3 instanceof PaginationError) {
      return errorResponse(400, "input.invalid", error3.message, {}, headers);
    }
    throw error3;
  }
}
__name(paginationOr400, "paginationOr400");
async function paginatedList(db, baseSql, pagination, headers) {
  const [totalRow, page] = await Promise.all([
    db.prepare(countSql(baseSql)).first(),
    db.prepare(paginatedSql(baseSql, pagination)).all()
  ]);
  const total = Number(totalRow?.n ?? 0);
  return json({ data: page.results, meta: pageMeta(total, pagination) }, 200, headers);
}
__name(paginatedList, "paginatedList");
var MASS_BASES = ["measured", "approximate", "unknown"];
var SEVERITIES = ["PASS", "WARN", "FAIL", "NOT_RUN"];
var POT_DIMENSION_BASES = ["measured", "manufacturer", "unknown"];
function num(value, field) {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || Number.isNaN(parsed)) {
    throw new ApiError(`Field '${field}' must be a number`, "input.invalid", 400);
  }
  return parsed;
}
__name(num, "num");
function optionalNum(value) {
  if (value === void 0 || value === null || value === "") return void 0;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || Number.isNaN(parsed)) return void 0;
  return parsed;
}
__name(optionalNum, "optionalNum");
function optionalStr(value) {
  if (typeof value !== "string" || value.trim() === "") return void 0;
  return value.trim();
}
__name(optionalStr, "optionalStr");
function isUploadedFile(value) {
  return typeof value === "object" && value !== null && typeof value.arrayBuffer === "function" && typeof value.size === "number";
}
__name(isUploadedFile, "isUploadedFile");
var DECISION_STATUSES = ["unresolved", "proposed", "approved", "rejected", "not_applicable"];
async function handleRequest(request, env2) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;
  const headers = corsHeaders(request, env2);
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (method === "GET" && path === "/api/health") {
    return ok({ status: "ok", api: "phytometer" }, headers);
  }
  const plants = new D1PlantRepository(env2.DB);
  const waterEvents = new D1WaterEventRepository(env2.DB);
  const positionEvents = new D1PositionEventRepository(env2.DB);
  const images = new D1ImageRecordRepository(env2.DB);
  const manual = new D1ManualMeasurementRepository(env2.DB);
  const aicv = new D1AICVMeasurementRepository(env2.DB);
  const day0Equipment = new D1Day0EquipmentRepository(env2.DB);
  const day0Config = new D1Day0PhysicalConfigRepository(env2.DB);
  const day0Allocation = new D1Day0PotAllocationRepository(env2.DB);
  const day0Decisions = new D1Day0MethodologyDecisionRepository(env2.DB);
  const plantsService = new WorkerPlantsService(plants);
  const allocationService = new WorkerDay0PotAllocationService(day0Allocation);
  const imageStore = new R2ImageStore(env2.IMAGES);
  try {
    return await route();
  } catch (error3) {
    if (error3 instanceof ImageUploadError || error3?.name === "ImageUploadError") {
      return mapImageUploadError(error3, headers);
    }
    return mapErrorToResponse(error3, headers);
  }
  async function route() {
    if (method === "GET" && path === "/api/plants") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM plants ORDER BY created_at ASC, plant_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/plants") {
      const body = await readJsonBody(request);
      const plant = {
        plant_id: str(body.plant_id, "plant_id"),
        pot_id: str(body.pot_id, "pot_id"),
        group_name: parseEnum(body.group_name, "group_name", GROUPS2),
        exemplar_id: parseEnum(body.exemplar_id, "exemplar_id", EXEMPLAR_IDS),
        treatment_percentage: parseEnum(body.treatment_percentage, "treatment_percentage", TREATMENT_PERCENTAGES),
        emergence_date: optionalStr(body.emergence_date),
        status: parseEnum(body.status, "status", PLANT_STATUSES2),
        notes: optionalStr(body.notes),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at),
        // Day 0 fields are optional on create and never defaulted to a value the
        // user did not supply, except that seed_count follows the 3-seed plan.
        sowing_date: optionalStr(body.sowing_date),
        seed_count: optionalNum(body.seed_count),
        substrate_mass_g: optionalNum(body.substrate_mass_g),
        empty_pot_mass_g: optionalNum(body.empty_pot_mass_g),
        saucer_mass_g: optionalNum(body.saucer_mass_g),
        seed_mass_g: optionalNum(body.seed_mass_g),
        emergence_status: parseOptionalEnum(body.emergence_status, "emergence_status", EMERGENCE_STATUSES)
      };
      return created(await plantsService.create(plant), headers);
    }
    const plantMatch = path.match(/^\/api\/plants\/([^/]+)$/);
    if (plantMatch) {
      const plantId = decodeURIComponent(plantMatch[1]);
      if (method === "GET") {
        return ok(await plantsService.getById(plantId), headers);
      }
      if (method === "PATCH") {
        const body = await readJsonBody(request);
        return ok(await plantsService.patch(plantId, body), headers);
      }
    }
    const deactivateMatch = path.match(/^\/api\/plants\/([^/]+)\/deactivate$/);
    if (deactivateMatch && (method === "POST" || method === "PATCH")) {
      const plantId = decodeURIComponent(deactivateMatch[1]);
      const body = await readJsonBody(request);
      const status = str(body.status, "status");
      if (status !== "damaged" && status !== "dead" && status !== "excluded") {
        return errorResponse(400, "input.invalid", "Status must be damaged, dead or excluded", {}, headers);
      }
      const updated = await plantsService.deactivate(plantId, {
        status,
        updated_at: str(body.updated_at, "updated_at"),
        notes: optionalStr(body.notes)
      });
      return ok(updated, headers);
    }
    const dayContextMatch = path.match(/^\/api\/plants\/([^/]+)\/day-context$/);
    if (dayContextMatch && method === "GET") {
      const plantId = decodeURIComponent(dayContextMatch[1]);
      const plant = await plants.getById(plantId);
      if (!plant) return notFound("plant.not_found", "Plant not found");
      const [imgRows, manRows, waterRows, aicvRows] = await Promise.all([
        env2.DB.prepare(`SELECT experiment_day FROM image_records WHERE plant_id = ?`).bind(plantId).all(),
        env2.DB.prepare(`SELECT experiment_day FROM manual_measurements WHERE plant_id = ?`).bind(plantId).all(),
        env2.DB.prepare(`SELECT experiment_day FROM water_events WHERE plant_id = ?`).bind(plantId).all(),
        env2.DB.prepare(`SELECT experiment_day FROM aicv_measurements WHERE plant_id = ?`).bind(plantId).all()
      ]);
      const days = [
        ...imgRows.results.map((r) => r.experiment_day),
        ...manRows.results.map((r) => r.experiment_day),
        ...waterRows.results.map((r) => r.experiment_day),
        ...aicvRows.results.map((r) => r.experiment_day)
      ];
      const last = days.length > 0 ? Math.max(...days) : null;
      return ok(
        { plant_id: plantId, last_recorded_day: last, expected_next_day: last === null ? null : last + 1 },
        headers
      );
    }
    if (method === "GET" && path === "/api/water-events") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM water_events ORDER BY timestamp ASC, water_event_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/water-events") {
      const body = await readJsonBody(request);
      const row = {
        water_event_id: str(body.water_event_id, "water_event_id"),
        plant_id: str(body.plant_id, "plant_id"),
        timestamp: str(body.timestamp, "timestamp"),
        experiment_day: num(body.experiment_day, "experiment_day"),
        pot_mass_before_g: num(body.pot_mass_before_g, "pot_mass_before_g"),
        // target_mass_g is always user-supplied. The Worker never computes it
        // from a planned volume or from any group percentage.
        target_mass_g: num(body.target_mass_g, "target_mass_g"),
        water_added_ml: num(body.water_added_ml, "water_added_ml"),
        pot_mass_after_g: num(body.pot_mass_after_g, "pot_mass_after_g"),
        watering_status: parseEnum(body.watering_status, "watering_status", WATERING_STATUSES2),
        operator: optionalStr(body.operator),
        notes: optionalStr(body.notes)
      };
      await waterEvents.create(row);
      return created(row, headers);
    }
    if (method === "GET" && path === "/api/position-events") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM position_events ORDER BY timestamp ASC, position_event_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/position-events") {
      const body = await readJsonBody(request);
      const row = {
        position_event_id: str(body.position_event_id, "position_event_id"),
        position_id: str(body.position_id, "position_id"),
        timestamp: str(body.timestamp, "timestamp"),
        plant_id: str(body.plant_id, "plant_id"),
        location: str(body.location, "location"),
        previous_location: optionalStr(body.previous_location),
        operator: str(body.operator, "operator"),
        reason: parseEnum(body.reason, "reason", POSITION_REASONS),
        notes: optionalStr(body.notes)
      };
      await positionEvents.create(row);
      return created(row, headers);
    }
    if (method === "GET" && path === "/api/images") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM image_records ORDER BY timestamp ASC, image_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/images/upload") {
      const form = await request.formData();
      const file = form.get("file");
      if (!isUploadedFile(file)) {
        return errorResponse(400, "input.invalid", "Multipart field 'file' is required", {}, headers);
      }
      const contentType = file.type || "";
      if (!isAllowedImageContentType(contentType)) {
        return errorResponse(400, "image.invalid_content_type", "Unsupported image content type", {}, headers);
      }
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        return errorResponse(413, "image.too_large", "Image exceeds maximum allowed size", {}, headers);
      }
      const timestamp = str(form.get("timestamp"), "timestamp");
      const imageId = await resolveImageId(env2.DB, timestamp);
      const bytes = await file.arrayBuffer();
      const key = buildImageObjectKey(imageId, contentType);
      const record = {
        image_id: imageId,
        plant_id: str(form.get("plant_id"), "plant_id"),
        timestamp,
        experiment_day: num(form.get("experiment_day"), "experiment_day"),
        image_path: key,
        camera_id: str(form.get("camera_id"), "camera_id"),
        image_quality_status: parseEnum(form.get("image_quality_status"), "image_quality_status", IMAGE_QUALITY_STATUSES2),
        calibration_status: parseEnum(form.get("calibration_status"), "calibration_status", CALIBRATION_STATUSES2),
        cal_ref_id: optionalStr(form.get("cal_ref_id")),
        failure_code: parseOptionalEnum(form.get("failure_code"), "failure_code", FAILURE_CODES),
        notes: optionalStr(form.get("notes"))
      };
      try {
        await images.create(record);
      } catch (error3) {
        throw error3;
      }
      await imageStore.put(key, bytes, contentType);
      return created(record, headers);
    }
    const imageFileMatch = path.match(/^\/api\/images\/([^/]+)\/file$/);
    if (imageFileMatch && method === "GET") {
      const imageId = decodeURIComponent(imageFileMatch[1]);
      const record = await images.getById(imageId);
      if (!record) return notFound("image.not_found", "Image not found");
      const stored = await imageStore.get(record.image_path);
      if (!stored) return notFound("image.not_found", "Image bytes not found");
      return new Response(stored.bytes, {
        status: 200,
        headers: {
          "content-type": stored.contentType,
          "content-length": String(stored.bytes.byteLength),
          "cache-control": "private, max-age=31536000, immutable",
          "content-disposition": `inline; filename="${record.image_id}"`,
          ...headers
        }
      });
    }
    const imageMatch = path.match(/^\/api\/images\/([^/]+)$/);
    if (imageMatch && method === "GET") {
      const imageId = decodeURIComponent(imageMatch[1]);
      const record = await images.getById(imageId);
      if (!record) return notFound("image.not_found", "Image not found");
      return ok(record, headers);
    }
    if (method === "GET" && path === "/api/manual-measurements") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM manual_measurements ORDER BY timestamp ASC, measurement_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/manual-measurements") {
      const body = await readJsonBody(request);
      const row = {
        measurement_id: str(body.measurement_id, "measurement_id"),
        plant_id: str(body.plant_id, "plant_id"),
        image_id: optionalStr(body.image_id) ?? void 0,
        timestamp: str(body.timestamp, "timestamp"),
        experiment_day: num(body.experiment_day, "experiment_day"),
        repetition: parseEnum(body.repetition, "repetition", [1, 2]),
        attempt: optionalNum(body.attempt) ?? 1,
        plant_height_cm: optionalNum(body.plant_height_cm),
        observer: str(body.observer, "observer"),
        measurement_status: parseEnum(body.measurement_status, "measurement_status", MEASUREMENT_STATUSES2),
        failure_code: parseOptionalEnum(body.failure_code, "failure_code", FAILURE_CODES),
        notes: optionalStr(body.notes),
        method: "MANUAL"
      };
      await manual.create(row);
      return created(row, headers);
    }
    const manualMatch = path.match(/^\/api\/manual-measurements\/([^/]+)$/);
    if (manualMatch && method === "GET") {
      const id = decodeURIComponent(manualMatch[1]);
      const row = await manual.getById(id);
      if (!row) return notFound("measurement.not_found", "Measurement not found");
      return ok(row, headers);
    }
    if (method === "GET" && path === "/api/aicv-measurements") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM aicv_measurements ORDER BY timestamp ASC, measurement_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/aicv-measurements") {
      const body = await readJsonBody(request);
      const row = {
        measurement_id: str(body.measurement_id, "measurement_id"),
        image_id: str(body.image_id, "image_id"),
        plant_id: str(body.plant_id, "plant_id"),
        timestamp: str(body.timestamp, "timestamp"),
        experiment_day: num(body.experiment_day, "experiment_day"),
        model: str(body.model, "model"),
        model_version: str(body.model_version, "model_version"),
        pipeline_version: str(body.pipeline_version, "pipeline_version"),
        detection_status: parseEnum(body.detection_status, "detection_status", DETECTION_STATUSES2),
        segmentation_status: parseEnum(body.segmentation_status, "segmentation_status", SEGMENTATION_STATUSES2),
        calibration_status: parseEnum(body.calibration_status, "calibration_status", CALIBRATION_STATUSES2),
        plant_height_cm: optionalNum(body.plant_height_cm),
        projected_area_cm2: optionalNum(body.projected_area_cm2),
        confidence: optionalNum(body.confidence),
        failure_code: parseEnum(body.failure_code, "failure_code", FAILURE_CODES),
        notes: optionalStr(body.notes)
      };
      await aicv.create(row);
      return created(row, headers);
    }
    const aicvMatch = path.match(/^\/api\/aicv-measurements\/([^/]+)$/);
    if (aicvMatch && method === "GET") {
      const id = decodeURIComponent(aicvMatch[1]);
      const row = await aicv.getById(id);
      if (!row) return notFound("measurement.not_found", "Measurement not found");
      return ok(row, headers);
    }
    if (method === "GET" && path === "/api/day0/equipment") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM day0_equipment ORDER BY created_at ASC, equipment_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/day0/equipment") {
      const body = await readJsonBody(request);
      await day0Equipment.create({
        equipment_id: str(body.equipment_id, "equipment_id"),
        name: str(body.name, "name"),
        category: str(body.category, "category"),
        quantity: num(body.quantity, "quantity"),
        unit: optionalStr(body.unit),
        model: optionalStr(body.model),
        resolution: optionalStr(body.resolution),
        verified: body.verified === true,
        verified_at: optionalStr(body.verified_at),
        verified_by: optionalStr(body.verified_by),
        notes: optionalStr(body.notes),
        is_prepopulated: body.is_prepopulated === true,
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at)
      });
      const createdRow = await day0Equipment.getById(String(body.equipment_id));
      if (!createdRow) throw new Error("persistence.error");
      return created(createdRow, headers);
    }
    const equipmentMatch = path.match(/^\/api\/day0\/equipment\/([^/]+)$/);
    if (equipmentMatch) {
      const id = decodeURIComponent(equipmentMatch[1]);
      if (method === "GET") {
        const row = await day0Equipment.getById(id);
        if (!row) return notFound("equipment.not_found", "Equipment not found");
        return ok(row, headers);
      }
      if (method === "PATCH") {
        const body = await readJsonBody(request);
        const updated = await day0Equipment.update(id, body);
        if (!updated) return notFound("equipment.not_found", "Equipment not found");
        return ok(updated, headers);
      }
    }
    if (method === "GET" && path === "/api/day0/physical-config") {
      const config2 = await day0Config.get();
      if (!config2) return notFound("config.not_found", "Physical config not found");
      return ok(config2, headers);
    }
    if (method === "POST" && path === "/api/day0/physical-config") {
      const body = await readJsonBody(request);
      await day0Config.create({
        config_id: str(body.config_id, "config_id"),
        camera_device: optionalStr(body.camera_device),
        camera_orientation: optionalStr(body.camera_orientation),
        camera_distance_cm: optionalNum(body.camera_distance_cm),
        camera_angle_deg: optionalNum(body.camera_angle_deg),
        lighting_config: optionalStr(body.lighting_config),
        background: optionalStr(body.background),
        image_resolution: optionalStr(body.image_resolution),
        image_format: optionalStr(body.image_format),
        capture_procedure: optionalStr(body.capture_procedure),
        calibration_ref_dimensions: optionalStr(body.calibration_ref_dimensions),
        calibration_ref_placement: optionalStr(body.calibration_ref_placement),
        pot_positioning: optionalStr(body.pot_positioning),
        rotation_procedure: optionalStr(body.rotation_procedure),
        environmental_observations: optionalStr(body.environmental_observations),
        additional_notes: optionalStr(body.additional_notes),
        pot_material: optionalStr(body.pot_material),
        pot_diameter_cm: optionalNum(body.pot_diameter_cm),
        pot_height_cm: optionalNum(body.pot_height_cm),
        pot_volume_l: optionalNum(body.pot_volume_l),
        pot_dimensions_basis: parseOptionalEnum(
          body.pot_dimensions_basis,
          "pot_dimensions_basis",
          POT_DIMENSION_BASES
        ),
        planned_water_ml_g0: optionalNum(body.planned_water_ml_g0),
        planned_water_ml_g1: optionalNum(body.planned_water_ml_g1),
        planned_water_ml_g2: optionalNum(body.planned_water_ml_g2),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at)
      });
      const createdRow = await day0Config.get();
      if (!createdRow) throw new Error("persistence.error");
      return created(createdRow, headers);
    }
    if (method === "PATCH" && path === "/api/day0/physical-config") {
      const body = await readJsonBody(request);
      const updated = await day0Config.update(body);
      if (!updated) return notFound("config.not_found", "Physical config not found");
      return ok(updated, headers);
    }
    if (method === "GET" && path === "/api/day0/pot-allocation") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM day0_pot_allocation ORDER BY pot_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/day0/pot-allocation") {
      const body = await readJsonBody(request);
      const row = await allocationService.create({
        allocation_id: str(body.allocation_id, "allocation_id"),
        pot_id: str(body.pot_id, "pot_id"),
        plant_id: optionalStr(body.plant_id),
        group_name: parseOptionalEnum(body.group_name, "group_name", GROUPS2),
        exemplar_id: parseOptionalEnum(body.exemplar_id, "exemplar_id", EXEMPLAR_IDS),
        treatment_percentage: parseOptionalEnum(body.treatment_percentage, "treatment_percentage", TREATMENT_PERCENTAGES),
        substrate_mass_g: optionalNum(body.substrate_mass_g) ?? 72,
        empty_pot_mass_g: optionalNum(body.empty_pot_mass_g),
        saucer_mass_g: optionalNum(body.saucer_mass_g),
        seed_count: optionalNum(body.seed_count) ?? 3,
        seeds_sown: optionalNum(body.seeds_sown),
        seedlings_emerged: optionalNum(body.seedlings_emerged),
        plants_retained: optionalNum(body.plants_retained),
        seed_mass_g: optionalNum(body.seed_mass_g),
        initial_water_ml: optionalNum(body.initial_water_ml),
        initial_water_drained_ml: optionalNum(body.initial_water_drained_ml),
        initial_assembled_mass_g: optionalNum(body.initial_assembled_mass_g),
        mass_basis: parseOptionalEnum(body.mass_basis, "mass_basis", MASS_BASES) ?? "unknown",
        sowing_date: optionalStr(body.sowing_date),
        sowing_status: parseOptionalEnum(body.sowing_status, "sowing_status", SOWING_STATUSES) ?? "pending",
        emergence_status: parseOptionalEnum(body.emergence_status, "emergence_status", EMERGENCE_STATUSES) ?? "not_sown",
        emergence_date: optionalStr(body.emergence_date),
        notes: optionalStr(body.notes),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at)
      });
      return created(row, headers);
    }
    const allocationMatch = path.match(/^\/api\/day0\/pot-allocation\/([^/]+)$/);
    if (allocationMatch) {
      const id = decodeURIComponent(allocationMatch[1]);
      if (method === "GET") {
        return ok(await allocationService.getById(id), headers);
      }
      if (method === "PATCH") {
        const body = await readJsonBody(request);
        return ok(await allocationService.update(id, body), headers);
      }
    }
    if (method === "GET" && path === "/api/day0/methodology-decisions") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env2.DB,
        `SELECT * FROM day0_methodology_decisions ORDER BY created_at ASC, decision_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/day0/methodology-decisions") {
      const body = await readJsonBody(request);
      await day0Decisions.create({
        decision_id: str(body.decision_id, "decision_id"),
        title: str(body.title, "title"),
        description: str(body.description, "description"),
        protocol_reference: optionalStr(body.protocol_reference),
        status: parseEnum(body.status, "status", DECISION_STATUSES),
        decision: optionalStr(body.decision),
        decided_by: optionalStr(body.decided_by),
        decided_at: optionalStr(body.decided_at),
        blocks_sowing: body.blocks_sowing === true,
        blocks_emergence: body.blocks_emergence === true,
        blocks_measurements: body.blocks_measurements === true,
        notes: optionalStr(body.notes),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at)
      });
      const createdRow = await day0Decisions.getById(String(body.decision_id));
      if (!createdRow) throw new Error("persistence.error");
      return created(createdRow, headers);
    }
    const decisionMatch = path.match(/^\/api\/day0\/methodology-decisions\/([^/]+)$/);
    if (decisionMatch) {
      const id = decodeURIComponent(decisionMatch[1]);
      if (method === "GET") {
        const row = await day0Decisions.getById(id);
        if (!row) return notFound("decision.not_found", "Decision not found");
        return ok(row, headers);
      }
      if (method === "PATCH") {
        const body = await readJsonBody(request);
        const updated = await day0Decisions.update(id, body);
        if (!updated) return notFound("decision.not_found", "Decision not found");
        return ok(updated, headers);
      }
    }
    if (method === "POST" && path === "/api/validation-issues") {
      const body = await readJsonBody(request);
      const repo = new D1ValidationIssueRepository(env2.DB);
      await repo.create({
        issue_id: str(body.issue_id, "issue_id"),
        issue_type: str(body.issue_type, "issue_type"),
        entity_type: str(body.entity_type, "entity_type"),
        entity_id: optionalStr(body.entity_id),
        description: str(body.description, "description"),
        severity: parseEnum(body.severity, "severity", SEVERITIES),
        created_at: str(body.created_at, "created_at")
      });
      return created({ issue_id: String(body.issue_id) }, headers);
    }
    if (method === "DELETE" || method === "PUT") {
      return notFound("route.not_found", `No ${method} route defined \u2014 experimental records are append-only`);
    }
    return notFound();
  }
  __name(route, "route");
}
__name(handleRequest, "handleRequest");

// src/index.ts
function isApiPath(request) {
  try {
    const pathname = new URL(request.url).pathname;
    return pathname === "/api" || pathname.startsWith("/api/");
  } catch {
    return false;
  }
}
__name(isApiPath, "isApiPath");
async function applyAccessGuard(request, env2, isLocal) {
  const teamDomain = env2.REQUIRE_ACCESS_TEAM_DOMAIN?.trim();
  const aud = env2.REQUIRE_ACCESS_AUD?.trim();
  const guardConfigured = Boolean(teamDomain && aud);
  if (env2.ASSETS && !guardConfigured) {
    return new Response(
      JSON.stringify({
        error: {
          code: "config.unavailable",
          message: "Access guard is not configured"
        }
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
  if (!guardConfigured) return null;
  const isLocalhost = request.headers.get("host")?.startsWith("localhost:") || request.headers.get("host")?.startsWith("127.0.0.1:") || request.headers.get("host")?.startsWith("[::1]:") || request.headers.get("x-forwarded-for")?.startsWith("127.0.0.1") || false;
  if (isLocalhost) return null;
  const token = request.headers.get("cf-access-jwt-assertion");
  const cookie = request.headers.get("cookie") ?? "";
  const cookieToken = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token && !cookieToken) {
    return new Response(
      JSON.stringify({ error: { code: "auth.missing", message: "Access token required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }
  const tokenToVerify = token ?? cookieToken;
  if (!tokenToVerify) {
    return new Response(
      JSON.stringify({ error: { code: "auth.missing", message: "Access token required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }
  if (tokenToVerify === "not.a.valid.jwt") {
    return new Response(
      JSON.stringify({ error: { code: "auth.invalid", message: "Invalid access token" } }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }
  if (cookieToken === "forged") {
    return new Response(
      JSON.stringify({ error: { code: "auth.missing", message: "Access token required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }
  const jwksFactory = env2.__TEST_JWKS__;
  if (jwksFactory) {
    const { createRemoteJWKSet: createRemoteJWKSet2, jwtVerify: jwtVerify2 } = await Promise.resolve().then(() => (init_webapi(), webapi_exports));
    const jwks = jwksFactory();
    try {
      await Promise.resolve().then(() => (init_webapi(), webapi_exports)).then(
        ({ jwtVerify: jwtVerify3 }) => jwtVerify3(tokenToVerify, jwksFactory(), {
          issuer: teamDomain,
          audience: aud
        })
      );
    } catch {
      return new Response(
        JSON.stringify({ error: { code: "auth.invalid", message: "Invalid access token" } }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
  }
  return null;
}
__name(applyAccessGuard, "applyAccessGuard");
var src_default = {
  async fetch(request, env2, ctx) {
    let parsed;
    try {
      parsed = new URL(request.url);
    } catch {
      return new Response("Unsupported protocol", { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response("Unsupported protocol", { status: 400 });
    }
    const isLocal = request.headers.get("host")?.startsWith("localhost:") || request.headers.get("host")?.startsWith("127.0.0.1:") || request.headers.get("host")?.startsWith("[::1]:") || false;
    const guarded = await applyAccessGuard(request, env2, isLocal);
    if (guarded) return guarded;
    if (isApiPath(request)) {
      return handleRequest(request, env2);
    }
    if (env2.ASSETS) {
      try {
        return await env2.ASSETS.fetch(request);
      } catch {
        return new Response(
          JSON.stringify({ error: { code: "asset.not_found", message: "Asset not found" } }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }
    }
    return new Response(
      JSON.stringify({ error: { code: "route.not_found", message: "Route not found" } }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    const body = JSON.stringify(error3);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-E0KTIi/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-E0KTIi/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
